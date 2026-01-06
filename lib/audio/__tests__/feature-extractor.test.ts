import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"

import { FeatureExtractor } from "@/lib/audio/feature-extractor"

function decodePcm16MonoWav(buffer: Buffer): { sampleRate: number; data: Float32Array } {
  // Minimal WAV parser for PCM 16-bit mono files.
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Not a WAV file")
  }

  let offset = 12
  let fmt: { audioFormat: number; numChannels: number; sampleRate: number; bitsPerSample: number } | null = null
  let dataChunk: Buffer | null = null

  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4)
    const size = buffer.readUInt32LE(offset + 4)
    const chunkStart = offset + 8
    const chunkEnd = chunkStart + size

    if (id === "fmt ") {
      const audioFormat = buffer.readUInt16LE(chunkStart)
      const numChannels = buffer.readUInt16LE(chunkStart + 2)
      const sampleRate = buffer.readUInt32LE(chunkStart + 4)
      const bitsPerSample = buffer.readUInt16LE(chunkStart + 14)
      fmt = { audioFormat, numChannels, sampleRate, bitsPerSample }
    } else if (id === "data") {
      dataChunk = buffer.subarray(chunkStart, chunkEnd)
    }

    offset = chunkEnd + (size % 2) // chunks are word-aligned
  }

  if (!fmt || !dataChunk) throw new Error("Missing fmt or data chunk")
  if (fmt.audioFormat !== 1) throw new Error(`Unsupported WAV format: ${fmt.audioFormat}`)
  if (fmt.numChannels !== 1) throw new Error(`Unsupported channel count: ${fmt.numChannels}`)
  if (fmt.bitsPerSample !== 16) throw new Error(`Unsupported bit depth: ${fmt.bitsPerSample}`)

  const samples = new Int16Array(dataChunk.buffer, dataChunk.byteOffset, Math.floor(dataChunk.length / 2))
  const float32 = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i]
    float32[i] = v / (v < 0 ? 0x8000 : 0x7fff)
  }

  return { sampleRate: fmt.sampleRate, data: float32 }
}

function resampleLinear(audioData: Float32Array, fromSampleRate: number, toSampleRate: number): Float32Array {
  if (fromSampleRate === toSampleRate) return audioData
  const ratio = fromSampleRate / toSampleRate
  const newLength = Math.round(audioData.length / ratio)
  const out = new Float32Array(newLength)
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio
    const i0 = Math.floor(srcIndex)
    const i1 = Math.min(i0 + 1, audioData.length - 1)
    const frac = srcIndex - i0
    out[i] = audioData[i0] * (1 - frac) + audioData[i1] * frac
  }
  return out
}

function expectNormalized(name: string, value: number) {
  expect(Number.isFinite(value), `${name} should be finite`).toBe(true)
  expect(value, `${name} should be >= 0`).toBeGreaterThanOrEqual(0)
  expect(value, `${name} should be <= 1`).toBeLessThanOrEqual(1)
}

describe("FeatureExtractor", () => {
  it("produces finite, normalized spectral/ZCR features", () => {
    const wavPath = path.join(process.cwd(), "public/voices/laomedeia.wav")
    const buf = fs.readFileSync(wavPath)
    const decoded = decodePcm16MonoWav(buf)
    const audio16k = resampleLinear(decoded.data, decoded.sampleRate, 16000)

    const extractor = new FeatureExtractor({ sampleRate: 16000 })
    const features = extractor.extract(audio16k)

    expect(features.mfcc.length).toBeGreaterThan(0)
    expect(features.mfcc.every(Number.isFinite)).toBe(true)

    expectNormalized("spectralCentroid", features.spectralCentroid)
    expectNormalized("spectralFlux", features.spectralFlux)
    expectNormalized("spectralRolloff", features.spectralRolloff)
    expectNormalized("rms", features.rms)
    expectNormalized("zcr", features.zcr)

    expect(Number.isFinite(features.speechRate)).toBe(true)
    expect(features.speechRate).toBeGreaterThanOrEqual(0)
    expect(features.speechRate).toBeLessThanOrEqual(20)

    expectNormalized("pauseRatio", features.pauseRatio)
    expect(Number.isFinite(features.pauseCount)).toBe(true)
    expect(features.pauseCount).toBeGreaterThanOrEqual(0)
  })
})

