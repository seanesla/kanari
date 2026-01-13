/**
 * Check-In Context Module
 *
 * Fetches and prepares context from past check-in sessions and voice trends
 * for AI-initiated conversations. This allows the AI to "remember" past
 * conversations and reference patterns when starting a new check-in.
 */

import { db, toCheckInSession, toCommitment, toSuggestion, toTrendData } from "@/lib/storage/db"
import type { CheckInSession, Commitment, Suggestion, TrendData } from "@/lib/types"
import { calculateAverage } from "@/lib/math/statistics"

// ============================================
// Types
// ============================================

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night"
export type TrendDirection = "rising" | "stable" | "falling"

export interface TimeContext {
  currentTime: string // User-local time string (include timezone)
  dayOfWeek: string // e.g., "Monday"
  timeOfDay: TimeOfDay
  daysSinceLastCheckIn: number | null
  lastCheckInTimestamp: string | null
}

export interface VoiceTrends {
  stressTrend: TrendDirection | null
  fatigueTrend: TrendDirection | null
  averageStressLastWeek: number | null
  averageFatigueLastWeek: number | null
}

export interface CheckInContextData {
  recentSessions: CheckInSession[]
  recentTrends: TrendData[]
  timeContext: TimeContext
  voiceTrends: VoiceTrends
  pendingCommitments: Commitment[]
  recentSuggestions: Suggestion[]
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get time of day from hour (0-23)
 */
function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 12) return "morning"
  if (hour >= 12 && hour < 17) return "afternoon"
  if (hour >= 17 && hour < 21) return "evening"
  return "night"
}

/**
 * Get day name from day index (0-6)
 */
function getDayName(dayIndex: number): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  return days[dayIndex] || "Unknown"
}

/**
 * Format a local date/time string for the model prompt.
 * Avoid UTC-only strings (e.g. `toISOString()`) which can imply the wrong time of day for the user.
 * Pattern doc: docs/error-patterns/utc-local-time-mismatch-in-prompts.md
 */
function formatUserLocalTime(now: Date): string {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const formatted = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(now)

  return timeZone ? `${formatted} (${timeZone})` : formatted
}

/**
 * Calculate trend direction from a series of scores
 * Compares the average of the first half to the second half
 */
function calculateTrend(scores: number[]): TrendDirection | null {
  if (scores.length < 2) return null

  const mid = Math.floor(scores.length / 2)
  const firstHalf = scores.slice(0, mid)
  const secondHalf = scores.slice(mid)

  const firstAvg = calculateAverage(firstHalf)
  const secondAvg = calculateAverage(secondHalf)

  const diff = secondAvg - firstAvg
  const threshold = 5 // 5 points difference to be considered a change

  if (diff > threshold) return "rising"
  if (diff < -threshold) return "falling"
  return "stable"
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000 // milliseconds in a day
  return Math.round(Math.abs((date2.getTime() - date1.getTime()) / oneDay))
}

// ============================================
// Main Functions
// ============================================

/**
 * Fetch context data from IndexedDB for AI-initiated conversations.
 *
 * Retrieves:
 * - Recent check-in sessions (last 10)
 * - Recent trend data (last 7 days)
 * - Time context (current time, days since last check-in)
 * - Voice trends (stress/fatigue direction)
 */
export async function fetchCheckInContext(): Promise<CheckInContextData> {
  const now = new Date()

  // Fetch recent check-in sessions (last 10, sorted by startedAt descending)
  const dbSessions = await db.checkInSessions
    .orderBy("startedAt")
    .reverse()
    .limit(10)
    .toArray()

  const recentSessions = dbSessions
    // Message count alone is not reliable (e.g., transcripts may fail to commit before disconnect/end).
    // Prefer "did the user participate" signals like voice metrics.
    // Pattern doc: docs/error-patterns/check-in-results-missing-on-disconnect.md
    .filter(s => (s.messages && s.messages.length > 0) || Boolean(s.acousticMetrics))
    .map(toCheckInSession)

  // Fetch trend data from last 7 days
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const dbTrends = await db.trendData
    .where("date")
    .aboveOrEqual(sevenDaysAgo)
    .toArray()

  const recentTrends = dbTrends.map(toTrendData)

  // Calculate time context
  const lastSession = recentSessions[0] // Most recent
  const timeContext: TimeContext = {
    currentTime: formatUserLocalTime(now),
    dayOfWeek: getDayName(now.getDay()),
    timeOfDay: getTimeOfDay(now.getHours()),
    daysSinceLastCheckIn: lastSession
      ? daysBetween(new Date(lastSession.startedAt), now)
      : null,
    lastCheckInTimestamp: lastSession?.startedAt ?? null,
  }

  // Calculate voice trends from trend data
  const stressScores = recentTrends.map(t => t.stressScore).filter(s => s !== undefined)
  const fatigueScores = recentTrends.map(t => t.fatigueScore).filter(s => s !== undefined)

  const voiceTrends: VoiceTrends = {
    stressTrend: calculateTrend(stressScores),
    fatigueTrend: calculateTrend(fatigueScores),
    averageStressLastWeek: stressScores.length > 0
      ? Math.round(calculateAverage(stressScores))
      : null,
    averageFatigueLastWeek: fatigueScores.length > 0
      ? Math.round(calculateAverage(fatigueScores))
      : null,
  }

  // Fetch pending commitments (not yet resolved)
  let pendingCommitments: Commitment[] = []
  try {
    const dbCommitments = await db.commitments
      .orderBy("extractedAt")
      .reverse()
      .toArray()

    pendingCommitments = dbCommitments
      .filter(c => !c.outcome)
      .slice(0, 8)
      .map(toCommitment)
  } catch {
    // Commitments are optional; ignore failures
  }

  // Fetch recently accepted/scheduled suggestions (to support follow-up)
  let recentSuggestions: Suggestion[] = []
  try {
    const dbSuggestions = await db.suggestions
      .where("status")
      .anyOf(["accepted", "scheduled"])
      .toArray()

    recentSuggestions = dbSuggestions
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 8)
      .map(toSuggestion)
  } catch {
    // Suggestions are optional; ignore failures
  }

  return {
    recentSessions,
    recentTrends,
    timeContext,
    voiceTrends,
    pendingCommitments,
    recentSuggestions,
  }
}

/**
 * Format context data into a structured summary for the API.
 * This is a simplified version that will be sent to the server.
 */
export function formatContextForAPI(context: CheckInContextData): {
  sessionCount: number
  sessionSummaries: Array<{
    startedAt: string
    messageCount: number
    userMessages: string[]
    summary?: {
      overallMood: string
      suggestedActions: string[]
    }
  }>
  timeContext: TimeContext
  voiceTrends: VoiceTrends
  pendingCommitments: Commitment[]
  recentSuggestions: Suggestion[]
} {
  return {
    sessionCount: context.recentSessions.length,
    sessionSummaries: context.recentSessions.slice(0, 5).map(session => ({
      startedAt: session.startedAt,
      messageCount: session.messages.length,
      // Extract user messages content (limited to first 200 chars each)
      userMessages: session.messages
        .filter(m => m.role === "user")
        .map(m => m.content.slice(0, 200))
        .slice(0, 3), // Max 3 messages per session
      summary: session.summary ? {
        overallMood: session.summary.overallMood,
        suggestedActions: session.summary.suggestedActions.slice(0, 2),
      } : undefined,
    })),
    timeContext: context.timeContext,
    voiceTrends: context.voiceTrends,
    pendingCommitments: context.pendingCommitments,
    recentSuggestions: context.recentSuggestions,
  }
}
