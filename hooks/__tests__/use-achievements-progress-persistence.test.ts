/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import type { DailyAchievement, UserProgress } from "@/lib/achievements"
import { installFakeIndexedDb, deleteDatabase } from "@/test-utils/indexeddb"

const DB_NAME = "kanari"

describe("useAchievements progress persistence", () => {
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

  it("does not overwrite existing user progress on mount", async () => {
    const seedProgress: UserProgress = {
      id: "default",
      totalPoints: 120,
      level: 2,
      levelTitle: "Steady Builder",
      currentDailyCompletionStreak: 3,
      longestDailyCompletionStreak: 5,
      lastCompletedDateISO: "2026-01-15",
      lastGeneratedDateISO: "2026-01-15",
      lastLevelUpAt: "2026-01-15T10:00:00.000Z",
    }

    const { db } = await import("@/lib/storage/db")
    await db.userProgress.put(seedProgress)

    const { useAchievements } = await import("@/hooks/use-achievements")
    const { result } = renderHook(() => useAchievements())

    // Allow effects + live query to settle.
    await waitFor(() => {
      expect(result.current.progress.totalPoints).toBe(120)
      expect(result.current.progress.level).toBe(2)
    })

    const persisted = await db.userProgress.get("default")
    expect(persisted).toMatchObject({ id: "default", totalPoints: 120, level: 2 })
  })

  it("repairs points from completed achievements when progress was reset", async () => {
    const { db, fromDailyAchievement } = await import("@/lib/storage/db")

    const resetProgress: UserProgress = {
      id: "default",
      totalPoints: 0,
      level: 1,
      levelTitle: "Grounded Beginner",
      currentDailyCompletionStreak: 0,
      longestDailyCompletionStreak: 0,
      lastCompletedDateISO: null,
      lastGeneratedDateISO: null,
    }

    const completedAchievement: DailyAchievement = {
      id: "ach-test-1",
      dateISO: "2026-01-15",
      sourceDateISO: "2026-01-15",
      type: "challenge",
      category: "consistency",
      title: "Test achievement",
      description: "Completed for test",
      points: 25,
      createdAt: "2026-01-15T00:00:00.000Z",
      completed: true,
      completedAt: "2026-01-15T01:00:00.000Z",
      carriedOver: false,
      seen: true,
    }

    await db.userProgress.put(resetProgress)
    await db.achievements.add(fromDailyAchievement(completedAchievement))

    const { useAchievements } = await import("@/hooks/use-achievements")
    const { result } = renderHook(() => useAchievements())

    await waitFor(() => {
      expect(result.current.progress.totalPoints).toBe(25)
      expect(result.current.progress.level).toBe(1)
    })

    const persisted = await db.userProgress.get("default")
    expect(persisted).toMatchObject({ id: "default", totalPoints: 25, level: 1 })
  })
})
