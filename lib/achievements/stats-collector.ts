/**
 * Stats Collector for Daily Achievement Generation
 *
 * Builds a compact summary of recent user activity to help Gemini generate
 * daily challenges + badges that are achievable and measurable.
 */

import { getDateKey } from "@/lib/date-utils"
import type { CheckInSession, Recording, Suggestion } from "@/lib/types"
import type {
  DailyAchievement,
  UserProgress,
  UserStatsForDailyAchievements,
} from "./types"

function shiftDateISO(dateISO: string, deltaDays: number): string {
  const [year, month, day] = dateISO.split("-").map(Number)
  const base = Date.UTC(year, (month ?? 1) - 1, day ?? 1)
  const shifted = new Date(base + deltaDays * 86_400_000)
  const y = shifted.getUTCFullYear()
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0")
  const d = String(shifted.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function ymdToUtcMidnightMs(dateISO: string): number {
  const [year, month, day] = dateISO.split("-").map(Number)
  return Date.UTC(year, (month ?? 1) - 1, day ?? 1)
}

function calculateStreakFromDateKeys(dateKeys: string[], todayISO: string): number {
  if (dateKeys.length === 0) return 0

  const yesterdayISO = shiftDateISO(todayISO, -1)
  const sortedDesc = [...new Set(dateKeys)].sort((a, b) => b.localeCompare(a))

  if (sortedDesc[0] !== todayISO && sortedDesc[0] !== yesterdayISO) return 0

  let streak = 1
  for (let i = 1; i < sortedDesc.length; i++) {
    const prev = sortedDesc[i - 1]
    const curr = sortedDesc[i]
    const diffDays = Math.round((ymdToUtcMidnightMs(prev) - ymdToUtcMidnightMs(curr)) / 86_400_000)
    if (diffDays === 1) {
      streak += 1
    } else {
      break
    }
  }
  return streak
}

function calculateLongestStreakFromDateKeys(dateKeys: string[]): number {
  const unique = [...new Set(dateKeys)].sort((a, b) => a.localeCompare(b))
  if (unique.length === 0) return 0

  let longest = 1
  let current = 1

  for (let i = 1; i < unique.length; i++) {
    const prev = unique[i - 1]
    const curr = unique[i]
    const diffDays = Math.round((ymdToUtcMidnightMs(curr) - ymdToUtcMidnightMs(prev)) / 86_400_000)
    if (diffDays === 1) {
      current += 1
      longest = Math.max(longest, current)
    } else {
      current = 1
    }
  }

  return longest
}

function calculateTrend(
  entries: Array<{ stressScore: number; fatigueScore: number }>,
  metric: "stressScore" | "fatigueScore"
): "improving" | "stable" | "worsening" {
  if (entries.length < 4) return "stable"

  const midpoint = Math.floor(entries.length / 2)
  const recent = entries.slice(0, midpoint)
  const older = entries.slice(midpoint)

  const recentAvg = recent.reduce((sum, e) => sum + e[metric], 0) / recent.length
  const olderAvg = older.reduce((sum, e) => sum + e[metric], 0) / older.length

  const diff = recentAvg - olderAvg
  if (diff < -5) return "improving" // lower is better
  if (diff > 5) return "worsening"
  return "stable"
}

function getSuggestionStats(suggestions: Suggestion[]) {
  const completed = suggestions.filter((s) => s.status === "completed" || s.status === "accepted")
  const accepted = suggestions.filter((s) => s.status !== "dismissed" && s.status !== "pending")

  const categoryCounts: Record<string, number> = {}
  for (const s of completed) {
    categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1
  }

  const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])
  const favoriteCategory = sortedCategories[0]?.[0] ?? null
  const completionRate = accepted.length > 0 ? completed.length / accepted.length : 0
  const activeSuggestionsCount = suggestions.filter((s) => s.status === "pending" || s.status === "scheduled").length

  return {
    activeSuggestionsCount,
    completedTotal: completed.length,
    favoriteCategory,
    completionRate,
  }
}

function countSuggestionsCompletedOnDate(suggestions: Suggestion[], timeZone: string, dateISO: string): number {
  return suggestions.filter((s) => {
    if (s.status !== "completed" && s.status !== "accepted") return false
    const timestamp = s.completedAt ?? s.lastUpdatedAt ?? s.createdAt
    return getDateKey(timestamp, timeZone) === dateISO
  }).length
}

function countSuggestionsScheduledOnDate(suggestions: Suggestion[], timeZone: string, dateISO: string): number {
  return suggestions.filter((s) => {
    if (s.status !== "scheduled") return false
    const timestamp = s.lastUpdatedAt ?? s.createdAt
    return getDateKey(timestamp, timeZone) === dateISO
  }).length
}

function collectMetricEntries(recordings: Recording[], sessions: CheckInSession[]) {
  const recordingEntries = recordings
    .filter((r) => !!r.metrics)
    .map((r) => ({
      timestamp: r.createdAt,
      stressScore: r.metrics?.stressScore ?? 0,
      fatigueScore: r.metrics?.fatigueScore ?? 0,
    }))

  const sessionEntries = sessions
    .filter((s) => !!s.acousticMetrics)
    .map((s) => ({
      timestamp: s.startedAt,
      stressScore: s.acousticMetrics?.stressScore ?? 0,
      fatigueScore: s.acousticMetrics?.fatigueScore ?? 0,
    }))

  return [...recordingEntries, ...sessionEntries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}

function calculateMetricAverages(entries: Array<{ stressScore: number; fatigueScore: number }>): {
  averageStressScore: number
  averageFatigueScore: number
} {
  if (entries.length === 0) return { averageStressScore: 0, averageFatigueScore: 0 }
  const stress = entries.reduce((sum, e) => sum + e.stressScore, 0) / entries.length
  const fatigue = entries.reduce((sum, e) => sum + e.fatigueScore, 0) / entries.length
  return { averageStressScore: Math.round(stress), averageFatigueScore: Math.round(fatigue) }
}

/**
 * Collect user stats for daily achievements generation.
 */
export function collectUserStatsForDailyAchievements(input: {
  recordings: Recording[]
  suggestions: Suggestion[]
  sessions: CheckInSession[]
  recentDailyAchievements: DailyAchievement[]
  progress: Pick<UserProgress, "totalPoints" | "level" | "currentDailyCompletionStreak" | "longestDailyCompletionStreak">
  timeZone: string
  todayISO: string
  requestedCount: number
  carryOverCount: number
}): UserStatsForDailyAchievements {
  const voiceDateKeys: string[] = []

  for (const r of input.recordings) {
    voiceDateKeys.push(getDateKey(r.createdAt, input.timeZone))
  }
  for (const s of input.sessions) {
    voiceDateKeys.push(getDateKey(s.startedAt, input.timeZone))
  }

  const uniqueVoiceDays = [...new Set(voiceDateKeys)]

  const checkInsToday =
    input.recordings.filter((r) => getDateKey(r.createdAt, input.timeZone) === input.todayISO).length +
    input.sessions.filter((s) => getDateKey(s.startedAt, input.timeZone) === input.todayISO).length

  const checkInStreak = calculateStreakFromDateKeys(voiceDateKeys, input.todayISO)
  const longestCheckInStreak = calculateLongestStreakFromDateKeys(voiceDateKeys)

  const metricEntries = collectMetricEntries(input.recordings, input.sessions)
  const averages = calculateMetricAverages(metricEntries)
  const trendWindow = metricEntries.slice(0, 14)

  const suggestionStats = getSuggestionStats(input.suggestions)

  return {
    todayISO: input.todayISO,
    timeZone: input.timeZone,
    requestedCount: input.requestedCount,
    carryOverCount: input.carryOverCount,
    // Activity
    totalCheckIns: input.recordings.length + input.sessions.length,
    checkInsToday,
    checkInStreak,
    longestCheckInStreak,
    daysActive: uniqueVoiceDays.length,
    // Wellness
    averageStressScore: averages.averageStressScore,
    averageFatigueScore: averages.averageFatigueScore,
    stressTrend: calculateTrend(trendWindow, "stressScore"),
    fatigueTrend: calculateTrend(trendWindow, "fatigueScore"),
    // Suggestions
    activeSuggestionsCount: suggestionStats.activeSuggestionsCount,
    suggestionsCompletedTotal: suggestionStats.completedTotal,
    suggestionsCompletedToday: countSuggestionsCompletedOnDate(input.suggestions, input.timeZone, input.todayISO),
    suggestionsScheduledToday: countSuggestionsScheduledOnDate(input.suggestions, input.timeZone, input.todayISO),
    favoriteCategory: suggestionStats.favoriteCategory,
    completionRate: suggestionStats.completionRate,
    // Progress
    totalPoints: input.progress.totalPoints,
    level: input.progress.level,
    currentDailyCompletionStreak: input.progress.currentDailyCompletionStreak,
    // Dedupe
    recentDailyTitles: input.recentDailyAchievements.map((a) => a.title),
  }
}

