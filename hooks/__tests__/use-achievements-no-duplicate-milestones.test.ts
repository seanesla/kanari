/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import type { MilestoneBadge } from "@/lib/achievements"
import { installFakeIndexedDb, deleteDatabase } from "@/test-utils/indexeddb"

vi.mock("@/lib/timezone-context", () => ({
  useTimeZone: () => ({
    timeZone: "UTC",
    setTimeZone: vi.fn(),
    availableTimeZones: ["UTC"],
    isLoading: false,
  }),
}))

vi.mock("@/lib/utils", () => ({
  createGeminiHeaders: vi.fn(async () => ({ "Content-Type": "application/json" })),
  getGeminiApiKey: vi.fn(async () => undefined),
}))

const DB_NAME = "kanari"

describe("useAchievements milestone de-dupe", () => {
  let setTimeoutSpy: ReturnType<typeof vi.spyOn> | null = null

  beforeEach(async () => {
    vi.resetModules()
    installFakeIndexedDb()
    await deleteDatabase(DB_NAME).catch(() => undefined)

    const realSetTimeout = globalThis.setTimeout
    setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation((handler, timeout, ...args) => {
      // Avoid the hook's background auto-generation timer causing state updates
      // outside the test's `act()` scope.
      if (timeout === 1200) return 0 as unknown as ReturnType<typeof setTimeout>
      return realSetTimeout(handler as TimerHandler, timeout as number, ...args)
    })
  })

  afterEach(async () => {
    setTimeoutSpy?.mockRestore()
    setTimeoutSpy = null

    try {
      const { db } = await import("@/lib/storage/db")
      db.close()
    } catch {
      // ignore
    }
    await deleteDatabase(DB_NAME).catch(() => undefined)
  })

  it("returns one milestone per type even if the DB contains duplicates", async () => {
    const nowISO = new Date().toISOString()
    const dupes: MilestoneBadge[] = [
      {
        id: "m1",
        type: "7day",
        title: "One Week Wonder",
        description: "Completed achievements for 7 consecutive days!",
        earnedAt: nowISO,
        streakDays: 7,
        seen: true,
        seenAt: nowISO,
      },
      {
        id: "m2",
        type: "7day",
        title: "One Week Wonder",
        description: "Completed achievements for 7 consecutive days!",
        earnedAt: nowISO,
        streakDays: 7,
        seen: true,
        seenAt: nowISO,
      },
      {
        id: "m3",
        type: "7day",
        title: "One Week Wonder",
        description: "Completed achievements for 7 consecutive days!",
        earnedAt: nowISO,
        streakDays: 7,
        seen: true,
        seenAt: nowISO,
      },
    ]

    const { db, fromMilestoneBadge } = await import("@/lib/storage/db")
    await db.milestoneBadges.bulkPut(dupes.map(fromMilestoneBadge))

    const { useAchievements } = await import("@/hooks/use-achievements")
    const { result, unmount } = renderHook(() => useAchievements({ recordings: [], suggestions: [], sessions: [] }))

    // Allow effects + live query to settle.
    await waitFor(() => {
      expect(result.current.milestoneBadges.length).toBeGreaterThan(0)
    })

    expect(result.current.milestoneBadges.filter((b) => b.type === "7day")).toHaveLength(1)

    await act(async () => {
      unmount()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  })
})
