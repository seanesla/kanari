import { describe, expect, it } from "vitest"
import {
  blendAcousticAndSemanticBiomarkers,
  inferSemanticBiomarkersFromText,
  mergeSemanticBiomarkers,
} from "../biomarker-fusion"

describe("inferSemanticBiomarkersFromText", () => {
  it("returns high stress for explicit stress self-report", () => {
    const result = inferSemanticBiomarkersFromText("I feel stressed out right now")
    expect(result.stressScore).toBeGreaterThanOrEqual(80)
    expect(result.stressConfidence).toBeGreaterThanOrEqual(0.7)
  })

  it("returns high fatigue for explicit fatigue self-report", () => {
    const result = inferSemanticBiomarkersFromText("I am exhausted and drained")
    expect(result.fatigueScore).toBeGreaterThanOrEqual(85)
    expect(result.fatigueConfidence).toBeGreaterThanOrEqual(0.7)
  })

  it("returns baseline (low-confidence) when there is no semantic signal", () => {
    const result = inferSemanticBiomarkersFromText("Just checking in")
    expect(result.stressScore).toBe(50)
    expect(result.fatigueScore).toBe(50)
    expect(result.stressConfidence).toBe(0)
    expect(result.fatigueConfidence).toBe(0)
  })
})

describe("mergeSemanticBiomarkers", () => {
  it("keeps the dominant (most confident + extreme) signal", () => {
    const prev = inferSemanticBiomarkersFromText("I feel stressed")
    const next = inferSemanticBiomarkersFromText("I'm a bit worried")

    const merged = mergeSemanticBiomarkers(prev, next)
    expect(merged.stressScore).toBe(prev.stressScore)
    expect(merged.stressConfidence).toBeGreaterThanOrEqual(next.stressConfidence)
  })
})

describe("blendAcousticAndSemanticBiomarkers", () => {
  it("falls back to acoustic when semantic confidence is zero", () => {
    const blended = blendAcousticAndSemanticBiomarkers({
      acoustic: { stressScore: 20, fatigueScore: 80, confidence: 0.8 },
      semantic: { stressScore: 50, fatigueScore: 50, stressConfidence: 0, fatigueConfidence: 0 },
    })

    expect(blended.stressScore).toBe(20)
    expect(blended.fatigueScore).toBe(80)
  })

  it("pushes stress upward when user explicitly reports stress", () => {
    const semantic = inferSemanticBiomarkersFromText("I feel stressed")
    const blended = blendAcousticAndSemanticBiomarkers({
      acoustic: { stressScore: 20, fatigueScore: 80, confidence: 0.8 },
      semantic,
    })

    expect(blended.stressScore).toBeGreaterThanOrEqual(50)
    expect(blended.stressScore).toBeGreaterThan(20)
    // No explicit fatigue text, so fatigue stays acoustic.
    expect(blended.fatigueScore).toBe(80)
  })
})
