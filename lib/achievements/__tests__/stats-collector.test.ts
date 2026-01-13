/**
 * Daily achievements stats collector tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { collectUserStatsForDailyAchievements } from "../stats-collector"
import type { CheckInSession, Recording, Suggestion } from "@/lib/types"
import type { DailyAchievement, UserProgress } from "../types"

function createRecording(id: string, createdAt: string, stressScore = 50, fatigueScore = 50): Recording {
  return {
    id,
    createdAt,
    duration: 30,
    status: "complete",
    metrics: {
      stressScore,
      fatigueScore,
      stressLevel: "moderate",
      fatigueLevel: "moderate",
      confidence: 0.8,
      analyzedAt: createdAt,
    },
  }
}

function createSession(id: string, startedAt: string): CheckInSession {
  return {
    id,
    startedAt,
    messages: [],
  }
}

function createSuggestion(id: string, status: Suggestion["status"], createdAt: string, completedAt?: string): Suggestion {
  return {
    id,
    content: `Suggestion ${id}`,
    rationale: "Test rationale",
    duration: 10,
    category: "break",
    status,
    createdAt,
    lastUpdatedAt: createdAt,
    completedAt,
  }
}

const BASE_PROGRESS: Pick<UserProgress, "totalPoints" | "level" | "currentDailyCompletionStreak" | "longestDailyCompletionStreak"> = {
  totalPoints: 0,
  level: 1,
  currentDailyCompletionStreak: 0,
  longestDailyCompletionStreak: 0,
}

describe("collectUserStatsForDailyAchievements", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-12-28T10:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns stable defaults for empty input", () => {
    const stats = collectUserStatsForDailyAchievements({
      recordings: [],
      suggestions: [],
      sessions: [],
      recentDailyAchievements: [],
      progress: BASE_PROGRESS,
      timeZone: "UTC",
      todayISO: "2025-12-28",
      requestedCount: 3,
      carryOverCount: 0,
    })

    expect(stats.todayISO).toBe("2025-12-28")
    expect(stats.timeZone).toBe("UTC")
    expect(stats.requestedCount).toBe(3)
    expect(stats.carryOverCount).toBe(0)
    expect(stats.totalCheckIns).toBe(0)
    expect(stats.checkInsToday).toBe(0)
    expect(stats.checkInStreak).toBe(0)
    expect(stats.longestCheckInStreak).toBe(0)
    expect(stats.daysActive).toBe(0)
    expect(stats.activeSuggestionsCount).toBe(0)
    expect(stats.suggestionsCompletedTotal).toBe(0)
    expect(stats.suggestionsCompletedToday).toBe(0)
    expect(stats.suggestionsScheduledToday).toBe(0)
    expect(stats.completionRate).toBe(0)
    expect(stats.recentDailyTitles).toEqual([])
  })

  it("computes check-in streak from recordings + sessions", () => {
    const recordings = [
      createRecording("r1", "2025-12-28T01:00:00Z"),
      createRecording("r2", "2025-12-27T01:00:00Z"),
    ]
    const sessions = [createSession("s1", "2025-12-26T23:00:00Z")]

    const stats = collectUserStatsForDailyAchievements({
      recordings,
      suggestions: [],
      sessions,
      recentDailyAchievements: [],
      progress: BASE_PROGRESS,
      timeZone: "UTC",
      todayISO: "2025-12-28",
      requestedCount: 3,
      carryOverCount: 0,
    })

    expect(stats.checkInsToday).toBe(1)
    expect(stats.daysActive).toBe(3)
    expect(stats.checkInStreak).toBe(3)
    expect(stats.longestCheckInStreak).toBe(3)
  })

  it("counts suggestions completed today using completedAt", () => {
    const suggestions = [
      createSuggestion("a", "completed", "2025-12-28T02:00:00Z", "2025-12-28T03:00:00Z"),
      createSuggestion("b", "completed", "2025-12-27T02:00:00Z", "2025-12-27T03:00:00Z"),
      createSuggestion("c", "scheduled", "2025-12-28T02:00:00Z"),
    ]

    const stats = collectUserStatsForDailyAchievements({
      recordings: [],
      suggestions,
      sessions: [],
      recentDailyAchievements: [],
      progress: BASE_PROGRESS,
      timeZone: "UTC",
      todayISO: "2025-12-28",
      requestedCount: 2,
      carryOverCount: 1,
    })

    expect(stats.suggestionsCompletedTotal).toBe(2)
    expect(stats.suggestionsCompletedToday).toBe(1)
    expect(stats.suggestionsScheduledToday).toBe(1)
  })

  it("passes recent titles for dedupe", () => {
    const recent: DailyAchievement[] = [
      {
        id: "1",
        dateISO: "2025-12-27",
        sourceDateISO: "2025-12-27",
        type: "badge",
        category: "engagement",
        title: "Test Title",
        description: "desc",
        emoji: "✨",
        points: 10,
        createdAt: "2025-12-27T10:00:00Z",
        completed: true,
        completedAt: "2025-12-27T10:00:00Z",
        carriedOver: false,
        seen: true,
      },
    ]

    const stats = collectUserStatsForDailyAchievements({
      recordings: [],
      suggestions: [],
      sessions: [],
      recentDailyAchievements: recent,
      progress: BASE_PROGRESS,
      timeZone: "UTC",
      todayISO: "2025-12-28",
      requestedCount: 3,
      carryOverCount: 0,
    })

    expect(stats.recentDailyTitles).toEqual(["Test Title"])
  })
})

