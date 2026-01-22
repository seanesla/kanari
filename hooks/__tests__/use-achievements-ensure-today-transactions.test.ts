/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"
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

describe("useAchievements.ensureToday transaction safety", () => {
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

  it("does not call settings reads inside a transaction (avoids NotFoundError: objectStore)", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

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
    const { result } = renderHook(() => useAchievements({ recordings: [], suggestions: [], sessions: [] }))

    await act(async () => {
      await result.current.ensureToday()
    })

    expect(
      consoleErrorSpy.mock.calls.some(
        ([message]) => typeof message === "string" && message.includes("Failed to get Gemini API key from settings:")
      )
    ).toBe(false)
  })

  it("keeps IndexedDB writes transactional even when Gemini generation runs (no 'committed too early')", async () => {
    vi.doMock("@/lib/utils", () => ({
      createGeminiHeaders: vi.fn(async () => ({ "Content-Type": "application/json" })),
      getGeminiApiKey: vi.fn(async () => "AIzaTestKey123"),
    }))

    Object.defineProperty(globalThis, "fetch", {
      value: vi.fn(async () => {
        // Force a task boundary to reproduce Dexie's "Transaction committed too early" failure mode
        // when fetch() is awaited inside an IndexedDB transaction.
        await new Promise((resolve) => setTimeout(resolve, 0))
        return {
          ok: true,
          json: async () => ({
            achievements: [
              {
                type: "challenge",
                category: "consistency",
                title: "Test challenge",
                description: "A generated challenge",
                points: 20,
                tracking: { key: "do_check_in", target: 1 },
              },
            ],
          }),
        }
      }),
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
    const { result } = renderHook(() => useAchievements({ recordings: [], suggestions: [], sessions: [] }))

    await act(async () => {
      await result.current.ensureToday()
    })

    await waitFor(() => {
      expect(result.current.error).toBeNull()
      expect(result.current.achievementsToday.length).toBeGreaterThan(0)
    })
  })
})
