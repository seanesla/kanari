/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { deleteDatabase, installFakeIndexedDb } from "@/test-utils/indexeddb"
import type { AudioFeatures, CheckInSession } from "@/lib/types"

const DB_NAME = "kanari"

const FEATURES: AudioFeatures = {
  mfcc: [],
  spectralCentroid: 0,
  spectralFlux: 0,
  spectralRolloff: 0,
  rms: 0,
  zcr: 0,
  speechRate: 0,
  pauseRatio: 0,
  pauseCount: 0,
  avgPauseDuration: 0,
  pitchMean: 0,
  pitchStdDev: 0,
  pitchRange: 0,
}

describe("trend data quality gating + recompute", () => {
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

  it("shouldIncludeInTrends treats missing quality as include and invalid as exclude", async () => {
    const { QUALITY_GATES, shouldIncludeInTrends } = await import("@/lib/ml/thresholds")

    expect(shouldIncludeInTrends(undefined)).toBe(true)
    expect(shouldIncludeInTrends(null)).toBe(true)
    expect(shouldIncludeInTrends({})).toBe(true)
    expect(shouldIncludeInTrends({ quality: QUALITY_GATES.TREND_MIN_QUALITY })).toBe(true)
    expect(shouldIncludeInTrends({ quality: QUALITY_GATES.TREND_MIN_QUALITY - 0.01 })).toBe(false)
    expect(shouldIncludeInTrends({ quality: Number.NaN })).toBe(false)
    expect(shouldIncludeInTrends({ quality: Number.POSITIVE_INFINITY })).toBe(false)
  })

  it("recomputes daily trend data when deleting a check-in session", async () => {
    const { useCheckInSessionActions } = await import("@/hooks/use-storage")
    const { db } = await import("@/lib/storage/db")

    const dateISO = "2026-01-01"

    const sessionA = {
      id: "sess_a",
      startedAt: "2026-01-01T12:00:00.000Z",
      messages: [],
      acousticMetrics: {
        stressScore: 80,
        fatigueScore: 40,
        stressLevel: "elevated",
        fatigueLevel: "normal",
        confidence: 0.8,
        features: FEATURES,
      },
    } satisfies CheckInSession

    const sessionB = {
      id: "sess_b",
      startedAt: "2026-01-01T13:00:00.000Z",
      messages: [],
      acousticMetrics: {
        stressScore: 40,
        fatigueScore: 60,
        stressLevel: "moderate",
        fatigueLevel: "tired",
        confidence: 0.7,
        features: FEATURES,
      },
    } satisfies CheckInSession

    const { result } = renderHook(() => useCheckInSessionActions())

    await result.current.addCheckInSession(sessionA)
    await result.current.addCheckInSession(sessionB)

    const beforeDelete = await db.trendData.get(dateISO)
    expect(beforeDelete).toBeTruthy()
    expect(beforeDelete!.stressScore).toBe(60)
    expect(beforeDelete!.fatigueScore).toBe(50)
    expect(beforeDelete!.recordingCount).toBe(2)

    await result.current.deleteCheckInSession(sessionA.id)

    const afterDelete = await db.trendData.get(dateISO)
    expect(afterDelete).toBeTruthy()
    expect(afterDelete!.stressScore).toBe(40)
    expect(afterDelete!.fatigueScore).toBe(60)
    expect(afterDelete!.recordingCount).toBe(1)
  })

  it("excludes NaN/Infinity quality sessions from trend aggregation", async () => {
    const { useCheckInSessionActions } = await import("@/hooks/use-storage")
    const { db } = await import("@/lib/storage/db")

    const dateISO = "2026-01-02"

    const sessionNaN = {
      id: "sess_nan",
      startedAt: "2026-01-02T12:00:00.000Z",
      messages: [],
      acousticMetrics: {
        stressScore: 80,
        fatigueScore: 40,
        stressLevel: "elevated",
        fatigueLevel: "normal",
        confidence: 0.8,
        features: FEATURES,
        quality: {
          speechSeconds: 5,
          totalSeconds: 5,
          speechRatio: 1,
          quality: Number.NaN,
          reasons: [],
        },
      },
    } satisfies CheckInSession

    const sessionInfinity = {
      id: "sess_inf",
      startedAt: "2026-01-02T13:00:00.000Z",
      messages: [],
      acousticMetrics: {
        stressScore: 40,
        fatigueScore: 60,
        stressLevel: "moderate",
        fatigueLevel: "tired",
        confidence: 0.7,
        features: FEATURES,
        quality: {
          speechSeconds: 5,
          totalSeconds: 5,
          speechRatio: 1,
          quality: Number.POSITIVE_INFINITY,
          reasons: [],
        },
      },
    } satisfies CheckInSession

    const { result } = renderHook(() => useCheckInSessionActions())

    await result.current.addCheckInSession(sessionNaN)
    await result.current.addCheckInSession(sessionInfinity)

    const trend = await db.trendData.get(dateISO)
    expect(trend).toBeUndefined()
  })
})
