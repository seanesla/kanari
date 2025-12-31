import { beforeEach, describe, expect, it, vi } from "vitest"

import { SimpleVAD, VoiceActivityDetector, segmentSpeech } from "../vad"

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("SimpleVAD", () => {
  it("returns the entire audio when no speech is detected (silence)", () => {
    const audio = new Float32Array(16000)
    const vad = new SimpleVAD(16000)

    const segments = vad.segment(audio)

    expect(segments).toHaveLength(1)
    expect(segments[0]?.audio).toBe(audio)
    expect(segments[0]?.start).toBe(0)
    expect(segments[0]?.end).toBeCloseTo(1, 6)
  })

  it("detects a speech segment when energy rises above the adaptive threshold", () => {
    const sampleRate = 16000
    const audio = new Float32Array(sampleRate)
    // First half silence, second half speech.
    audio.fill(0, 0, sampleRate / 2)
    audio.fill(1, sampleRate / 2)

    const vad = new SimpleVAD(sampleRate)
    const segments = vad.segment(audio)

    expect(segments).toHaveLength(1)
    expect(segments[0]?.start).toBeGreaterThan(0.4)
    expect(segments[0]?.start).toBeLessThan(0.6)
    expect(segments[0]?.end).toBeCloseTo(1, 2)
    expect(segments[0]?.audio.length).toBeGreaterThan(0)
  })
})

describe("VoiceActivityDetector (Silero VAD wrapper)", () => {
  it("falls back to a single segment when VAD cannot run in Node", async () => {
    const audio = new Float32Array(16000).fill(0.2)
    const vad = new VoiceActivityDetector({ sampleRate: 16000 })

    const segments = await vad.segment(audio)

    expect(segments).toHaveLength(1)
    expect(segments[0]?.audio).toBe(audio)
    expect(segments[0]?.start).toBe(0)
    expect(segments[0]?.end).toBeCloseTo(1, 6)
  })

  it("uses the configured sampleRate for fallback timing", async () => {
    const audio = new Float32Array(8000).fill(0.2)
    const vad = new VoiceActivityDetector({ sampleRate: 8000 })

    const segments = await vad.segment(audio)

    expect(segments).toHaveLength(1)
    expect(segments[0]?.audio).toBe(audio)
    expect(segments[0]?.end).toBeCloseTo(1, 6)
  })
})

describe("segmentSpeech", () => {
  it("returns a segment list without throwing when VAD fails", async () => {
    const audio = new Float32Array(16000).fill(0.1)
    await expect(segmentSpeech(audio)).resolves.toHaveLength(1)
  })
})
