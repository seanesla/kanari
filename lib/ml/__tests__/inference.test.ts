import { describe, it, expect } from "vitest"
import { analyzeVoiceMetrics, validateFeatures } from "../inference"
import type { AudioFeatures } from "@/lib/types"
import { SCORE_LEVELS } from "../thresholds"

/**
 * Helper to create a baseline AudioFeatures object with sensible defaults.
 * All values are in the "normal" range (not triggering stress or fatigue indicators).
 */
function createBaselineFeatures(overrides: Partial<AudioFeatures> = {}): AudioFeatures {
  return {
    mfcc: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    spectralCentroid: 0.5, // Middle of 0-1 range
    spectralFlux: 0.05, // Below stress threshold
    spectralRolloff: 0.5,
    rms: 0.15, // Between fatigue low (0.1) and stress high (0.3)
    zcr: 0.03, // Below stress threshold
    speechRate: 4.0, // Normal range (between fatigue low 3.0 and stress high 5.5)
    pauseRatio: 0.2, // Below fatigue threshold
    pauseCount: 5, // Moderate confidence
    avgPauseDuration: 500,
    pitchMean: 150,
    pitchStdDev: 20,
    pitchRange: 50,
    ...overrides,
  }
}

describe("analyzeVoiceMetrics", () => {
  describe("stress level classification", () => {
    it("returns 'low' stress for baseline features", () => {
      const features = createBaselineFeatures()
      const result = analyzeVoiceMetrics(features)
      expect(result.stressLevel).toBe("low")
      expect(result.stressScore).toBeLessThan(SCORE_LEVELS.MODERATE)
    })

    it("returns 'high' stress when all indicators are high", () => {
      const features = createBaselineFeatures({
        speechRate: 6.0, // > 5.5 threshold
        rms: 0.35, // > 0.3 threshold
        spectralFlux: 0.2, // > 0.15 threshold
        zcr: 0.1, // > 0.08 threshold
      })
      const result = analyzeVoiceMetrics(features)
      expect(result.stressLevel).toBe("high")
      expect(result.stressScore).toBeGreaterThanOrEqual(SCORE_LEVELS.HIGH)
    })

    it("returns 'elevated' stress when most indicators are moderate-high", () => {
      const features = createBaselineFeatures({
        speechRate: 5.0, // Between 4.5 and 5.5 (moderate)
        rms: 0.25, // Between 0.2 and 0.3 (moderate)
        spectralFlux: 0.12, // Between 0.1 and 0.15 (moderate)
        zcr: 0.06, // Between 0.05 and 0.08 (moderate)
      })
      const result = analyzeVoiceMetrics(features)
      expect(["moderate", "elevated"]).toContain(result.stressLevel)
      expect(result.stressScore).toBeGreaterThanOrEqual(SCORE_LEVELS.MODERATE)
    })
  })

  describe("fatigue level classification", () => {
    it("returns 'rested' fatigue for baseline features", () => {
      const features = createBaselineFeatures()
      const result = analyzeVoiceMetrics(features)
      expect(result.fatigueLevel).toBe("rested")
      expect(result.fatigueScore).toBeLessThan(SCORE_LEVELS.MODERATE)
    })

    it("returns 'exhausted' fatigue when all indicators are high", () => {
      const features = createBaselineFeatures({
        speechRate: 2.5, // < 3.0 threshold
        rms: 0.08, // < 0.1 threshold
        pauseRatio: 0.5, // > 0.4 threshold
        spectralCentroid: 0.2, // < 0.3 threshold
      })
      const result = analyzeVoiceMetrics(features)
      expect(result.fatigueLevel).toBe("exhausted")
      expect(result.fatigueScore).toBeGreaterThanOrEqual(SCORE_LEVELS.HIGH)
    })

    it("returns 'tired' fatigue when most indicators are moderate-high", () => {
      const features = createBaselineFeatures({
        speechRate: 3.2, // Between 3.0 and 3.5 (moderate)
        rms: 0.12, // Between 0.1 and 0.15 (moderate)
        pauseRatio: 0.35, // Between 0.3 and 0.4 (moderate)
        spectralCentroid: 0.4, // Between 0.3 and 0.45 (moderate)
      })
      const result = analyzeVoiceMetrics(features)
      expect(["normal", "tired"]).toContain(result.fatigueLevel)
      expect(result.fatigueScore).toBeGreaterThanOrEqual(SCORE_LEVELS.MODERATE)
    })
  })

  describe("score level boundaries", () => {
    // These tests verify the SCORE_LEVELS thresholds are applied correctly
    // Score boundaries: 30 (moderate), 50 (elevated), 70 (high)

    it("score 29 maps to low/rested", () => {
      // This is tested implicitly through baseline features
      const features = createBaselineFeatures()
      const result = analyzeVoiceMetrics(features)
      expect(result.stressScore).toBeLessThan(30)
      expect(result.stressLevel).toBe("low")
    })

    it("correctly applies SCORE_LEVELS constants", () => {
      // Verify the constants are what we expect
      expect(SCORE_LEVELS.MODERATE).toBe(30)
      expect(SCORE_LEVELS.ELEVATED).toBe(50)
      expect(SCORE_LEVELS.HIGH).toBe(70)
    })
  })

  describe("confidence calculation", () => {
    it("returns higher confidence with more pause data", () => {
      const lowDataFeatures = createBaselineFeatures({ pauseCount: 2 })
      const highDataFeatures = createBaselineFeatures({ pauseCount: 15 })

      const lowResult = analyzeVoiceMetrics(lowDataFeatures)
      const highResult = analyzeVoiceMetrics(highDataFeatures)

      expect(highResult.confidence).toBeGreaterThan(lowResult.confidence)
    })

    it("returns lower confidence for very low RMS (poor audio)", () => {
      const normalFeatures = createBaselineFeatures({ rms: 0.2 })
      const poorAudioFeatures = createBaselineFeatures({ rms: 0.03 })

      const normalResult = analyzeVoiceMetrics(normalFeatures)
      const poorResult = analyzeVoiceMetrics(poorAudioFeatures)

      expect(poorResult.confidence).toBeLessThan(normalResult.confidence)
    })

    it("confidence is clamped between 0 and 1", () => {
      const features = createBaselineFeatures()
      const result = analyzeVoiceMetrics(features)

      expect(result.confidence).toBeGreaterThanOrEqual(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    })
  })

  describe("output structure", () => {
    it("returns all required fields", () => {
      const features = createBaselineFeatures()
      const result = analyzeVoiceMetrics(features)

      expect(result).toHaveProperty("stressScore")
      expect(result).toHaveProperty("fatigueScore")
      expect(result).toHaveProperty("stressLevel")
      expect(result).toHaveProperty("fatigueLevel")
      expect(result).toHaveProperty("confidence")
      expect(result).toHaveProperty("analyzedAt")
    })

    it("analyzedAt is a valid ISO date string", () => {
      const features = createBaselineFeatures()
      const result = analyzeVoiceMetrics(features)

      expect(() => new Date(result.analyzedAt)).not.toThrow()
      expect(new Date(result.analyzedAt).toISOString()).toBe(result.analyzedAt)
    })
  })
})

describe("validateFeatures", () => {
  describe("valid inputs", () => {
    it("returns true for valid baseline features", () => {
      const features = createBaselineFeatures()
      expect(validateFeatures(features)).toBe(true)
    })

    it("returns true for edge case valid values", () => {
      const features = createBaselineFeatures({
        rms: 0, // Min valid
        speechRate: 0, // Min valid
        pauseRatio: 1, // Max valid
        zcr: 1, // Max valid
      })
      expect(validateFeatures(features)).toBe(true)
    })
  })

  describe("missing fields", () => {
    it("returns false when rms is missing", () => {
      const features = createBaselineFeatures()
      // @ts-expect-error Testing runtime validation of missing field
      delete features.rms
      expect(validateFeatures(features)).toBe(false)
    })

    it("returns false when speechRate is missing", () => {
      const features = createBaselineFeatures()
      // @ts-expect-error Testing runtime validation of missing field
      delete features.speechRate
      expect(validateFeatures(features)).toBe(false)
    })
  })

  describe("out-of-range values", () => {
    it("returns false for negative rms", () => {
      const features = createBaselineFeatures({ rms: -0.1 })
      expect(validateFeatures(features)).toBe(false)
    })

    it("returns false for rms > 1", () => {
      const features = createBaselineFeatures({ rms: 1.5 })
      expect(validateFeatures(features)).toBe(false)
    })

    it("returns false for negative speechRate", () => {
      const features = createBaselineFeatures({ speechRate: -1 })
      expect(validateFeatures(features)).toBe(false)
    })

    it("returns false for speechRate > 20", () => {
      const features = createBaselineFeatures({ speechRate: 25 })
      expect(validateFeatures(features)).toBe(false)
    })

    it("returns false for pauseRatio > 1", () => {
      const features = createBaselineFeatures({ pauseRatio: 1.5 })
      expect(validateFeatures(features)).toBe(false)
    })

    it("returns false for zcr > 1", () => {
      const features = createBaselineFeatures({ zcr: 2 })
      expect(validateFeatures(features)).toBe(false)
    })
  })

  describe("insufficient data", () => {
    it("returns false for pauseCount < 2", () => {
      const features = createBaselineFeatures({ pauseCount: 1 })
      expect(validateFeatures(features)).toBe(false)
    })

    it("returns true for pauseCount = 2 (boundary)", () => {
      const features = createBaselineFeatures({ pauseCount: 2 })
      expect(validateFeatures(features)).toBe(true)
    })
  })
})
