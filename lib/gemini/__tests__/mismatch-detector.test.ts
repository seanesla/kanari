import { describe, expect, it, vi } from "vitest"

import type { AudioFeatures, VoiceMetrics } from "@/lib/types"

const baseFeatures: AudioFeatures = {
  mfcc: [1, 2, 3],
  spectralCentroid: 1800,
  spectralFlux: 0.1,
  spectralRolloff: 3000,
  rms: 0.1,
  zcr: 0.05,
  speechRate: 4,
  pauseRatio: 0.2,
  pauseCount: 2,
  avgPauseDuration: 200,
  pitchMean: 200,
  pitchStdDev: 20,
  pitchRange: 100,
}

const baseMetrics: VoiceMetrics = {
  stressScore: 50,
  fatigueScore: 50,
  stressLevel: "moderate",
  fatigueLevel: "normal",
  confidence: 0.8,
  analyzedAt: new Date().toISOString(),
}

async function loadMismatchDetector() {
  vi.resetModules()
  vi.unmock("@/lib/gemini/mismatch-detector")
  return await import("@/lib/gemini/mismatch-detector")
}

describe("shouldRunMismatchDetection", () => {
  it("returns false when transcript is missing or too short", async () => {
    const { shouldRunMismatchDetection } = await loadMismatchDetector()

    expect(shouldRunMismatchDetection("", baseFeatures)).toBe(false)
    expect(shouldRunMismatchDetection("two words", baseFeatures)).toBe(false)
  })

  it("returns false when features are missing or invalid", async () => {
    const { shouldRunMismatchDetection } = await loadMismatchDetector()

    expect(shouldRunMismatchDetection("this has three words", undefined)).toBe(false)
    expect(
      shouldRunMismatchDetection("this has three words", { ...baseFeatures, speechRate: 0, rms: 0 })
    ).toBe(false)
  })

  it("returns true when transcript and features look usable", async () => {
    const { shouldRunMismatchDetection } = await loadMismatchDetector()
    expect(shouldRunMismatchDetection("this has three words", baseFeatures)).toBe(true)
  })
})

describe("featuresToPatterns", () => {
  it("classifies fast/high energy/frequent pauses/bright tone", async () => {
    const { featuresToPatterns } = await loadMismatchDetector()

    const patterns = featuresToPatterns({
      ...baseFeatures,
      speechRate: 6,
      rms: 0.3,
      pauseRatio: 0.5,
      pauseCount: 11,
      spectralCentroid: 3000,
    })

    expect(patterns).toEqual({
      speechRate: "fast",
      energyLevel: "high",
      pauseFrequency: "frequent",
      voiceTone: "bright",
    })
  })

  it("classifies slow/low energy/rare pauses/dull tone", async () => {
    const { featuresToPatterns } = await loadMismatchDetector()

    const patterns = featuresToPatterns({
      ...baseFeatures,
      speechRate: 2.5,
      rms: 0.05,
      pauseRatio: 0.1,
      pauseCount: 0,
      spectralCentroid: 1000,
    })

    expect(patterns).toEqual({
      speechRate: "slow",
      energyLevel: "low",
      pauseFrequency: "rare",
      voiceTone: "dull",
    })
  })
})

describe("detectMismatch", () => {
  it("flags dismissive positive language with stressed acoustic signal", async () => {
    const { detectMismatch } = await loadMismatchDetector()

    const result = detectMismatch(
      "I'm fine.",
      baseFeatures,
      {
        ...baseMetrics,
        stressScore: 80,
        stressLevel: "high",
      }
    )

    expect(result.detected).toBe(true)
    expect(result.semanticSignal).toBe("neutral")
    expect(result.acousticSignal).toBe("stressed")
    expect(result.suggestionForGemini).toContain("stress patterns")
  })

  it("flags negative semantic signal with energetic acoustic signal", async () => {
    const { detectMismatch } = await loadMismatchDetector()

    const energeticFeatures: AudioFeatures = {
      ...baseFeatures,
      rms: 0.2,
      speechRate: 5,
      spectralCentroid: 2500,
    }

    const result = detectMismatch(
      "I feel stressed and overwhelmed today",
      energeticFeatures,
      baseMetrics
    )

    expect(result.detected).toBe(true)
    expect(result.semanticSignal).toBe("negative")
    expect(result.acousticSignal).toBe("energetic")
    expect(result.suggestionForGemini).toContain("energetic")
  })
})

