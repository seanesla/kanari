/**
 * Stats Collector Tests
 *
 * Comprehensive tests for the achievement stats collection functions.
 * These stats are used by Gemini to generate personalized achievements.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { collectUserStats } from "../stats-collector"
import type { Recording, Suggestion, CheckInSession } from "@/lib/types"
import type { StoredAchievement } from "../types"

// ============================================
// Test Helpers
// ============================================

/**
 * Create a mock recording at a specific date/time
 */
function createRecording(
  id: string,
  createdAt: string,
  stressScore = 50,
  fatigueScore = 50
): Recording {
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

/**
 * Create a mock suggestion
 */
function createSuggestion(
  id: string,
  status: Suggestion["status"],
  category: Suggestion["category"],
  effectiveness?: { rating: "very_helpful" | "somewhat_helpful" | "not_helpful" | "skipped"; timestamp: string }
): Suggestion {
  return {
    id,
    recordingId: "rec-1",
    category,
    content: `Test Suggestion ${id}`,
    rationale: "Test rationale",
    duration: 15,
    status,
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    effectiveness: effectiveness as Suggestion["effectiveness"],
  }
}

/**
 * Create a mock check-in session
 */
function createSession(id: string, startedAt: string, duration?: number): CheckInSession {
  return {
    id,
    startedAt,
    messages: [],
    duration,
  }
}

/**
 * Generate dates for consecutive days ending today
 */
function generateConsecutiveDates(count: number, endDate: Date = new Date()): string[] {
  const dates: string[] = []
  for (let i = 0; i < count; i++) {
    const date = new Date(endDate)
    date.setDate(date.getDate() - i)
    dates.push(date.toISOString())
  }
  return dates
}

// ============================================
// Tests
// ============================================

describe("stats-collector", () => {
  beforeEach(() => {
    // Mock current date to be consistent
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-12-28T10:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("collectUserStats", () => {
    it("returns default values for empty data", () => {
      const stats = collectUserStats([], [], [], [])

      expect(stats.totalRecordings).toBe(0)
      expect(stats.recordingsThisWeek).toBe(0)
      expect(stats.recordingStreak).toBe(0)
      expect(stats.longestStreak).toBe(0)
      expect(stats.preferredTimeOfDay).toBe("varied")
      expect(stats.mostActiveDay).toBe("None")
      expect(stats.averageStressScore).toBe(0)
      expect(stats.averageFatigueScore).toBe(0)
      expect(stats.stressTrend).toBe("stable")
      expect(stats.fatigueTrend).toBe("stable")
      expect(stats.suggestionsCompleted).toBe(0)
      expect(stats.completionRate).toBe(0)
      expect(stats.daysActive).toBe(0)
    })

    it("calculates total recordings correctly", () => {
      const recordings = [
        createRecording("1", "2025-12-28T10:00:00Z"),
        createRecording("2", "2025-12-27T10:00:00Z"),
        createRecording("3", "2025-12-26T10:00:00Z"),
      ]

      const stats = collectUserStats(recordings, [], [], [])
      expect(stats.totalRecordings).toBe(3)
    })

    it("includes recent achievement titles for deduplication", () => {
      const achievements: StoredAchievement[] = [
        {
          id: "1",
          title: "Morning Champion",
          description: "desc",
          category: "pattern",
          rarity: "common",
          earnedAt: "2025-12-27T00:00:00Z",
          insight: "insight",
          emoji: "🌅",
          seen: false,
        },
        {
          id: "2",
          title: "Streak Master",
          description: "desc",
          category: "streak",
          rarity: "rare",
          earnedAt: "2025-12-26T00:00:00Z",
          insight: "insight",
          emoji: "🔥",
          seen: true,
        },
      ]

      const stats = collectUserStats([], [], [], achievements)
      expect(stats.recentAchievementTitles).toEqual(["Morning Champion", "Streak Master"])
    })
  })

  describe("streak calculation", () => {
    it("returns 0 for no recordings", () => {
      const stats = collectUserStats([], [], [], [])
      expect(stats.recordingStreak).toBe(0)
    })

    it("returns 1 for recording today only", () => {
      const recordings = [createRecording("1", "2025-12-28T10:00:00Z")]
      const stats = collectUserStats(recordings, [], [], [])
      expect(stats.recordingStreak).toBe(1)
    })

    it("returns 1 for recording yesterday only (streak still active)", () => {
      const recordings = [createRecording("1", "2025-12-27T10:00:00Z")]
      const stats = collectUserStats(recordings, [], [], [])
      expect(stats.recordingStreak).toBe(1)
    })

    it("returns 0 for recording 2 days ago (streak broken)", () => {
      const recordings = [createRecording("1", "2025-12-26T10:00:00Z")]
      const stats = collectUserStats(recordings, [], [], [])
      expect(stats.recordingStreak).toBe(0)
    })

    it("counts consecutive days correctly", () => {
      // 5 consecutive days ending today
      const dates = generateConsecutiveDates(5)
      const recordings = dates.map((d, i) => createRecording(`${i}`, d))

      const stats = collectUserStats(recordings, [], [], [])
      expect(stats.recordingStreak).toBe(5)
    })

    it("handles multiple recordings on same day", () => {
      const recordings = [
        createRecording("1", "2025-12-28T08:00:00Z"),
        createRecording("2", "2025-12-28T12:00:00Z"),
        createRecording("3", "2025-12-28T18:00:00Z"),
        createRecording("4", "2025-12-27T10:00:00Z"),
        createRecording("5", "2025-12-26T10:00:00Z"),
      ]

      const stats = collectUserStats(recordings, [], [], [])
      expect(stats.recordingStreak).toBe(3) // 3 unique days
    })

    it("breaks streak when there's a gap", () => {
      const recordings = [
        createRecording("1", "2025-12-28T10:00:00Z"),
        createRecording("2", "2025-12-27T10:00:00Z"),
        // Gap on 26th
        createRecording("3", "2025-12-25T10:00:00Z"),
        createRecording("4", "2025-12-24T10:00:00Z"),
      ]

      const stats = collectUserStats(recordings, [], [], [])
      expect(stats.recordingStreak).toBe(2) // Only Dec 27-28
    })
  })

  describe("longest streak calculation", () => {
    it("tracks longest streak even if not current", () => {
      const recordings = [
        // Current streak: 2 days
        createRecording("1", "2025-12-28T10:00:00Z"),
        createRecording("2", "2025-12-27T10:00:00Z"),
        // Gap
        // Old streak: 5 days
        createRecording("3", "2025-12-20T10:00:00Z"),
        createRecording("4", "2025-12-19T10:00:00Z"),
        createRecording("5", "2025-12-18T10:00:00Z"),
        createRecording("6", "2025-12-17T10:00:00Z"),
        createRecording("7", "2025-12-16T10:00:00Z"),
      ]

      const stats = collectUserStats(recordings, [], [], [])
      expect(stats.recordingStreak).toBe(2) // Current streak
      expect(stats.longestStreak).toBe(5) // Historical best
    })
  })

  describe("preferred time of day", () => {
    it("returns varied for fewer than 3 recordings", () => {
      const recordings = [
        createRecording("1", "2025-12-28T08:00:00Z"),
        createRecording("2", "2025-12-27T08:00:00Z"),
      ]

      const stats = collectUserStats(recordings, [], [], [])
      expect(stats.preferredTimeOfDay).toBe("varied")
    })

    it("detects morning preference (5am-12pm)", () => {
      // Use local timestamps (no Z suffix) to avoid timezone issues
      const recordings = [
        createRecording("1", "2025-12-28T08:00:00"),
        createRecording("2", "2025-12-27T09:00:00"),
        createRecording("3", "2025-12-26T07:00:00"),
        createRecording("4", "2025-12-25T10:00:00"),
      ]

      const stats = collectUserStats(recordings, [], [], [])
      expect(stats.preferredTimeOfDay).toBe("morning")
    })

    it("detects afternoon preference (12pm-5pm)", () => {
      const recordings = [
        createRecording("1", "2025-12-28T14:00:00"),
        createRecording("2", "2025-12-27T13:00:00"),
        createRecording("3", "2025-12-26T15:00:00"),
        createRecording("4", "2025-12-25T14:00:00"),
      ]

      const stats = collectUserStats(recordings, [], [], [])
      expect(stats.preferredTimeOfDay).toBe("afternoon")
    })

    it("detects evening preference (5pm-9pm)", () => {
      const recordings = [
        createRecording("1", "2025-12-28T18:00:00"),
        createRecording("2", "2025-12-27T19:00:00"),
        createRecording("3", "2025-12-26T17:00:00"),
        createRecording("4", "2025-12-25T20:00:00"),
      ]

      const stats = collectUserStats(recordings, [], [], [])
      expect(stats.preferredTimeOfDay).toBe("evening")
    })

    it("detects night preference (9pm-5am)", () => {
      const recordings = [
        createRecording("1", "2025-12-28T23:00:00"),
        createRecording("2", "2025-12-27T22:00:00"),
        createRecording("3", "2025-12-26T02:00:00"),
        createRecording("4", "2025-12-25T01:00:00"),
      ]

      const stats = collectUserStats(recordings, [], [], [])
      expect(stats.preferredTimeOfDay).toBe("night")
    })

    it("returns varied when no clear preference", () => {
      const recordings = [
        createRecording("1", "2025-12-28T08:00:00Z"), // morning
        createRecording("2", "2025-12-27T14:00:00Z"), // afternoon
        createRecording("3", "2025-12-26T18:00:00Z"), // evening
        createRecording("4", "2025-12-25T23:00:00Z"), // night
      ]

      const stats = collectUserStats(recordings, [], [], [])
      expect(stats.preferredTimeOfDay).toBe("varied")
    })
  })

  describe("most active day", () => {
    it("returns None for no recordings", () => {
      const stats = collectUserStats([], [], [], [])
      expect(stats.mostActiveDay).toBe("None")
    })

    it("identifies the most active day", () => {
      // Create recordings weighted toward Monday
      // Use local timestamps (no Z suffix) to avoid timezone issues
      const recordings = [
        // 3 on Monday (Dec 22, 2025 is Monday)
        createRecording("1", "2025-12-21T10:00:00"), // Sunday
        createRecording("2", "2025-12-22T10:00:00"), // Monday
        createRecording("3", "2025-12-22T14:00:00"), // Monday
        createRecording("4", "2025-12-22T18:00:00"), // Monday
        createRecording("5", "2025-12-23T10:00:00"), // Tuesday
      ]

      const stats = collectUserStats(recordings, [], [], [])
      expect(stats.mostActiveDay).toBe("Monday")
    })
  })

  describe("stress and fatigue averages", () => {
    it("returns 0 for no recordings with metrics", () => {
      const stats = collectUserStats([], [], [], [])
      expect(stats.averageStressScore).toBe(0)
      expect(stats.averageFatigueScore).toBe(0)
    })

    it("calculates averages correctly", () => {
      const recordings = [
        createRecording("1", "2025-12-28T10:00:00Z", 30, 40),
        createRecording("2", "2025-12-27T10:00:00Z", 50, 60),
        createRecording("3", "2025-12-26T10:00:00Z", 70, 80),
      ]

      const stats = collectUserStats(recordings, [], [], [])
      expect(stats.averageStressScore).toBe(50) // (30+50+70)/3
      expect(stats.averageFatigueScore).toBe(60) // (40+60+80)/3
    })
  })

  describe("stress and fatigue trends", () => {
    it("returns stable for fewer than 3 recordings", () => {
      const recordings = [
        createRecording("1", "2025-12-28T10:00:00Z", 70, 70),
        createRecording("2", "2025-12-27T10:00:00Z", 50, 50),
      ]

      const stats = collectUserStats(recordings, [], [], [])
      expect(stats.stressTrend).toBe("stable")
      expect(stats.fatigueTrend).toBe("stable")
    })

    it("detects improving trend (scores decreasing)", () => {
      // Recent recordings have lower scores (better)
      const recordings = [
        createRecording("1", "2025-12-28T10:00:00Z", 30, 35),
        createRecording("2", "2025-12-27T10:00:00Z", 35, 40),
        createRecording("3", "2025-12-26T10:00:00Z", 40, 45),
        createRecording("4", "2025-12-25T10:00:00Z", 60, 65),
        createRecording("5", "2025-12-24T10:00:00Z", 65, 70),
        createRecording("6", "2025-12-23T10:00:00Z", 70, 75),
      ]

      const stats = collectUserStats(recordings, [], [], [])
      expect(stats.stressTrend).toBe("improving")
      expect(stats.fatigueTrend).toBe("improving")
    })

    it("detects worsening trend (scores increasing)", () => {
      // Recent recordings have higher scores (worse)
      const recordings = [
        createRecording("1", "2025-12-28T10:00:00Z", 70, 75),
        createRecording("2", "2025-12-27T10:00:00Z", 65, 70),
        createRecording("3", "2025-12-26T10:00:00Z", 60, 65),
        createRecording("4", "2025-12-25T10:00:00Z", 30, 35),
        createRecording("5", "2025-12-24T10:00:00Z", 35, 40),
        createRecording("6", "2025-12-23T10:00:00Z", 40, 45),
      ]

      const stats = collectUserStats(recordings, [], [], [])
      expect(stats.stressTrend).toBe("worsening")
      expect(stats.fatigueTrend).toBe("worsening")
    })

    it("detects stable trend (small changes)", () => {
      // Scores stay roughly the same
      const recordings = [
        createRecording("1", "2025-12-28T10:00:00Z", 52, 51),
        createRecording("2", "2025-12-27T10:00:00Z", 48, 49),
        createRecording("3", "2025-12-26T10:00:00Z", 50, 50),
        createRecording("4", "2025-12-25T10:00:00Z", 51, 52),
        createRecording("5", "2025-12-24T10:00:00Z", 49, 48),
        createRecording("6", "2025-12-23T10:00:00Z", 50, 50),
      ]

      const stats = collectUserStats(recordings, [], [], [])
      expect(stats.stressTrend).toBe("stable")
      expect(stats.fatigueTrend).toBe("stable")
    })
  })

  describe("suggestion stats", () => {
    it("counts completed suggestions", () => {
      const suggestions = [
        createSuggestion("1", "completed", "mindfulness"),
        createSuggestion("2", "completed", "exercise"),
        createSuggestion("3", "accepted", "rest"), // accepted counts as completed
        createSuggestion("4", "pending", "mindfulness"),
        createSuggestion("5", "dismissed", "break"),
      ]

      const stats = collectUserStats([], suggestions, [], [])
      expect(stats.suggestionsCompleted).toBe(3) // completed + accepted
      expect(stats.suggestionsDismissed).toBe(1)
    })

    it("calculates completion rate correctly", () => {
      const suggestions = [
        createSuggestion("1", "completed", "mindfulness"),
        createSuggestion("2", "completed", "exercise"),
        createSuggestion("3", "scheduled", "rest"),
        createSuggestion("4", "dismissed", "break"), // Not counted in rate
        createSuggestion("5", "pending", "mindfulness"), // Not counted in rate
      ]

      const stats = collectUserStats([], suggestions, [], [])
      // 2 completed out of 3 non-pending/non-dismissed = 66.7%
      expect(stats.completionRate).toBeCloseTo(0.667, 2)
    })

    it("identifies favorite category", () => {
      const suggestions = [
        createSuggestion("1", "completed", "mindfulness"),
        createSuggestion("2", "completed", "mindfulness"),
        createSuggestion("3", "completed", "mindfulness"),
        createSuggestion("4", "completed", "exercise"),
        createSuggestion("5", "completed", "rest"),
      ]

      const stats = collectUserStats([], suggestions, [], [])
      expect(stats.favoriteCategory).toBe("mindfulness")
    })

    it("counts helpful suggestions with feedback", () => {
      const suggestions = [
        createSuggestion("1", "completed", "mindfulness", {
          rating: "very_helpful",
          timestamp: "2025-12-28T10:00:00Z",
        }),
        createSuggestion("2", "completed", "exercise", {
          rating: "somewhat_helpful",
          timestamp: "2025-12-27T10:00:00Z",
        }),
        createSuggestion("3", "completed", "rest", {
          rating: "not_helpful",
          timestamp: "2025-12-26T10:00:00Z",
        }),
        createSuggestion("4", "completed", "break"), // No feedback
      ]

      const stats = collectUserStats([], suggestions, [], [])
      expect(stats.helpfulSuggestionsCount).toBe(2) // very_helpful + somewhat_helpful
      expect(stats.totalFeedbackGiven).toBe(3) // All with feedback
    })
  })

  describe("session stats", () => {
    it("counts total sessions", () => {
      const sessions = [
        createSession("1", "2025-12-28T10:00:00Z", 120),
        createSession("2", "2025-12-27T10:00:00Z", 180),
        createSession("3", "2025-12-26T10:00:00Z", 90),
      ]

      const stats = collectUserStats([], [], sessions, [])
      expect(stats.totalCheckInSessions).toBe(3)
    })

    it("calculates average session duration", () => {
      const sessions = [
        createSession("1", "2025-12-28T10:00:00Z", 120),
        createSession("2", "2025-12-27T10:00:00Z", 180),
        createSession("3", "2025-12-26T10:00:00Z", 60),
      ]

      const stats = collectUserStats([], [], sessions, [])
      expect(stats.averageSessionDuration).toBe(120) // (120+180+60)/3
    })

    it("handles sessions without duration", () => {
      const sessions = [
        createSession("1", "2025-12-28T10:00:00Z", 120),
        createSession("2", "2025-12-27T10:00:00Z", undefined), // No duration
        createSession("3", "2025-12-26T10:00:00Z", 60),
      ]

      const stats = collectUserStats([], [], sessions, [])
      expect(stats.averageSessionDuration).toBe(90) // (120+60)/2, ignoring undefined
    })
  })

  describe("days active", () => {
    it("counts unique days across recordings and sessions", () => {
      const recordings = [
        createRecording("1", "2025-12-28T10:00:00Z"),
        createRecording("2", "2025-12-28T14:00:00Z"), // Same day
        createRecording("3", "2025-12-27T10:00:00Z"),
      ]

      const sessions = [
        createSession("1", "2025-12-26T10:00:00Z", 120),
        createSession("2", "2025-12-28T18:00:00Z", 60), // Same day as recording
      ]

      const stats = collectUserStats(recordings, [], sessions, [])
      expect(stats.daysActive).toBe(3) // Dec 26, 27, 28
    })
  })

  describe("recordings this week", () => {
    it("counts recordings in current week (Sunday to Saturday)", () => {
      // Dec 28, 2025 is Sunday. Week starts Dec 28 (Sunday)
      // Use local timestamps (no Z suffix) to avoid timezone issues
      const recordings = [
        createRecording("1", "2025-12-28T10:00:00"), // Sunday (this week - today)
        createRecording("2", "2025-12-27T10:00:00"), // Saturday (last week)
        createRecording("3", "2025-12-26T10:00:00"), // Friday (last week)
        createRecording("4", "2025-12-21T10:00:00"), // Sunday (last week)
        createRecording("5", "2025-12-15T10:00:00"), // Two weeks ago
      ]

      const stats = collectUserStats(recordings, [], [], [])
      expect(stats.recordingsThisWeek).toBe(1) // Only Dec 28
    })
  })

  describe("first recording date", () => {
    it("returns null for no recordings", () => {
      const stats = collectUserStats([], [], [], [])
      expect(stats.firstRecordingDate).toBeNull()
    })

    it("returns date of first recording", () => {
      const recordings = [
        createRecording("1", "2025-12-28T10:00:00Z"),
        createRecording("2", "2025-12-01T10:00:00Z"), // First
        createRecording("3", "2025-12-15T10:00:00Z"),
      ]

      const stats = collectUserStats(recordings, [], [], [])
      expect(stats.firstRecordingDate).toBe("2025-12-01")
    })
  })
})
