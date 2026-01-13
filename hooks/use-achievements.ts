"use client"

/**
 * Daily Achievements Hook
 *
 * Replaces the old "rare achievements" system with a daily hybrid model:
 * - 2–3 daily achievements (challenges + badges)
 * - Resets at midnight in the user's selected time zone
 * - Incomplete challenges carry over once, then expire
 * - Points + levels + AI-generated level titles
 * - Milestone badges at 7/30/60/90 day completion streaks
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { getDateKey } from "@/lib/date-utils"
import { useTimeZone } from "@/lib/timezone-context"
import { createGeminiHeaders } from "@/lib/utils"
import { db, fromDailyAchievement, toDailyAchievement, fromMilestoneBadge, toMilestoneBadge } from "@/lib/storage/db"
import {
  collectUserStatsForDailyAchievements,
  type DailyAchievement,
  type MilestoneBadge,
  type MilestoneBadgeType,
  type UserProgress,
} from "@/lib/achievements"
import type { CheckInSession, Recording, Suggestion } from "@/lib/types"

const DEFAULT_PROGRESS: UserProgress = {
  id: "default",
  totalPoints: 0,
  level: 1,
  levelTitle: "Grounded Beginner",
  currentDailyCompletionStreak: 0,
  longestDailyCompletionStreak: 0,
  lastCompletedDateISO: null,
  lastGeneratedDateISO: null,
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(value)))
}

function shiftDateISO(dateISO: string, deltaDays: number): string {
  const [year, month, day] = dateISO.split("-").map(Number)
  const base = Date.UTC(year, (month ?? 1) - 1, day ?? 1)
  const shifted = new Date(base + deltaDays * 86_400_000)
  const y = shifted.getUTCFullYear()
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0")
  const d = String(shifted.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function levelFromPoints(totalPoints: number): number {
  return Math.floor(Math.max(0, totalPoints) / 100) + 1
}

function fallbackLevelTitle(level: number): string {
  const titles = [
    "Grounded Beginner",
    "Steady Builder",
    "Calm Craftsman",
    "Resilience Ranger",
    "Balance Architect",
    "Recovery Strategist",
    "Focus Alchemist",
    "Burnout Whisperer",
    "Sustainable Sage",
  ]
  if (level <= titles.length) return titles[level - 1]
  const adjectives = ["Centered", "Steady", "Resilient", "Balanced", "Rested", "Focused", "Intentional"]
  const nouns = ["Navigator", "Builder", "Guardian", "Guide", "Strategist", "Architect"]
  const adj = adjectives[(level + 3) % adjectives.length]
  const noun = nouns[(level + 7) % nouns.length]
  return `${adj} ${noun}`
}

function buildStarterAchievements(nowISO: string, todayISO: string): DailyAchievement[] {
  return [
    {
      id: crypto.randomUUID(),
      dateISO: todayISO,
      sourceDateISO: todayISO,
      type: "challenge",
      category: "consistency",
      title: "First Check-In",
      description: "Complete one check-in today to start building momentum.",
      insight: "Any voice note or AI check-in counts.",
      emoji: "🎙️",
      points: 20,
      createdAt: nowISO,
      completed: false,
      carriedOver: false,
      seen: true,
      tracking: { key: "do_check_in", target: 1 },
    },
    {
      id: crypto.randomUUID(),
      dateISO: todayISO,
      sourceDateISO: todayISO,
      type: "challenge",
      category: "recovery",
      title: "Do Two Suggestions",
      description: "Complete two recovery suggestions today (small wins count).",
      insight: "This unlocks daily completion streak progress.",
      emoji: "✅",
      points: 35,
      createdAt: nowISO,
      completed: false,
      carriedOver: false,
      seen: true,
      tracking: { key: "complete_suggestions", target: 2 },
    },
    {
      id: crypto.randomUUID(),
      dateISO: todayISO,
      sourceDateISO: todayISO,
      type: "badge",
      category: "engagement",
      title: "Welcome Ritual",
      description: "You showed up — let’s make today count.",
      insight: "Daily challenges reset at midnight in your time zone.",
      emoji: "✨",
      points: 10,
      createdAt: nowISO,
      completed: true,
      completedAt: nowISO,
      carriedOver: false,
      seen: false,
    },
  ]
}

function milestoneDefinitionForStreak(streakDays: number): { type: MilestoneBadgeType; title: string; description: string; emoji: string } | null {
  if (streakDays === 7) {
    return { type: "7day", title: "7-Day Spark", description: "Seven days of finishing your daily set — consistency unlocked.", emoji: "🔥" }
  }
  if (streakDays === 30) {
    return { type: "30day", title: "30-Day Anchor", description: "A full month of daily completion — sustainable momentum.", emoji: "⚓" }
  }
  if (streakDays === 60) {
    return { type: "60day", title: "60-Day Rhythm", description: "Two months of steady follow-through — your habits have a heartbeat.", emoji: "🎵" }
  }
  if (streakDays === 90) {
    return { type: "90day", title: "90-Day Mastery", description: "Ninety days completed — you’re building a resilient baseline.", emoji: "🏆" }
  }
  return null
}

function calculateTodayCounts(input: {
  recordings: Recording[]
  sessions: CheckInSession[]
  suggestions: Suggestion[]
  timeZone: string
  todayISO: string
}): { checkInsToday: number; suggestionsCompletedToday: number; suggestionsScheduledToday: number } {
  const checkInsToday =
    input.recordings.filter((r) => getDateKey(r.createdAt, input.timeZone) === input.todayISO).length +
    input.sessions.filter((s) => getDateKey(s.startedAt, input.timeZone) === input.todayISO).length

  const suggestionsCompletedToday = input.suggestions.filter((s) => {
    if (s.status !== "completed" && s.status !== "accepted") return false
    const timestamp = s.completedAt ?? s.lastUpdatedAt ?? s.createdAt
    return getDateKey(timestamp, input.timeZone) === input.todayISO
  }).length

  const suggestionsScheduledToday = input.suggestions.filter((s) => {
    if (s.status !== "scheduled") return false
    const timestamp = s.lastUpdatedAt ?? s.createdAt
    return getDateKey(timestamp, input.timeZone) === input.todayISO
  }).length

  return { checkInsToday, suggestionsCompletedToday, suggestionsScheduledToday }
}

export interface UseAchievementsInput {
  recordings: Recording[]
  suggestions: Suggestion[]
  sessions: CheckInSession[]
}

export interface UseAchievementsResult {
  timeZone: string
  todayISO: string
  progress: UserProgress
  achievementsToday: DailyAchievement[]
  history: DailyAchievement[]
  milestoneBadges: MilestoneBadge[]
  celebrationQueue: DailyAchievement[]
  milestoneCelebrationQueue: MilestoneBadge[]
  dayCompletion: {
    completeAllDailyAchievements: boolean
    recommendedActionsCompleted: number
    recommendedActionsRequired: number
    isComplete: boolean
    completedCount: number
    totalCount: number
  }
  loading: boolean
  error: string | null
  ensureToday: () => Promise<void>
  completeAchievement: (achievementId: string) => Promise<void>
  markAchievementSeen: (achievementId: string) => Promise<void>
  markMilestoneSeen: (badgeId: string) => Promise<void>
}

export function useAchievements(input?: UseAchievementsInput): UseAchievementsResult {
  const { timeZone } = useTimeZone()
  const [todayISO, setTodayISO] = useState(() => getDateKey(new Date().toISOString(), timeZone))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastEnsureAttemptRef = useRef<string | null>(null)

  const dbAchievements = useLiveQuery(
    () => db.achievements.orderBy("dateISO").reverse().toArray(),
    []
  )
  const history: DailyAchievement[] = useMemo(
    () => (dbAchievements ?? []).map(toDailyAchievement),
    [dbAchievements]
  )

  const achievementsToday = useMemo(() => {
    return history
      .filter((a) => a.dateISO === todayISO && !a.expired)
      .sort((a, b) => {
        // challenges first, then badges
        if (a.type !== b.type) return a.type === "challenge" ? -1 : 1
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      })
  }, [history, todayISO])

  const dbMilestones = useLiveQuery(
    () => db.milestoneBadges.orderBy("earnedAt").reverse().toArray(),
    []
  )
  const milestoneBadges: MilestoneBadge[] = useMemo(
    () => (dbMilestones ?? []).map(toMilestoneBadge),
    [dbMilestones]
  )

  const dbProgress = useLiveQuery(() => db.userProgress.get("default"), [])
  const progress: UserProgress = dbProgress ?? DEFAULT_PROGRESS

  const celebrationQueue = useMemo(() => {
    return achievementsToday.filter((a) => a.completed && !a.seen && !a.expired)
  }, [achievementsToday])

  const milestoneCelebrationQueue = useMemo(() => {
    return milestoneBadges.filter((b) => !b.seen)
  }, [milestoneBadges])

  const dayCompletion = useMemo(() => {
    const totalCount = achievementsToday.length
    const completedCount = achievementsToday.filter((a) => a.completed).length

    const recommendedActionsCompleted = input
      ? calculateTodayCounts({
          recordings: input.recordings,
          sessions: input.sessions,
          suggestions: input.suggestions,
          timeZone,
          todayISO,
        }).suggestionsCompletedToday
      : 0

    const recommendedActionsRequired = 2
    const completeAllDailyAchievements = totalCount > 0 && completedCount === totalCount
    const isComplete = completeAllDailyAchievements && recommendedActionsCompleted >= recommendedActionsRequired

    return {
      completeAllDailyAchievements,
      recommendedActionsCompleted,
      recommendedActionsRequired,
      isComplete,
      completedCount,
      totalCount,
    }
  }, [achievementsToday, input, timeZone, todayISO])

  // Ensure a default progress record exists (new installs won't have one yet).
  useEffect(() => {
    if (dbProgress) return
    void db.userProgress.put(DEFAULT_PROGRESS)
  }, [dbProgress])

  // Keep today's ISO date in sync (midnight rollover).
  useEffect(() => {
    setTodayISO(getDateKey(new Date().toISOString(), timeZone))

    const interval = setInterval(() => {
      const next = getDateKey(new Date().toISOString(), timeZone)
      setTodayISO((prev) => (prev === next ? prev : next))
    }, 60_000)

    return () => clearInterval(interval)
  }, [timeZone])

  const ensureToday = useCallback(async () => {
    if (!input) return

    setLoading(true)
    setError(null)

    try {
      const nowISO = new Date().toISOString()
      const yesterdayISO = shiftDateISO(todayISO, -1)

      let shouldRequestAILevelTitle = false
      let pendingLevelTitleRequest: {
        level: number
        totalPoints: number
        currentDailyCompletionStreak: number
        longestDailyCompletionStreak: number
      } | null = null

      await db.transaction("rw", db.achievements, db.userProgress, async () => {
        const existingToday = await db.achievements
          .where("dateISO")
          .equals(todayISO)
          .filter((a) => !a.expired)
          .toArray()

        // Always set lastGeneratedDateISO the first time we see today's state
        const currentProgress = (await db.userProgress.get("default")) ?? DEFAULT_PROGRESS
        if (currentProgress.lastGeneratedDateISO !== todayISO) {
          await db.userProgress.put({ ...currentProgress, lastGeneratedDateISO: todayISO })
        }

        if (existingToday.length > 0) return

        // Expire stale challenges (missed carry-over window)
        const allAchievements = await db.achievements.toArray()
        for (const raw of allAchievements) {
          if (raw.type !== "challenge") continue
          if (raw.completed || raw.expired) continue
          if (raw.dateISO < yesterdayISO) {
            await db.achievements.update(raw.id, { expired: true, expiredAt: new Date(nowISO), seen: true })
          }
        }

        // Carry over yesterday's incomplete challenges once; expire already-carried ones.
        let carryOverCount = 0
        const yesterday = allAchievements.filter((a) => a.type === "challenge" && a.dateISO === yesterdayISO && !a.completed && !a.expired)
        for (const ch of yesterday) {
          if (ch.carriedOver) {
            await db.achievements.update(ch.id, { expired: true, expiredAt: new Date(nowISO), seen: true })
            continue
          }
          await db.achievements.update(ch.id, { dateISO: todayISO, carriedOver: true })
          carryOverCount += 1
        }

        const requestedCount = Math.max(0, 3 - carryOverCount)

        const progressForStats = (await db.userProgress.get("default")) ?? DEFAULT_PROGRESS

        // Recent titles for dedupe: last 20 achievements (any date)
        const recentDailyAchievements = allAchievements
          .slice()
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, 20)
          .map(toDailyAchievement)

        const stats = collectUserStatsForDailyAchievements({
          recordings: input.recordings,
          suggestions: input.suggestions,
          sessions: input.sessions,
          recentDailyAchievements,
          progress: progressForStats,
          timeZone,
          todayISO,
          requestedCount,
          carryOverCount,
        })

        let newDaily: DailyAchievement[] = []

        const isFirstGeneration = !progressForStats.lastGeneratedDateISO
        if (requestedCount === 0) {
          newDaily = []
        } else if (isFirstGeneration) {
          newDaily = buildStarterAchievements(nowISO, todayISO).slice(0, requestedCount)
        } else {
          try {
            const headers = await createGeminiHeaders({ "Content-Type": "application/json" })
            const response = await fetch("/api/gemini/achievements", {
              method: "POST",
              headers,
              body: JSON.stringify(stats),
            })

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}))
              throw new Error(errorData.error || `API error: ${response.status}`)
            }

            const data = await response.json()
            if (!Array.isArray(data.achievements)) {
              throw new Error("Invalid API response")
            }

            newDaily = (data.achievements as Array<Record<string, unknown>>)
              .slice(0, requestedCount)
              .map((a) => {
                const type = a.type === "badge" ? "badge" : "challenge"
                const points = clampInt(typeof a.points === "number" ? a.points : 20, 10, 80)
                const tracking = typeof a.tracking === "object" && a.tracking !== null ? (a.tracking as DailyAchievement["tracking"]) : undefined

                return {
                  id: crypto.randomUUID(),
                  dateISO: todayISO,
                  sourceDateISO: todayISO,
                  type,
                  category: (a.category as DailyAchievement["category"]) ?? "engagement",
                  title: typeof a.title === "string" ? a.title : "Daily Win",
                  description: typeof a.description === "string" ? a.description : "Make a small move forward today.",
                  insight: typeof a.insight === "string" ? a.insight : undefined,
                  emoji: typeof a.emoji === "string" ? a.emoji : "✨",
                  points,
                  createdAt: nowISO,
                  completed: type === "badge",
                  completedAt: type === "badge" ? nowISO : undefined,
                  carriedOver: false,
                  seen: type === "badge" ? false : true,
                  tracking: type === "challenge" ? tracking : undefined,
                }
              })
          } catch (aiError) {
            // Fallback: starter set (still yields something usable offline)
            newDaily = buildStarterAchievements(nowISO, todayISO).slice(0, requestedCount)
          }
        }

        if (newDaily.length > 0) {
          await db.achievements.bulkAdd(newDaily.map(fromDailyAchievement))

          // Award points immediately for badges (they are completed on creation)
          const badgePoints = newDaily.filter((a) => a.completed).reduce((sum, a) => sum + a.points, 0)
          if (badgePoints > 0) {
            const updatedProgress = (await db.userProgress.get("default")) ?? DEFAULT_PROGRESS
            const nextTotal = updatedProgress.totalPoints + badgePoints
            const nextLevel = levelFromPoints(nextTotal)
            const leveledUp = nextLevel !== updatedProgress.level

            const nextProgress: UserProgress = {
              ...updatedProgress,
              totalPoints: nextTotal,
              level: nextLevel,
              levelTitle: leveledUp ? fallbackLevelTitle(nextLevel) : updatedProgress.levelTitle,
              lastLevelUpAt: leveledUp ? nowISO : updatedProgress.lastLevelUpAt,
            }

            await db.userProgress.put(nextProgress)

            if (leveledUp) {
              shouldRequestAILevelTitle = true
              pendingLevelTitleRequest = {
                level: nextProgress.level,
                totalPoints: nextProgress.totalPoints,
                currentDailyCompletionStreak: nextProgress.currentDailyCompletionStreak,
                longestDailyCompletionStreak: nextProgress.longestDailyCompletionStreak,
              }
            }
          }
        }
      })

      if (shouldRequestAILevelTitle && pendingLevelTitleRequest) {
        try {
          const headers = await createGeminiHeaders({ "Content-Type": "application/json" })
          const response = await fetch("/api/gemini/achievements/level-title", {
            method: "POST",
            headers,
            body: JSON.stringify(pendingLevelTitleRequest),
          })
          if (response.ok) {
            const data = (await response.json()) as { title?: string }
            const title = typeof data.title === "string" ? data.title.trim() : ""
            if (title) {
              const current = (await db.userProgress.get("default")) ?? DEFAULT_PROGRESS
              await db.userProgress.put({ ...current, levelTitle: title })
            }
          }
        } catch {
          // ignore: fallback title already set
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate daily achievements"
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [input, timeZone, todayISO])

  // Generate today's achievements on app open (no background jobs).
  useEffect(() => {
    if (!input) return
    if (loading) return
    if (lastEnsureAttemptRef.current === todayISO) return

    lastEnsureAttemptRef.current = todayISO
    const timer = setTimeout(() => {
      void ensureToday()
    }, 1200)

    return () => clearTimeout(timer)
  }, [input, todayISO, ensureToday, loading])

  const completeAchievement = useCallback(async (achievementId: string) => {
    const nowISO = new Date().toISOString()

    let shouldRequestAILevelTitle = false
    let pendingLevelTitleRequest: {
      level: number
      totalPoints: number
      currentDailyCompletionStreak: number
      longestDailyCompletionStreak: number
    } | null = null

    await db.transaction("rw", db.achievements, db.userProgress, db.milestoneBadges, async () => {
      const raw = await db.achievements.get(achievementId)
      if (!raw) return
      if (raw.expired) return
      if (raw.completed) return

      await db.achievements.update(achievementId, {
        completed: true,
        completedAt: new Date(nowISO),
        seen: false,
        seenAt: undefined,
      })

      const current = (await db.userProgress.get("default")) ?? DEFAULT_PROGRESS
      const pointsDelta = raw.points ?? 0
      const nextTotal = current.totalPoints + Math.max(0, pointsDelta)
      const nextLevel = levelFromPoints(nextTotal)
      const leveledUp = nextLevel !== current.level

      const nextProgress: UserProgress = {
        ...current,
        totalPoints: nextTotal,
        level: nextLevel,
        levelTitle: leveledUp ? fallbackLevelTitle(nextLevel) : current.levelTitle,
        lastLevelUpAt: leveledUp ? nowISO : current.lastLevelUpAt,
      }

      await db.userProgress.put(nextProgress)

      if (leveledUp) {
        shouldRequestAILevelTitle = true
        pendingLevelTitleRequest = {
          level: nextProgress.level,
          totalPoints: nextProgress.totalPoints,
          currentDailyCompletionStreak: nextProgress.currentDailyCompletionStreak,
          longestDailyCompletionStreak: nextProgress.longestDailyCompletionStreak,
        }
      }

      // If completing this achievement finishes the day AND the user did 2+ suggestions, advance streak + milestones.
      if (!input) return
      const nowAchievements = await db.achievements
        .where("dateISO")
        .equals(todayISO)
        .filter((a) => !a.expired)
        .toArray()

      const allComplete = nowAchievements.length > 0 && nowAchievements.every((a) => a.completed)
      const { suggestionsCompletedToday } = calculateTodayCounts({
        recordings: input.recordings,
        sessions: input.sessions,
        suggestions: input.suggestions,
        timeZone,
        todayISO,
      })

      const qualifies = allComplete && suggestionsCompletedToday >= 2
      if (!qualifies) return
      if (nextProgress.lastCompletedDateISO === todayISO) return

      const yesterdayISO = shiftDateISO(todayISO, -1)
      const isConsecutive = nextProgress.lastCompletedDateISO === yesterdayISO
      const nextStreak = isConsecutive ? nextProgress.currentDailyCompletionStreak + 1 : 1

      const updatedStreakProgress: UserProgress = {
        ...nextProgress,
        currentDailyCompletionStreak: nextStreak,
        longestDailyCompletionStreak: Math.max(nextProgress.longestDailyCompletionStreak, nextStreak),
        lastCompletedDateISO: todayISO,
      }

      await db.userProgress.put(updatedStreakProgress)

      const milestone = milestoneDefinitionForStreak(nextStreak)
      if (!milestone) return

      const alreadyEarned = await db.milestoneBadges.where("type").equals(milestone.type).count()
      if (alreadyEarned > 0) return

      const badge: MilestoneBadge = {
        id: crypto.randomUUID(),
        type: milestone.type,
        title: milestone.title,
        description: milestone.description,
        emoji: milestone.emoji,
        earnedAt: nowISO,
        streakDays: nextStreak,
        seen: false,
      }

      await db.milestoneBadges.add(fromMilestoneBadge(badge))
    })

    if (shouldRequestAILevelTitle && pendingLevelTitleRequest) {
      try {
        const headers = await createGeminiHeaders({ "Content-Type": "application/json" })
        const response = await fetch("/api/gemini/achievements/level-title", {
          method: "POST",
          headers,
          body: JSON.stringify(pendingLevelTitleRequest),
        })
        if (response.ok) {
          const data = (await response.json()) as { title?: string }
          const title = typeof data.title === "string" ? data.title.trim() : ""
          if (title) {
            const current = (await db.userProgress.get("default")) ?? DEFAULT_PROGRESS
            await db.userProgress.put({ ...current, levelTitle: title })
          }
        }
      } catch {
        // ignore
      }
    }
  }, [input, timeZone, todayISO])

  const markAchievementSeen = useCallback(async (achievementId: string) => {
    await db.achievements.update(achievementId, { seen: true, seenAt: new Date() })
  }, [])

  const markMilestoneSeen = useCallback(async (badgeId: string) => {
    await db.milestoneBadges.update(badgeId, { seen: true, seenAt: new Date() })
  }, [])

  // Auto-complete measurable challenges when the underlying data changes.
  useEffect(() => {
    if (!input) return
    const activeChallenges = achievementsToday.filter((a) => a.type === "challenge" && !a.completed && !a.expired && a.tracking)
    if (activeChallenges.length === 0) return

    const { checkInsToday, suggestionsCompletedToday, suggestionsScheduledToday } = calculateTodayCounts({
      recordings: input.recordings,
      sessions: input.sessions,
      suggestions: input.suggestions,
      timeZone,
      todayISO,
    })

    const eligible = activeChallenges.filter((a) => {
      const tracking = a.tracking
      if (!tracking) return false
      if (tracking.key === "do_check_in") return checkInsToday >= tracking.target
      if (tracking.key === "complete_suggestions") return suggestionsCompletedToday >= tracking.target
      if (tracking.key === "schedule_suggestion") return suggestionsScheduledToday >= tracking.target
      return false
    })

    if (eligible.length === 0) return

    // Complete eligible challenges one-by-one (preserves point awarding + celebrations)
    void (async () => {
      for (const achievement of eligible) {
        await completeAchievement(achievement.id)
      }
    })()
  }, [input, achievementsToday, timeZone, todayISO, completeAchievement])

  // Advance daily completion streak when requirements are met (including the "2 suggestions" rule).
  useEffect(() => {
    if (!input) return
    if (!dayCompletion.isComplete) return

    void (async () => {
      const nowISO = new Date().toISOString()
      await db.transaction("rw", db.userProgress, db.milestoneBadges, async () => {
        const current = (await db.userProgress.get("default")) ?? DEFAULT_PROGRESS
        if (current.lastCompletedDateISO === todayISO) return

        const yesterdayISO = shiftDateISO(todayISO, -1)
        const isConsecutive = current.lastCompletedDateISO === yesterdayISO
        const nextStreak = isConsecutive ? current.currentDailyCompletionStreak + 1 : 1

        const nextProgress: UserProgress = {
          ...current,
          currentDailyCompletionStreak: nextStreak,
          longestDailyCompletionStreak: Math.max(current.longestDailyCompletionStreak, nextStreak),
          lastCompletedDateISO: todayISO,
        }

        await db.userProgress.put(nextProgress)

        const milestone = milestoneDefinitionForStreak(nextStreak)
        if (!milestone) return

        const alreadyEarned = await db.milestoneBadges.where("type").equals(milestone.type).count()
        if (alreadyEarned > 0) return

        const badge: MilestoneBadge = {
          id: crypto.randomUUID(),
          type: milestone.type,
          title: milestone.title,
          description: milestone.description,
          emoji: milestone.emoji,
          earnedAt: nowISO,
          streakDays: nextStreak,
          seen: false,
        }

        await db.milestoneBadges.add(fromMilestoneBadge(badge))
      })
    })()
  }, [dayCompletion.isComplete, input, todayISO])

  return {
    timeZone,
    todayISO,
    progress,
    achievementsToday,
    history,
    milestoneBadges,
    celebrationQueue,
    milestoneCelebrationQueue,
    dayCompletion,
    loading,
    error,
    ensureToday,
    completeAchievement,
    markAchievementSeen,
    markMilestoneSeen,
  }
}
