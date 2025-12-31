import { describe, expect, it, vi } from "vitest"

import type { AudioFeatures } from "@/lib/types"

const baseFeatures: AudioFeatures = {
  mfcc: [1, 2, 3],
  spectralCentroid: 2000,
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

describe("validateAudioData", () => {
  it("returns false for empty audio", async () => {
    vi.resetModules()
    vi.unmock("@/lib/audio/processor")
    const { validateAudioData } = await import("@/lib/audio/processor")

    expect(validateAudioData(new Float32Array([]))).toBe(false)
  })

  it("returns false for silence", async () => {
    vi.resetModules()
    vi.unmock("@/lib/audio/processor")
    const { validateAudioData } = await import("@/lib/audio/processor")

    expect(validateAudioData(new Float32Array(1600))).toBe(false)
  })

  it("returns true for audio with signal and warns on clipping", async () => {
    vi.resetModules()
    vi.unmock("@/lib/audio/processor")
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const { validateAudioData } = await import("@/lib/audio/processor")

    expect(validateAudioData(new Float32Array([0, 0.002, 1.2]))).toBe(true)
    expect(warnSpy).toHaveBeenCalledWith(
      "Audio data contains clipping (values > 1.0)"
    )
  })
})

describe("processAudio", () => {
  it("returns features + metadata when VAD is disabled", async () => {
    vi.resetModules()
    vi.unmock("@/lib/audio/processor")

    const extractMock = vi.fn(() => baseFeatures)
    vi.doMock("../feature-extractor", () => ({
      FeatureExtractor: class {
        extract = extractMock
      },
    }))

    const { processAudio } = await import("@/lib/audio/processor")
    const audio = new Float32Array(16000).fill(0.1)

    const result = await processAudio(audio, { enableVAD: false, sampleRate: 16000 })

    expect(result.features).toEqual(baseFeatures)
    expect(result.segments).toBeUndefined()
    expect(result.metadata.vadEnabled).toBe(false)
    expect(result.metadata.duration).toBeCloseTo(1, 6)
    expect(result.metadata.speechDuration).toBeCloseTo(1, 6)
    expect(extractMock).toHaveBeenCalledWith(audio)
  })

  it("concatenates VAD segments before extracting features", async () => {
    vi.resetModules()
    vi.unmock("@/lib/audio/processor")

    const extractMock = vi.fn(() => baseFeatures)
    vi.doMock("../feature-extractor", () => ({
      FeatureExtractor: class {
        extract = extractMock
      },
    }))

    const segmentSpeechMock = vi.fn(async () => [
      { audio: new Float32Array([0.1, 0.2]), start: 0, end: 0.1 },
      { audio: new Float32Array([0.3]), start: 0.2, end: 0.4 },
    ])

    vi.doMock("../vad", () => ({
      segmentSpeech: segmentSpeechMock,
    }))

    const { processAudio } = await import("@/lib/audio/processor")

    const audio = new Float32Array(16000).fill(0.1)
    const result = await processAudio(audio, { enableVAD: true, sampleRate: 16000 })

    expect(result.segments).toHaveLength(2)
    expect(result.metadata.vadEnabled).toBe(true)
    expect(result.metadata.speechDuration).toBeCloseTo(0.3, 6)

    const extracted = extractMock.mock.calls[0]?.[0] as Float32Array | undefined
    expect(extracted).toBeInstanceOf(Float32Array)
    expect(extracted).toHaveLength(3)
    expect(extracted?.[0]).toBeCloseTo(0.1, 6)
    expect(extracted?.[1]).toBeCloseTo(0.2, 6)
    expect(extracted?.[2]).toBeCloseTo(0.3, 6)
    expect(segmentSpeechMock).toHaveBeenCalled()
  })

  it("falls back to a single segment when VAD throws", async () => {
    vi.resetModules()
    vi.unmock("@/lib/audio/processor")

    const extractMock = vi.fn(() => baseFeatures)
    vi.doMock("../feature-extractor", () => ({
      FeatureExtractor: class {
        extract = extractMock
      },
    }))

    const segmentSpeechMock = vi.fn(async () => {
      throw new Error("boom")
    })

    vi.doMock("../vad", () => ({
      segmentSpeech: segmentSpeechMock,
    }))

    const { processAudio } = await import("@/lib/audio/processor")

    const audio = new Float32Array(16000).fill(0.1)
    const result = await processAudio(audio, { enableVAD: true, sampleRate: 16000 })

    expect(result.segments).toHaveLength(1)
    expect(result.segments?.[0]?.audio).toBe(audio)
    expect(result.metadata.speechDuration).toBeCloseTo(1, 6)
  })
})
