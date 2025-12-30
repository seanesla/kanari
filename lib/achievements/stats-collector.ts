/**
 * Stats Collector for Achievement Generation
 *
 * Gathers user stats from various sources (recordings, suggestions, sessions)
 * to build the context needed for Gemini to generate personalized achievements.
 */

import type { Recording, Suggestion, CheckInSession } from "@/lib/types"
import type { UserStatsForAchievements, StoredAchievement } from "./types"

/**
 * Calculate the current recording streak (consecutive days)
 */
function calculateStreak(recordings: Recording[]): number {
  if (recordings.length === 0) return 0

  // Sort by date descending
  const sorted = [...recordings].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  // Get unique dates
  const dates = [...new Set(sorted.map(r => r.createdAt.split("T")[0]))]
  if (dates.length === 0) return 0

  // Check if user has recorded today or yesterday (streak is active)
  const today = new Date().toISOString().split("T")[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0]

  if (dates[0] !== today && dates[0] !== yesterday) {
    return 0 // Streak is broken
  }

  // Count consecutive days
  let streak = 1
  for (let i = 1; i < dates.length; i++) {
    const prevDate = new Date(dates[i - 1])
    const currDate = new Date(dates[i])
    const diffDays = Math.round((prevDate.getTime() - currDate.getTime()) / 86400000)

    if (diffDays === 1) {
      streak++
    } else {
      break
    }
  }

  return streak
}

/**
 * Calculate the longest streak ever
 */
function calculateLongestStreak(recordings: Recording[]): number {
  if (recordings.length === 0) return 0

  // Get unique dates sorted ascending
  const dates = [...new Set(recordings.map(r => r.createdAt.split("T")[0]))].sort()
  if (dates.length === 0) return 0

  let maxStreak = 1
  let currentStreak = 1

  for (let i = 1; i < dates.length; i++) {
    const prevDate = new Date(dates[i - 1])
    const currDate = new Date(dates[i])
    const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / 86400000)

    if (diffDays === 1) {
      currentStreak++
      maxStreak = Math.max(maxStreak, currentStreak)
    } else {
      currentStreak = 1
    }
  }

  return maxStreak
}

/**
 * Determine preferred time of day based on recording timestamps
 */
function getPreferredTimeOfDay(recordings: Recording[]): UserStatsForAchievements["preferredTimeOfDay"] {
  if (recordings.length < 3) return "varied"

  const hourCounts = { morning: 0, afternoon: 0, evening: 0, night: 0 }

  for (const recording of recordings) {
    const hour = new Date(recording.createdAt).getHours()
    if (hour >= 5 && hour < 12) hourCounts.morning++
    else if (hour >= 12 && hour < 17) hourCounts.afternoon++
    else if (hour >= 17 && hour < 21) hourCounts.evening++
    else hourCounts.night++
  }

  const total = recordings.length
  const entries = Object.entries(hourCounts) as [keyof typeof hourCounts, number][]
  const sorted = entries.sort((a, b) => b[1] - a[1])

  // If top preference is more than 50%, it's their preferred time
  if (sorted[0][1] / total > 0.5) {
    return sorted[0][0]
  }

  return "varied"
}

/**
 * Get most active day of the week
 */
function getMostActiveDay(recordings: Recording[]): string {
  if (recordings.length === 0) return "None"

  const dayCounts: Record<string, number> = {
    Sunday: 0, Monday: 0, Tuesday: 0, Wednesday: 0,
    Thursday: 0, Friday: 0, Saturday: 0
  }

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

  for (const recording of recordings) {
    const day = dayNames[new Date(recording.createdAt).getDay()]
    dayCounts[day]++
  }

  const sorted = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])
  return sorted[0][0]
}

/**
 * Calculate average stress and fatigue scores
 */
function calculateAverages(recordings: Recording[]): { stress: number; fatigue: number } {
  const withMetrics = recordings.filter(r => r.metrics)
  if (withMetrics.length === 0) return { stress: 0, fatigue: 0 }

  const totalStress = withMetrics.reduce((sum, r) => sum + (r.metrics?.stressScore || 0), 0)
  const totalFatigue = withMetrics.reduce((sum, r) => sum + (r.metrics?.fatigueScore || 0), 0)

  return {
    stress: Math.round(totalStress / withMetrics.length),
    fatigue: Math.round(totalFatigue / withMetrics.length),
  }
}

/**
 * Calculate trend direction from recordings
 */
function calculateTrend(recordings: Recording[], metric: "stressScore" | "fatigueScore"): "improving" | "stable" | "worsening" {
  const withMetrics = recordings.filter(r => r.metrics).slice(0, 14) // Last 2 weeks
  if (withMetrics.length < 3) return "stable"

  // Compare recent average to older average
  const midpoint = Math.floor(withMetrics.length / 2)
  const recent = withMetrics.slice(0, midpoint)
  const older = withMetrics.slice(midpoint)

  const recentAvg = recent.reduce((sum, r) => sum + (r.metrics?.[metric] || 0), 0) / recent.length
  const olderAvg = older.reduce((sum, r) => sum + (r.metrics?.[metric] || 0), 0) / older.length

  const diff = recentAvg - olderAvg
  if (diff < -5) return "improving" // Lower is better
  if (diff > 5) return "worsening"
  return "stable"
}

/**
 * Get suggestion category stats
 */
function getSuggestionStats(suggestions: Suggestion[]): {
  completed: number
  scheduled: number
  dismissed: number
  favoriteCategory: string | null
  leastUsedCategory: string | null
  completionRate: number
  helpfulCount: number
  feedbackCount: number
} {
  const completed = suggestions.filter(s => s.status === "completed" || s.status === "accepted")
  const scheduled = suggestions.filter(s => s.status === "scheduled")
  const dismissed = suggestions.filter(s => s.status === "dismissed")

  // Count by category
  const categoryCounts: Record<string, number> = {}
  for (const s of completed) {
    categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1
  }

  const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])
  const favoriteCategory = sortedCategories[0]?.[0] || null
  const leastUsedCategory = sortedCategories.length > 1 ? sortedCategories[sortedCategories.length - 1][0] : null

  // Calculate completion rate
  const accepted = suggestions.filter(s => s.status !== "dismissed" && s.status !== "pending")
  const completionRate = accepted.length > 0 ? completed.length / accepted.length : 0

  // Count effectiveness feedback
  const withFeedback = completed.filter(s => s.effectiveness)
  const helpful = withFeedback.filter(
    s => s.effectiveness?.rating === "very_helpful" || s.effectiveness?.rating === "somewhat_helpful"
  )

  return {
    completed: completed.length,
    scheduled: scheduled.length,
    dismissed: dismissed.length,
    favoriteCategory,
    leastUsedCategory,
    completionRate,
    helpfulCount: helpful.length,
    feedbackCount: withFeedback.length,
  }
}

/**
 * Get check-in session stats
 */
function getSessionStats(sessions: CheckInSession[]): { total: number; avgDuration: number } {
  if (sessions.length === 0) return { total: 0, avgDuration: 0 }

  const withDuration = sessions.filter(s => s.duration !== undefined)
  const avgDuration = withDuration.length > 0
    ? withDuration.reduce((sum, s) => sum + (s.duration || 0), 0) / withDuration.length
    : 0

  return {
    total: sessions.length,
    avgDuration,
  }
}

/**
 * Count recordings in the current week (Sunday to Saturday)
 */
function countRecordingsThisWeek(recordings: Recording[]): number {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - dayOfWeek)
  startOfWeek.setHours(0, 0, 0, 0)

  return recordings.filter(r => new Date(r.createdAt) >= startOfWeek).length
}

/**
 * Count unique days with activity
 */
function countDaysActive(recordings: Recording[], sessions: CheckInSession[]): number {
  const dates = new Set<string>()

  for (const r of recordings) {
    dates.add(r.createdAt.split("T")[0])
  }

  for (const s of sessions) {
    dates.add(s.startedAt.split("T")[0])
  }

  return dates.size
}

/**
 * Collect all user stats for achievement generation
 *
 * @param recordings - All user recordings
 * @param suggestions - All suggestions
 * @param sessions - All check-in sessions
 * @param recentAchievements - Recently earned achievements (to avoid duplicates)
 */
export function collectUserStats(
  recordings: Recording[],
  suggestions: Suggestion[],
  sessions: CheckInSession[],
  recentAchievements: StoredAchievement[]
): UserStatsForAchievements {
  // Sort recordings by date descending (most recent first)
  const sortedRecordings = [...recordings].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const averages = calculateAverages(sortedRecordings)
  const suggestionStats = getSuggestionStats(suggestions)
  const sessionStats = getSessionStats(sessions)

  return {
    // Recording stats
    totalRecordings: recordings.length,
    recordingsThisWeek: countRecordingsThisWeek(sortedRecordings),
    recordingStreak: calculateStreak(sortedRecordings),
    longestStreak: calculateLongestStreak(sortedRecordings),

    // Time patterns
    preferredTimeOfDay: getPreferredTimeOfDay(sortedRecordings),
    mostActiveDay: getMostActiveDay(sortedRecordings),

    // Stress & fatigue trends
    averageStressScore: averages.stress,
    averageFatigueScore: averages.fatigue,
    stressTrend: calculateTrend(sortedRecordings, "stressScore"),
    fatigueTrend: calculateTrend(sortedRecordings, "fatigueScore"),
    lowestStressDay: null, // TODO: implement if needed
    highestImprovementDay: null, // TODO: implement if needed

    // Suggestion engagement
    suggestionsCompleted: suggestionStats.completed,
    suggestionsScheduled: suggestionStats.scheduled,
    suggestionsDismissed: suggestionStats.dismissed,
    favoriteCategory: suggestionStats.favoriteCategory,
    leastUsedCategory: suggestionStats.leastUsedCategory,
    completionRate: suggestionStats.completionRate,

    // Effectiveness feedback
    helpfulSuggestionsCount: suggestionStats.helpfulCount,
    totalFeedbackGiven: suggestionStats.feedbackCount,

    // Check-in sessions
    totalCheckInSessions: sessionStats.total,
    averageSessionDuration: sessionStats.avgDuration,

    // Milestones
    daysActive: countDaysActive(sortedRecordings, sessions),
    firstRecordingDate: sortedRecordings.length > 0
      ? sortedRecordings[sortedRecordings.length - 1].createdAt.split("T")[0]
      : null,

    // Recent achievements (to avoid duplicates)
    recentAchievementTitles: recentAchievements.map(a => a.title),
  }
}
