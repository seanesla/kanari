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
  type AchievementTodayCounts,
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
      points: 10,
      createdAt: nowISO,
      completed: true,
      completedAt: nowISO,
      carriedOver: false,
      seen: false,
    },
  ]
}

function milestoneDefinitionForStreak(
  streakDays: number
): { type: MilestoneBadgeType; title: string; description: string } | null {
  if (streakDays === 7) {
    return { type: "7day", title: "7-Day Spark", description: "Seven days of finishing your daily set — consistency unlocked." }
  }
  if (streakDays === 30) {
    return { type: "30day", title: "30-Day Anchor", description: "A full month of daily completion — sustainable momentum." }
  }
  if (streakDays === 60) {
    return { type: "60day", title: "60-Day Rhythm", description: "Two months of steady follow-through — your habits have a heartbeat." }
  }
  if (streakDays === 90) {
    return { type: "90day", title: "90-Day Mastery", description: "Ninety days completed — you’re building a resilient baseline." }
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
  todayCounts: AchievementTodayCounts
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
  markAchievementSeen: (achievementId: string) => Promise<void>
  markMilestoneSeen: (badgeId: string) => Promise<void>
}

export function useAchievements(input?: UseAchievementsInput): UseAchievementsResult {
  const { timeZone } = useTimeZone()
  const [todayISO, setTodayISO] = useState(() => getDateKey(new Date().toISOString(), timeZone))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastEnsureAttemptRef = useRef<string | null>(null)
  const hasInput = !!input
  const recordings = input?.recordings
  const suggestions = input?.suggestions
  const sessions = input?.sessions

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

  const todayCounts: AchievementTodayCounts = useMemo(() => {
    if (!hasInput || !recordings || !sessions || !suggestions) {
      return { checkInsToday: 0, suggestionsCompletedToday: 0, suggestionsScheduledToday: 0 }
    }

    return calculateTodayCounts({
      recordings,
      sessions,
      suggestions,
      timeZone,
      todayISO,
    })
  }, [hasInput, recordings, sessions, suggestions, timeZone, todayISO])

  const dayCompletion = useMemo(() => {
    const totalCount = achievementsToday.length
    const completedCount = achievementsToday.filter((a) => a.completed).length

    const recommendedActionsCompleted = todayCounts.suggestionsCompletedToday

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
  }, [achievementsToday, todayCounts.suggestionsCompletedToday])

  // Ensure a default progress record exists (new installs won't have one yet).
  // Important: `useLiveQuery()` returns `undefined` while loading, which is the same value
  // as "record not found". Never `put()` defaults based on the reactive value, or we risk
  // overwriting existing progress during the initial render.
  //
  // See: docs/error-patterns/livequery-default-overwrite.md
  useEffect(() => {
    let cancelled = false

    void (async () => {
      // Insert-only, to avoid clobbering existing progress.
      await db.userProgress.add(DEFAULT_PROGRESS).catch(() => undefined)

      // If a prior build accidentally reset progress to defaults, recover points from
      // completed achievements (best-effort, never decreases points).
      try {
        const current = await db.userProgress.get("default")
        if (!current || cancelled) return
        if (current.totalPoints > 0) return

        const achievements = await db.achievements.toArray()
        const pointsFromAchievements = achievements.reduce((sum, achievement) => {
          if (!achievement.completed) return sum
          return sum + Math.max(0, achievement.points ?? 0)
        }, 0)

        if (pointsFromAchievements <= current.totalPoints) return

        const nextLevel = levelFromPoints(pointsFromAchievements)
        const repaired: UserProgress = {
          ...current,
          totalPoints: pointsFromAchievements,
          level: nextLevel,
          levelTitle: nextLevel !== current.level ? fallbackLevelTitle(nextLevel) : current.levelTitle,
        }

        await db.userProgress.put(repaired)
      } catch {
        // ignore
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

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
    if (!hasInput || !recordings || !sessions || !suggestions) return

    setLoading(true)
    setError(null)

    try {
      const nowISO = new Date().toISOString()
      const yesterdayISO = shiftDateISO(todayISO, -1)

      const pendingLevelTitleRequest = await (async () => {
        const prep = await db.transaction("rw", db.achievements, db.userProgress, async () => {
          // See: docs/error-patterns/dexie-transaction-async-boundary.md
          // We only treat "original today" items as blockers so carry-overs can still be filled in.
          const existingOriginalTodayCount = await db.achievements
            .where("dateISO")
            .equals(todayISO)
            .filter((a) => !a.expired && a.sourceDateISO === todayISO)
            .count()

          // Always set lastGeneratedDateISO the first time we see today's state.
          const currentProgress = (await db.userProgress.get("default")) ?? DEFAULT_PROGRESS
          const isFirstGeneration = !currentProgress.lastGeneratedDateISO
          if (currentProgress.lastGeneratedDateISO !== todayISO) {
            await db.userProgress.put({ ...currentProgress, lastGeneratedDateISO: todayISO })
          }

          if (existingOriginalTodayCount > 0) {
            return { kind: "noop" as const }
          }

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

          // Recent titles for dedupe: last 20 achievements (any date)
          const recentDailyAchievements = allAchievements
            .slice()
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 20)
            .map(toDailyAchievement)

          const stats = collectUserStatsForDailyAchievements({
            recordings,
            suggestions,
            sessions,
            recentDailyAchievements,
            progress: currentProgress,
            timeZone,
            todayISO,
            requestedCount,
            carryOverCount,
          })

          return {
            kind: "generate" as const,
            requestedCount,
            isFirstGeneration,
            stats,
          }
        })

        if (prep.kind !== "generate") return null

        let newDaily: DailyAchievement[] = []

        if (prep.requestedCount === 0) {
          newDaily = []
        } else if (prep.isFirstGeneration) {
          newDaily = buildStarterAchievements(nowISO, todayISO).slice(0, prep.requestedCount)
        } else {
          try {
            const headers = await createGeminiHeaders({ "Content-Type": "application/json" })
            const response = await fetch("/api/gemini/achievements", {
              method: "POST",
              headers,
              body: JSON.stringify(prep.stats),
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
              .slice(0, prep.requestedCount)
              .map((a) => {
                const type = a.type === "badge" ? "badge" : "challenge"
                const points = clampInt(typeof a.points === "number" ? a.points : 20, 10, 80)
                const tracking =
                  typeof a.tracking === "object" && a.tracking !== null
                    ? (a.tracking as DailyAchievement["tracking"])
                    : undefined

                return {
                  id: crypto.randomUUID(),
                  dateISO: todayISO,
                  sourceDateISO: todayISO,
                  type,
                  category: (a.category as DailyAchievement["category"]) ?? "engagement",
                  title: typeof a.title === "string" ? a.title : "Daily Win",
                  description: typeof a.description === "string" ? a.description : "Make a small move forward today.",
                  insight: typeof a.insight === "string" ? a.insight : undefined,
                  points,
                  createdAt: nowISO,
                  completed: type === "badge",
                  completedAt: type === "badge" ? nowISO : undefined,
                  carriedOver: false,
                  seen: type === "badge" ? false : true,
                  tracking: type === "challenge" ? tracking : undefined,
                }
              })
          } catch {
            // Fallback: starter set (still yields something usable offline)
            newDaily = buildStarterAchievements(nowISO, todayISO).slice(0, prep.requestedCount)
          }
        }

        if (newDaily.length === 0) return null

        return db.transaction("rw", db.achievements, db.userProgress, async () => {
          const existingOriginalTodayCount = await db.achievements
            .where("dateISO")
            .equals(todayISO)
            .filter((a) => !a.expired && a.sourceDateISO === todayISO)
            .count()
          if (existingOriginalTodayCount > 0) return null

          await db.achievements.bulkAdd(newDaily.map(fromDailyAchievement))

          // Award points immediately for badges (they are completed on creation)
          const badgePoints = newDaily.filter((a) => a.completed).reduce((sum, a) => sum + a.points, 0)
          if (badgePoints <= 0) return null

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

          if (!leveledUp) return null

          return {
            level: nextProgress.level,
            totalPoints: nextProgress.totalPoints,
            currentDailyCompletionStreak: nextProgress.currentDailyCompletionStreak,
            longestDailyCompletionStreak: nextProgress.longestDailyCompletionStreak,
          }
        })
      })()

      if (pendingLevelTitleRequest) {
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
  }, [hasInput, recordings, sessions, suggestions, timeZone, todayISO])

  // Generate today's achievements on app open (no background jobs).
  useEffect(() => {
    if (!hasInput) return
    if (loading) return
    if (lastEnsureAttemptRef.current === todayISO) return

    lastEnsureAttemptRef.current = todayISO
    const timer = setTimeout(() => {
      void ensureToday()
    }, 1200)

    return () => clearTimeout(timer)
  }, [hasInput, todayISO, ensureToday, loading])

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
      if (!hasInput || !recordings || !sessions || !suggestions) return
      const nowAchievements = await db.achievements
        .where("dateISO")
        .equals(todayISO)
        .filter((a) => !a.expired)
        .toArray()

      const allComplete = nowAchievements.length > 0 && nowAchievements.every((a) => a.completed)
      const { suggestionsCompletedToday } = calculateTodayCounts({
        recordings,
        sessions,
        suggestions,
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
  }, [hasInput, recordings, sessions, suggestions, timeZone, todayISO])

  const markAchievementSeen = useCallback(async (achievementId: string) => {
    await db.achievements.update(achievementId, { seen: true, seenAt: new Date() })
  }, [])

  const markMilestoneSeen = useCallback(async (badgeId: string) => {
    await db.milestoneBadges.update(badgeId, { seen: true, seenAt: new Date() })
  }, [])

  // Auto-complete measurable challenges when the underlying data changes.
  useEffect(() => {
    if (!hasInput) return
    const activeChallenges = achievementsToday.filter((a) => a.type === "challenge" && !a.completed && !a.expired && a.tracking)
    if (activeChallenges.length === 0) return

    const eligible = activeChallenges.filter((a) => {
      const tracking = a.tracking
      if (!tracking) return false
      if (tracking.key === "do_check_in") return todayCounts.checkInsToday >= tracking.target
      if (tracking.key === "complete_suggestions") return todayCounts.suggestionsCompletedToday >= tracking.target
      if (tracking.key === "schedule_suggestion") return todayCounts.suggestionsScheduledToday >= tracking.target
      return false
    })

    if (eligible.length === 0) return

    // Complete eligible challenges one-by-one (preserves point awarding + celebrations)
    void (async () => {
      for (const achievement of eligible) {
        await completeAchievement(achievement.id)
      }
    })()
  }, [hasInput, achievementsToday, todayCounts, completeAchievement])

  // Advance daily completion streak when requirements are met (including the "2 suggestions" rule).
  useEffect(() => {
    if (!hasInput) return
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
          earnedAt: nowISO,
          streakDays: nextStreak,
          seen: false,
        }

        await db.milestoneBadges.add(fromMilestoneBadge(badge))
      })
    })()
  }, [dayCompletion.isComplete, hasInput, todayISO])

  return {
    timeZone,
    todayISO,
    progress,
    todayCounts,
    achievementsToday,
    history,
    milestoneBadges,
    celebrationQueue,
    milestoneCelebrationQueue,
    dayCompletion,
    loading,
    error,
    ensureToday,
    markAchievementSeen,
    markMilestoneSeen,
  }
}
