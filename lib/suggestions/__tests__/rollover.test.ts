import { describe, expect, it } from "vitest"
import { computeExpiredSuggestionIds } from "@/lib/suggestions/rollover"

describe("computeExpiredSuggestionIds", () => {
  it("expires pending suggestions created before today", () => {
    const { expiredSuggestionIds } = computeExpiredSuggestionIds({
      timeZone: "UTC",
      nowISO: "2026-01-10T12:00:00Z",
      suggestions: [
        {
          id: "old",
          content: "Old",
          rationale: "r",
          duration: 10,
          category: "break",
          status: "pending",
          createdAt: "2026-01-09T10:00:00Z",
        },
        {
          id: "today",
          content: "Today",
          rationale: "r",
          duration: 10,
          category: "break",
          status: "pending",
          createdAt: "2026-01-10T08:00:00Z",
        },
      ],
    })

    expect(expiredSuggestionIds).toEqual(["old"])
  })

  it("expires scheduled suggestions whose scheduledFor day is before today", () => {
    const { expiredSuggestionIds } = computeExpiredSuggestionIds({
      timeZone: "UTC",
      nowISO: "2026-01-10T12:00:00Z",
      suggestions: [
        {
          id: "missed",
          content: "Missed",
          rationale: "r",
          duration: 30,
          category: "exercise",
          status: "scheduled",
          createdAt: "2026-01-09T09:00:00Z",
          scheduledFor: "2026-01-09T10:00:00Z",
        },
        {
          id: "future",
          content: "Future",
          rationale: "r",
          duration: 30,
          category: "exercise",
          status: "scheduled",
          createdAt: "2026-01-09T09:00:00Z",
          scheduledFor: "2026-01-11T10:00:00Z",
        },
      ],
    })

    expect(expiredSuggestionIds).toEqual(["missed"])
  })

  it("uses the provided timeZone when deciding the day boundary", () => {
    // 2026-01-10T06:30Z is still 2026-01-09 in America/Los_Angeles.
    const { expiredSuggestionIds, todayISO } = computeExpiredSuggestionIds({
      timeZone: "America/Los_Angeles",
      nowISO: "2026-01-10T06:30:00Z",
      suggestions: [
        {
          id: "sameLocalDay",
          content: "Same day",
          rationale: "r",
          duration: 10,
          category: "rest",
          status: "pending",
          createdAt: "2026-01-10T02:00:00Z",
        },
      ],
    })

    expect(todayISO).toBe("2026-01-09")
    expect(expiredSuggestionIds).toEqual([])
  })
})
