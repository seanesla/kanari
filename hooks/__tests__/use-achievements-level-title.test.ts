/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import type { UserProgress } from "@/lib/achievements"
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

describe("useAchievements AI level titles", () => {
  beforeEach(async () => {
    vi.resetModules()
    installFakeIndexedDb()
    await deleteDatabase(DB_NAME).catch(() => undefined)

    vi.doMock("@/lib/utils", () => ({
      createGeminiHeaders: vi.fn(async () => ({ "Content-Type": "application/json" })),
      getGeminiApiKey: vi.fn(async () => "AIzaTestKey123"),
    }))

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (input === "/api/gemini/achievements") {
        return {
          ok: true,
          json: async () => ({
            achievements: [
              {
                type: "badge",
                category: "engagement",
                title: "Test Badge",
                description: "You did a thing recently.",
                points: 15,
              },
            ],
          }),
        }
      }
      if (input === "/api/gemini/achievements/level-title") {
        return {
          ok: true,
          json: async () => ({ title: "AI Level Title" }),
        }
      }
      return {
        ok: false,
        json: async () => ({}),
      }
    })

    Object.defineProperty(globalThis, "fetch", {
      value: fetchMock,
      configurable: true,
    })
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

  it("persists an AI-provided level title after a level-up during ensureToday()", async () => {
    const seedProgress: UserProgress = {
      id: "default",
      totalPoints: 90,
      level: 1,
      levelTitle: "Grounded Beginner",
      currentDailyCompletionStreak: 0,
      longestDailyCompletionStreak: 0,
      lastCompletedDateISO: null,
      lastGeneratedDateISO: "2026-01-15",
    }

    const { db } = await import("@/lib/storage/db")
    await db.userProgress.put(seedProgress)

    const { useAchievements } = await import("@/hooks/use-achievements")
    const { result } = renderHook(() => useAchievements({ recordings: [], suggestions: [], sessions: [] }))

    await act(async () => {
      await result.current.ensureToday()
    })

    const persisted = await db.userProgress.get("default")
    expect(persisted?.level).toBe(2)
    expect(persisted?.levelTitle).toBe("AI Level Title")
  })
})
