/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { deleteDatabase, installFakeIndexedDb } from "@/test-utils/indexeddb"
import type { RecoveryBlock, RecurringSeries, Suggestion } from "@/lib/types"

const DB_NAME = "kanari"

describe("scheduling/series-store", () => {
  beforeEach(async () => {
    vi.resetModules()
    installFakeIndexedDb()
    await deleteDatabase(DB_NAME).catch(() => undefined)
  })

  afterEach(async () => {
    try {
      const { db } = await import("@/lib/storage/db")
      db.close()
    } catch {
      // ignore
    }
    await deleteDatabase(DB_NAME).catch(() => undefined)
  })

  async function seedSeriesFixture() {
    const {
      db,
      fromRecurringSeries,
      fromRecoveryBlock,
      fromSuggestion,
      toRecurringSeries,
      toRecoveryBlock,
      toSuggestion,
    } = await import("@/lib/storage/db")

    const now = "2026-02-01T00:00:00.000Z"
    const series: RecurringSeries = {
      id: "series-1",
      title: "Study session",
      category: "rest",
      duration: 45,
      timeZone: "UTC",
      recurrence: {
        startDate: "2026-02-09",
        time: "20:00",
        frequency: "daily",
        count: 3,
      },
      status: "active",
      createdAt: now,
      updatedAt: now,
    }

    const suggestions: Suggestion[] = [
      {
        id: "s1",
        seriesId: series.id,
        occurrenceDate: "2026-02-09",
        occurrenceIndex: 0,
        content: "Study session",
        rationale: "rationale",
        duration: 45,
        category: "rest",
        status: "scheduled",
        createdAt: now,
        scheduledFor: "2026-02-09T20:00:00.000Z",
      },
      {
        id: "s2",
        seriesId: series.id,
        occurrenceDate: "2026-02-10",
        occurrenceIndex: 1,
        content: "Study session",
        rationale: "rationale",
        duration: 45,
        category: "rest",
        status: "scheduled",
        createdAt: now,
        scheduledFor: "2026-02-10T20:00:00.000Z",
      },
      {
        id: "s3",
        seriesId: series.id,
        occurrenceDate: "2026-02-11",
        occurrenceIndex: 2,
        content: "Study session",
        rationale: "rationale",
        duration: 45,
        category: "rest",
        status: "scheduled",
        createdAt: now,
        scheduledFor: "2026-02-11T20:00:00.000Z",
      },
    ]

    const blocks: RecoveryBlock[] = suggestions.map((suggestion, index) => ({
      id: `rb-${index + 1}`,
      suggestionId: suggestion.id,
      seriesId: suggestion.seriesId,
      occurrenceDate: suggestion.occurrenceDate,
      calendarEventId: `evt-${index + 1}`,
      scheduledAt: suggestion.scheduledFor!,
      duration: suggestion.duration,
      completed: false,
    }))

    await db.recurringSeries.put(fromRecurringSeries(series))
    await db.suggestions.bulkAdd(suggestions.map(fromSuggestion))
    await db.recoveryBlocks.bulkPut(blocks.map(fromRecoveryBlock))

    return {
      db,
      series,
      suggestions,
      toSuggestion,
      toRecoveryBlock,
      toRecurringSeries,
    }
  }

  it("reschedules only the selected occurrence for single scope", async () => {
    const { db, toSuggestion, toRecoveryBlock } = await seedSeriesFixture()
    const { rescheduleSuggestionWithScope } = await import("@/lib/scheduling/series-store")

    const result = await rescheduleSuggestionWithScope({
      suggestionId: "s2",
      newScheduledFor: "2026-02-10T21:00:00.000Z",
      scope: "single",
    })

    expect(result.updatedCount).toBe(1)
    expect(result.updatedSuggestionIds).toEqual(["s2"])

    const s1 = toSuggestion((await db.suggestions.get("s1"))!)
    const s2 = toSuggestion((await db.suggestions.get("s2"))!)
    const s3 = toSuggestion((await db.suggestions.get("s3"))!)

    expect(s1.scheduledFor).toBe("2026-02-09T20:00:00.000Z")
    expect(s2.scheduledFor).toBe("2026-02-10T21:00:00.000Z")
    expect(s3.scheduledFor).toBe("2026-02-11T20:00:00.000Z")

    const block2 = toRecoveryBlock((await db.recoveryBlocks.where("suggestionId").equals("s2").first())!)
    expect(block2.scheduledAt).toBe("2026-02-10T21:00:00.000Z")
  })

  it("shifts anchor and future occurrences for future scope", async () => {
    const { db, toSuggestion } = await seedSeriesFixture()
    const { rescheduleSuggestionWithScope } = await import("@/lib/scheduling/series-store")

    const result = await rescheduleSuggestionWithScope({
      suggestionId: "s2",
      newScheduledFor: "2026-02-10T21:30:00.000Z",
      scope: "future",
    })

    expect(result.updatedCount).toBe(2)
    expect(result.updatedSuggestionIds).toEqual(["s2", "s3"])

    const s1 = toSuggestion((await db.suggestions.get("s1"))!)
    const s2 = toSuggestion((await db.suggestions.get("s2"))!)
    const s3 = toSuggestion((await db.suggestions.get("s3"))!)

    expect(s1.scheduledFor).toBe("2026-02-09T20:00:00.000Z")
    expect(s2.scheduledFor).toBe("2026-02-10T21:30:00.000Z")
    expect(s3.scheduledFor).toBe("2026-02-11T21:30:00.000Z")
  })

  it("cancels whole series and clears linked recovery blocks for all scope", async () => {
    const { db, series, toRecurringSeries, toSuggestion } = await seedSeriesFixture()
    const { dismissSuggestionWithScope } = await import("@/lib/scheduling/series-store")

    const result = await dismissSuggestionWithScope({
      suggestionId: "s1",
      scope: "all",
    })

    expect(result.updatedCount).toBe(3)

    const updated = (await db.suggestions.orderBy("id").toArray()).map(toSuggestion)
    expect(updated.every((suggestion) => suggestion.status === "dismissed")).toBe(true)

    const remainingBlocks = await db.recoveryBlocks.toArray()
    expect(remainingBlocks).toHaveLength(0)

    const updatedSeries = toRecurringSeries((await db.recurringSeries.get(series.id))!)
    expect(updatedSeries.status).toBe("cancelled")
    expect(updatedSeries.cancelledAt).toBeTruthy()
  })

  it("matches active series by normalized title", async () => {
    const { db, fromRecurringSeries } = await import("@/lib/storage/db")
    const { findActiveRecurringSeriesByTitle } = await import("@/lib/scheduling/series-store")

    await db.recurringSeries.bulkAdd([
      fromRecurringSeries({
        id: "series-old",
        title: "  Study   Session ",
        category: "rest",
        duration: 45,
        timeZone: "UTC",
        recurrence: { startDate: "2026-02-01", time: "20:00", frequency: "daily", count: 2 },
        status: "active",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T01:00:00.000Z",
      }),
      fromRecurringSeries({
        id: "series-new",
        title: "study session",
        category: "rest",
        duration: 45,
        timeZone: "UTC",
        recurrence: { startDate: "2026-02-05", time: "20:00", frequency: "daily", count: 2 },
        status: "active",
        createdAt: "2026-02-05T00:00:00.000Z",
        updatedAt: "2026-02-05T02:00:00.000Z",
      }),
    ])

    const matched = await findActiveRecurringSeriesByTitle("Study session")
    expect(matched?.id).toBe("series-new")
  })
})
