import { describe, expect, it } from "vitest"
import { Temporal } from "temporal-polyfill"
import { expandRecurringScheduleOccurrences } from "@/lib/scheduling/recurrence"

describe("scheduling/recurrence", () => {
  it("expands daily recurrences by count", () => {
    const result = expandRecurringScheduleOccurrences({
      startDate: "2026-02-01",
      time: "09:30",
      timeZone: "UTC",
      frequency: "daily",
      count: 3,
    })

    expect(result.truncated).toBe(false)
    expect(result.skippedInvalidDateTimes).toBe(0)
    expect(result.occurrences.map((o) => o.date)).toEqual([
      "2026-02-01",
      "2026-02-02",
      "2026-02-03",
    ])
    expect(result.occurrences[0]?.scheduledFor).toBe("2026-02-01T09:30:00Z")
  })

  it("supports weekday-only recurrences", () => {
    const result = expandRecurringScheduleOccurrences({
      startDate: "2026-02-06", // Friday
      time: "09:00",
      timeZone: "UTC",
      frequency: "weekdays",
      count: 3,
    })

    expect(result.occurrences.map((o) => o.date)).toEqual([
      "2026-02-06",
      "2026-02-09",
      "2026-02-10",
    ])
  })

  it("supports custom weekday recurrences", () => {
    const result = expandRecurringScheduleOccurrences({
      startDate: "2026-02-01",
      time: "6:15 PM",
      timeZone: "UTC",
      frequency: "custom_weekdays",
      weekdays: ["mon", "wed"],
      count: 4,
    })

    expect(result.occurrences.map((o) => o.date)).toEqual([
      "2026-02-02",
      "2026-02-04",
      "2026-02-09",
      "2026-02-11",
    ])
    expect(result.occurrences.every((o) => o.time === "18:15")).toBe(true)
  })

  it("supports weekly recurrences with untilDate", () => {
    const result = expandRecurringScheduleOccurrences({
      startDate: "2026-02-01",
      time: "10:00",
      timeZone: "UTC",
      frequency: "weekly",
      untilDate: "2026-02-22",
    })

    expect(result.occurrences.map((o) => o.date)).toEqual([
      "2026-02-01",
      "2026-02-08",
      "2026-02-15",
      "2026-02-22",
    ])
  })

  it("applies the safety cap to long recurring plans", () => {
    const result = expandRecurringScheduleOccurrences({
      startDate: "2026-02-01",
      time: "09:00",
      timeZone: "UTC",
      frequency: "daily",
      count: 100,
      maxOccurrences: 5,
    })

    expect(result.truncated).toBe(true)
    expect(result.occurrences).toHaveLength(5)
  })

  it("returns no occurrences when untilDate is before startDate", () => {
    const result = expandRecurringScheduleOccurrences({
      startDate: "2026-02-10",
      time: "09:00",
      timeZone: "UTC",
      frequency: "daily",
      untilDate: "2026-02-09",
    })

    expect(result.occurrences).toHaveLength(0)
    expect(result.truncated).toBe(false)
  })

  it("requires a stop condition", () => {
    expect(() =>
      expandRecurringScheduleOccurrences({
        startDate: "2026-02-01",
        time: "09:00",
        timeZone: "UTC",
        frequency: "daily",
      })
    ).toThrow(/count or untilDate/i)
  })

  it("requires weekdays for custom weekday recurrences", () => {
    expect(() =>
      expandRecurringScheduleOccurrences({
        startDate: "2026-02-01",
        time: "09:00",
        timeZone: "UTC",
        frequency: "custom_weekdays",
        count: 5,
      })
    ).toThrow(/weekday/i)
  })

  it("stores instants that stay timezone-safe", () => {
    const result = expandRecurringScheduleOccurrences({
      startDate: "2026-03-08",
      time: "09:00",
      timeZone: "America/Los_Angeles",
      frequency: "daily",
      count: 2,
    })

    const first = Temporal.Instant.from(result.occurrences[0]!.scheduledFor)
    const second = Temporal.Instant.from(result.occurrences[1]!.scheduledFor)
    expect(first.epochMilliseconds).toBeLessThan(second.epochMilliseconds)
  })
})
