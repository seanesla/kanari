/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { installFakeIndexedDb, deleteDatabase } from "@/test-utils/indexeddb"

vi.mock("@/lib/timezone-context", () => ({
  useTimeZone: () => ({
    timeZone: "UTC",
    setTimeZone: vi.fn(),
    availableTimeZones: ["UTC"],
    isLoading: false,
  }),
}))

const DB_NAME = "kanari"

describe("useAchievements starter set", () => {
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

  it("does not auto-award points when generating today's achievements (no free 'visit app' badges)", async () => {
    const { useAchievements } = await import("@/hooks/use-achievements")
    const { db } = await import("@/lib/storage/db")

    const { result, unmount } = renderHook(() =>
      useAchievements({ recordings: [], suggestions: [], sessions: [] })
    )

    await act(async () => {
      await result.current.ensureToday()
    })

    await waitFor(() => {
      expect(result.current.achievementsToday.length).toBeGreaterThan(0)
    })

    expect(result.current.achievementsToday.every((a) => a.type === "challenge")).toBe(true)
    expect(result.current.achievementsToday.every((a) => a.completed === false)).toBe(true)

    const persisted = await db.userProgress.get("default")
    expect(persisted?.totalPoints ?? 0).toBe(0)

    unmount()
  })

  it("sanitizes Gemini output that looks like an auto-completable achievement (visit/open/login) into a trackable challenge", async () => {
    vi.doMock("@/lib/utils", () => ({
      createGeminiHeaders: vi.fn(async () => ({ "Content-Type": "application/json" })),
      getGeminiApiKey: vi.fn(async () => "AIzaTestKey123"),
    }))

    Object.defineProperty(globalThis, "fetch", {
      value: vi.fn(async () => ({
        ok: true,
        json: async () => ({
          achievements: [
            {
              type: "badge",
              category: "engagement",
              title: "Visit Kanari",
              description: "Open the website and look around.",
              points: 15,
            },
          ],
        }),
      })),
      configurable: true,
    })

    const { db } = await import("@/lib/storage/db")
    await db.userProgress.put({
      id: "default",
      totalPoints: 0,
      level: 1,
      levelTitle: "Grounded Beginner",
      currentDailyCompletionStreak: 0,
      longestDailyCompletionStreak: 0,
      lastCompletedDateISO: null,
      lastGeneratedDateISO: "2026-01-15",
    })

    const { useAchievements } = await import("@/hooks/use-achievements")
    const { result, unmount } = renderHook(() =>
      useAchievements({ recordings: [], suggestions: [], sessions: [] })
    )

    await act(async () => {
      await result.current.ensureToday()
    })

    await waitFor(() => {
      expect(result.current.achievementsToday.length).toBeGreaterThan(0)
    })

    const first = result.current.achievementsToday[0]
    expect(first?.type).toBe("challenge")
    expect(first?.completed).toBe(false)
    expect(first?.tracking?.key).toBeDefined()

    unmount()
  })
})
