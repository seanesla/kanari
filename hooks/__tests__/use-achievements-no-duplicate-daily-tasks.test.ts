/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import type { DailyAchievement, UserProgress } from "@/lib/achievements"
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

describe("useAchievements daily generation de-dupe", () => {
  let setTimeoutSpy: ReturnType<typeof vi.spyOn> | null = null

  beforeEach(async () => {
    vi.resetModules()
    installFakeIndexedDb()
    await deleteDatabase(DB_NAME).catch(() => undefined)

    Object.defineProperty(globalThis, "fetch", {
      value: vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: "unauthorized" }),
      })),
      configurable: true,
    })

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

  it("does not create duplicate challenges when a carried-over task overlaps the starter fallback set", async () => {
    const { getDateKey } = await import("@/lib/date-utils")

    const shiftDateISO = (dateISO: string, deltaDays: number): string => {
      const [year, month, day] = dateISO.split("-").map(Number)
      const base = Date.UTC(year, (month ?? 1) - 1, day ?? 1)
      const shifted = new Date(base + deltaDays * 86_400_000)
      const y = shifted.getUTCFullYear()
      const m = String(shifted.getUTCMonth() + 1).padStart(2, "0")
      const d = String(shifted.getUTCDate()).padStart(2, "0")
      return `${y}-${m}-${d}`
    }

    const todayISO = getDateKey(new Date().toISOString(), "UTC")
    const yesterdayISO = shiftDateISO(todayISO, -1)

    const seedProgress: UserProgress = {
      id: "default",
      totalPoints: 0,
      level: 1,
      levelTitle: "Grounded Beginner",
      currentDailyCompletionStreak: 0,
      longestDailyCompletionStreak: 0,
      lastCompletedDateISO: null,
      lastGeneratedDateISO: yesterdayISO,
    }

    const carriedChallenge: DailyAchievement = {
      id: "carryover-1",
      dateISO: yesterdayISO,
      sourceDateISO: yesterdayISO,
      type: "challenge",
      category: "recovery",
      title: "Do Two Suggestions",
      description: "Complete two recovery suggestions today (small wins count).",
      insight: "This unlocks daily completion streak progress.",
      points: 35,
      createdAt: `${yesterdayISO}T10:00:00.000Z`,
      completed: false,
      carriedOver: false,
      seen: true,
      tracking: { key: "complete_suggestions", target: 2 },
    }

    const { db, fromDailyAchievement, toDailyAchievement } = await import("@/lib/storage/db")
    await db.userProgress.put(seedProgress)
    await db.achievements.add(fromDailyAchievement(carriedChallenge))

    const { useAchievements } = await import("@/hooks/use-achievements")
    const { result, unmount } = renderHook(() => useAchievements({ recordings: [], suggestions: [], sessions: [] }))

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    await act(async () => {
      await result.current.ensureToday()
    })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    const todaysRaw = await db.achievements
      .where("dateISO")
      .equals(todayISO)
      .filter((a) => !a.expired)
      .toArray()
    const todays = todaysRaw.map(toDailyAchievement)

    const duplicateTitleCount = todays.filter((a) => a.type === "challenge" && a.title === "Do Two Suggestions").length
    expect(duplicateTitleCount).toBe(1)
    expect(todays.length).toBe(3)

    await act(async () => {
      unmount()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  })
})
