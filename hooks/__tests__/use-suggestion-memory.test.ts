// @vitest-environment jsdom

import { renderHook } from "@testing-library/react"
import { vi, describe, it, expect, beforeAll, afterAll } from "vitest"
import { useSuggestionMemory } from "../use-suggestion-memory"
import type { Suggestion } from "@/lib/types"

const NOW = new Date("2025-12-29T10:00:00Z")

const mockSuggestions: Suggestion[] = [
  {
    id: "s-accepted",
    content: "Take a 10 minute walk outside",
    rationale: "Light movement resets focus",
    duration: 10,
    category: "break",
    status: "accepted",
    createdAt: new Date(NOW.getTime() - 60 * 60 * 1000).toISOString(),
    lastUpdatedAt: new Date(NOW.getTime() - 60 * 60 * 1000).toISOString(),
    effectiveness: {
      rating: "skipped",
      ratedAt: new Date(NOW.getTime() - 60 * 60 * 1000).toISOString(),
    },
  },
  {
    id: "s-completed",
    content: "Stretch before bed",
    rationale: "Relax muscles to improve sleep",
    duration: 5,
    category: "rest",
    status: "completed",
    createdAt: new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedAt: new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    effectiveness: {
      rating: "very_helpful",
      ratedAt: new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
  },
  {
    id: "s-dismissed",
    content: "Long run after work",
    rationale: "High intensity may add stress",
    duration: 45,
    category: "exercise",
    status: "dismissed",
    createdAt: new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    lastUpdatedAt: new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "s-scheduled",
    content: "Schedule a short social call",
    rationale: "Connection boosts mood",
    duration: 15,
    category: "social",
    status: "scheduled",
    createdAt: NOW.toISOString(),
    scheduledFor: new Date(NOW.getTime() + 2 * 60 * 60 * 1000).toISOString(),
  },
]

vi.mock("../use-storage", () => ({
  useAllSuggestions: vi.fn(() => mockSuggestions),
}))

describe("useSuggestionMemory", () => {
  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  it("treats accepted suggestions as completed when building memory context", () => {
    const { result } = renderHook(() => useSuggestionMemory())

    const { memoryContext } = result.current

    expect(memoryContext.stats.totalCompleted).toBe(2)
    expect(memoryContext.completed).toHaveLength(2)
    expect(memoryContext.completed.map((c) => c.content)).toContain("Take a 10 minute walk outside")
    // 2 completed (accepted + completed) out of 4 actionable (completed, accepted, dismissed, scheduled)
    expect(memoryContext.stats.averageCompletionRate).toBe(50)

    // Per-category preferences
    expect(memoryContext.stats.categoryStats.break.completed).toBe(1)
    expect(memoryContext.stats.categoryStats.break.completionRate).toBe(100)
    expect(memoryContext.stats.categoryStats.rest.completed).toBe(1)
    expect(memoryContext.stats.categoryStats.rest.preference).toBe("high")
    expect(memoryContext.stats.categoryStats.exercise.dismissed).toBe(1)
    expect(memoryContext.stats.categoryStats.exercise.preference).toBe("avoid")
    expect(memoryContext.stats.preferredCategories).toEqual(["break", "rest"])
    expect(memoryContext.stats.avoidedCategories).toEqual(["exercise"])

    // Effectiveness feedback (skipped is excluded)
    expect(memoryContext.stats.effectivenessByCategory.rest.totalRatings).toBe(1)
    expect(memoryContext.stats.effectivenessByCategory.rest.helpfulRate).toBe(100)
    expect(memoryContext.stats.effectivenessByCategory.break.totalRatings).toBe(0)
  })
})
