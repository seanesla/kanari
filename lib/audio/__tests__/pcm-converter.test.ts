/**
 * PCM Converter Tests
 *
 * Tests for audio format conversion utilities used in the voice analysis pipeline.
 * These functions are critical for:
 * - Converting Web Audio API Float32 samples to Gemini-compatible formats
 * - Creating valid WAV files for semantic audio analysis
 * - Ensuring audio data integrity during conversion
 */

import { describe, it, expect, vi } from "vitest"

// Unmock the module so we test the real implementation
// The global vitest.setup.ts mocks this module, but we want to test the actual code
vi.unmock("@/lib/audio/pcm-converter")

import {
  float32ToInt16,
  int16ToFloat32,
  float32ToWavBase64,
  float32ToBase64Pcm,
  calculateRMS,
} from "../pcm-converter"

/**
 * Helper to create a sine wave for testing
 * @param frequency - Frequency in Hz
 * @param sampleRate - Sample rate in Hz
 * @param duration - Duration in seconds
 * @returns Float32Array of audio samples
 */
function createSineWave(
  frequency: number = 440,
  sampleRate: number = 16000,
  duration: number = 0.1
): Float32Array {
  const numSamples = Math.floor(sampleRate * duration)
  const samples = new Float32Array(numSamples)

  for (let i = 0; i < numSamples; i++) {
    // Generate sine wave: sin(2 * PI * frequency * time)
    samples[i] = Math.sin(2 * Math.PI * frequency * (i / sampleRate))
  }

  return samples
}

/**
 * Helper to create silence (zero samples)
 */
function createSilence(numSamples: number): Float32Array {
  return new Float32Array(numSamples)
}

describe("float32ToInt16", () => {
  describe("basic conversion", () => {
    it("converts zero to zero", () => {
      const input = new Float32Array([0])
      const result = float32ToInt16(input)
      expect(result[0]).toBe(0)
    })

    it("converts 1.0 to max positive Int16 (32767)", () => {
      const input = new Float32Array([1.0])
      const result = float32ToInt16(input)
      expect(result[0]).toBe(32767) // 0x7FFF
    })

    it("converts -1.0 to max negative Int16 (-32768)", () => {
      const input = new Float32Array([-1.0])
      const result = float32ToInt16(input)
      expect(result[0]).toBe(-32768) // -0x8000
    })

    it("converts 0.5 to approximately half max positive", () => {
      const input = new Float32Array([0.5])
      const result = float32ToInt16(input)
      // 0.5 * 32767 ≈ 16383
      expect(result[0]).toBeCloseTo(16383, -1)
    })

    it("converts -0.5 to approximately half max negative", () => {
      const input = new Float32Array([-0.5])
      const result = float32ToInt16(input)
      // -0.5 * 32768 = -16384
      expect(result[0]).toBeCloseTo(-16384, -1)
    })
  })

  describe("clamping", () => {
    it("clamps values above 1.0 to max positive", () => {
      const input = new Float32Array([1.5, 2.0, 100.0])
      const result = float32ToInt16(input)
      expect(result[0]).toBe(32767)
      expect(result[1]).toBe(32767)
      expect(result[2]).toBe(32767)
    })

    it("clamps values below -1.0 to max negative", () => {
      const input = new Float32Array([-1.5, -2.0, -100.0])
      const result = float32ToInt16(input)
      expect(result[0]).toBe(-32768)
      expect(result[1]).toBe(-32768)
      expect(result[2]).toBe(-32768)
    })
  })

  describe("array handling", () => {
    it("preserves array length", () => {
      const input = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5])
      const result = float32ToInt16(input)
      expect(result.length).toBe(input.length)
    })

    it("handles empty array", () => {
      const input = new Float32Array([])
      const result = float32ToInt16(input)
      expect(result.length).toBe(0)
    })

    it("handles large arrays efficiently", () => {
      // 1 second of audio at 16kHz
      const input = createSineWave(440, 16000, 1.0)
      const result = float32ToInt16(input)
      expect(result.length).toBe(input.length)
    })
  })
})

describe("int16ToFloat32", () => {
  describe("basic conversion", () => {
    it("converts zero to zero", () => {
      const input = new Int16Array([0])
      const result = int16ToFloat32(input)
      expect(result[0]).toBe(0)
    })

    it("converts max positive Int16 to approximately 1.0", () => {
      const input = new Int16Array([32767])
      const result = int16ToFloat32(input)
      expect(result[0]).toBeCloseTo(1.0, 2)
    })

    it("converts max negative Int16 to approximately -1.0", () => {
      const input = new Int16Array([-32768])
      const result = int16ToFloat32(input)
      expect(result[0]).toBeCloseTo(-1.0, 2)
    })
  })

  describe("round-trip conversion", () => {
    it("preserves values through float32 -> int16 -> float32", () => {
      // Test values that should round-trip well
      const original = new Float32Array([0, 0.5, -0.5, 0.25, -0.25])
      const int16 = float32ToInt16(original)
      const roundTrip = int16ToFloat32(int16)

      for (let i = 0; i < original.length; i++) {
        // Allow for quantization error (Int16 has limited precision)
        expect(roundTrip[i]).toBeCloseTo(original[i], 3)
      }
    })

    it("sine wave survives round-trip with acceptable quality", () => {
      const original = createSineWave(440, 16000, 0.1)
      const int16 = float32ToInt16(original)
      const roundTrip = int16ToFloat32(int16)

      // Calculate RMS error between original and round-trip
      let errorSum = 0
      for (let i = 0; i < original.length; i++) {
        const error = original[i] - roundTrip[i]
        errorSum += error * error
      }
      const rmsError = Math.sqrt(errorSum / original.length)

      // Error should be very small (quantization noise only)
      expect(rmsError).toBeLessThan(0.001)
    })
  })
})

describe("float32ToWavBase64", () => {
  describe("WAV header structure", () => {
    it("produces valid base64 output", () => {
      const audio = createSilence(100)
      const base64 = float32ToWavBase64(audio, 16000)

      // Should be valid base64
      expect(() => atob(base64)).not.toThrow()
    })

    it("WAV starts with RIFF header", () => {
      const audio = createSilence(100)
      const base64 = float32ToWavBase64(audio, 16000)
      const binary = atob(base64)

      // First 4 bytes should be "RIFF"
      expect(binary.slice(0, 4)).toBe("RIFF")
    })

    it("WAV contains WAVE format marker", () => {
      const audio = createSilence(100)
      const base64 = float32ToWavBase64(audio, 16000)
      const binary = atob(base64)

      // Bytes 8-11 should be "WAVE"
      expect(binary.slice(8, 12)).toBe("WAVE")
    })

    it("WAV contains fmt chunk", () => {
      const audio = createSilence(100)
      const base64 = float32ToWavBase64(audio, 16000)
      const binary = atob(base64)

      // Bytes 12-15 should be "fmt "
      expect(binary.slice(12, 16)).toBe("fmt ")
    })

    it("WAV contains data chunk", () => {
      const audio = createSilence(100)
      const base64 = float32ToWavBase64(audio, 16000)
      const binary = atob(base64)

      // Bytes 36-39 should be "data"
      expect(binary.slice(36, 40)).toBe("data")
    })
  })

  describe("audio format parameters", () => {
    it("encodes correct sample rate in header", () => {
      const audio = createSilence(100)
      const base64 = float32ToWavBase64(audio, 44100)
      const binary = atob(base64)

      // Sample rate is at bytes 24-27 (little-endian)
      const sampleRate =
        binary.charCodeAt(24) |
        (binary.charCodeAt(25) << 8) |
        (binary.charCodeAt(26) << 16) |
        (binary.charCodeAt(27) << 24)

      expect(sampleRate).toBe(44100)
    })

    it("uses default sample rate of 16000", () => {
      const audio = createSilence(100)
      const base64 = float32ToWavBase64(audio)
      const binary = atob(base64)

      const sampleRate =
        binary.charCodeAt(24) |
        (binary.charCodeAt(25) << 8) |
        (binary.charCodeAt(26) << 16) |
        (binary.charCodeAt(27) << 24)

      expect(sampleRate).toBe(16000)
    })

    it("encodes mono audio (1 channel)", () => {
      const audio = createSilence(100)
      const base64 = float32ToWavBase64(audio, 16000)
      const binary = atob(base64)

      // Number of channels is at bytes 22-23 (little-endian)
      const numChannels = binary.charCodeAt(22) | (binary.charCodeAt(23) << 8)

      expect(numChannels).toBe(1)
    })

    it("encodes 16-bit samples", () => {
      const audio = createSilence(100)
      const base64 = float32ToWavBase64(audio, 16000)
      const binary = atob(base64)

      // Bits per sample is at bytes 34-35 (little-endian)
      const bitsPerSample = binary.charCodeAt(34) | (binary.charCodeAt(35) << 8)

      expect(bitsPerSample).toBe(16)
    })
  })

  describe("data size calculations", () => {
    it("calculates correct file size", () => {
      const numSamples = 100
      const audio = createSilence(numSamples)
      const base64 = float32ToWavBase64(audio, 16000)
      const binary = atob(base64)

      // Total size should be 44 bytes header + (numSamples * 2 bytes per sample)
      const expectedSize = 44 + numSamples * 2
      expect(binary.length).toBe(expectedSize)
    })

    it("encodes correct data chunk size", () => {
      const numSamples = 100
      const audio = createSilence(numSamples)
      const base64 = float32ToWavBase64(audio, 16000)
      const binary = atob(base64)

      // Data size is at bytes 40-43 (little-endian)
      const dataSize =
        binary.charCodeAt(40) |
        (binary.charCodeAt(41) << 8) |
        (binary.charCodeAt(42) << 16) |
        (binary.charCodeAt(43) << 24)

      expect(dataSize).toBe(numSamples * 2)
    })
  })

  describe("edge cases", () => {
    it("handles empty audio array", () => {
      const audio = new Float32Array([])
      const base64 = float32ToWavBase64(audio, 16000)

      // Should still produce valid WAV header
      const binary = atob(base64)
      expect(binary.length).toBe(44) // Header only, no data
    })

    it("handles very short audio (1 sample)", () => {
      const audio = new Float32Array([0.5])
      const base64 = float32ToWavBase64(audio, 16000)
      const binary = atob(base64)

      expect(binary.length).toBe(46) // 44 header + 2 bytes for 1 sample
    })

    it("handles longer audio (1 second at 16kHz)", () => {
      const audio = createSineWave(440, 16000, 1.0)
      const base64 = float32ToWavBase64(audio, 16000)
      const binary = atob(base64)

      const expectedSize = 44 + 16000 * 2
      expect(binary.length).toBe(expectedSize)
    })
  })
})

describe("float32ToBase64Pcm", () => {
  it("produces valid base64 output", () => {
    const audio = createSilence(100)
    const base64 = float32ToBase64Pcm(audio)

    expect(() => atob(base64)).not.toThrow()
  })

  it("produces raw PCM without WAV header", () => {
    const numSamples = 100
    const audio = createSilence(numSamples)
    const base64 = float32ToBase64Pcm(audio)
    const binary = atob(base64)

    // Should be exactly numSamples * 2 bytes (no 44-byte header)
    expect(binary.length).toBe(numSamples * 2)
  })

  it("does not contain RIFF header", () => {
    const audio = createSilence(100)
    const base64 = float32ToBase64Pcm(audio)
    const binary = atob(base64)

    // First 4 bytes should NOT be "RIFF" (raw PCM, not WAV)
    expect(binary.slice(0, 4)).not.toBe("RIFF")
  })
})

describe("calculateRMS", () => {
  describe("basic calculations", () => {
    it("returns 0 for empty array", () => {
      const audio = new Float32Array([])
      expect(calculateRMS(audio)).toBe(0)
    })

    it("returns 0 for silence", () => {
      const audio = createSilence(100)
      expect(calculateRMS(audio)).toBe(0)
    })

    it("returns correct RMS for constant value", () => {
      // RMS of constant value is the absolute value of that constant
      const audio = new Float32Array([0.5, 0.5, 0.5, 0.5])
      expect(calculateRMS(audio)).toBeCloseTo(0.5, 5)
    })

    it("returns correct RMS for negative constant value", () => {
      const audio = new Float32Array([-0.5, -0.5, -0.5, -0.5])
      expect(calculateRMS(audio)).toBeCloseTo(0.5, 5)
    })
  })

  describe("sine wave RMS", () => {
    it("calculates approximately 0.707 for unit sine wave", () => {
      // RMS of sine wave with amplitude 1 is 1/sqrt(2) ≈ 0.7071
      const audio = createSineWave(440, 16000, 0.1)
      const rms = calculateRMS(audio)
      expect(rms).toBeCloseTo(0.7071, 1)
    })

    it("scales linearly with amplitude", () => {
      const audio1 = createSineWave(440, 16000, 0.1)
      // Scale by 0.5
      const audio2 = audio1.map((sample) => sample * 0.5)

      const rms1 = calculateRMS(audio1)
      const rms2 = calculateRMS(new Float32Array(audio2))

      expect(rms2).toBeCloseTo(rms1 * 0.5, 2)
    })
  })

  describe("edge cases", () => {
    it("handles single sample", () => {
      const audio = new Float32Array([0.5])
      expect(calculateRMS(audio)).toBe(0.5)
    })

    it("handles very small values", () => {
      const audio = new Float32Array([0.0001, 0.0001, 0.0001])
      const rms = calculateRMS(audio)
      expect(rms).toBeCloseTo(0.0001, 6)
    })

    it("handles mixed positive and negative values", () => {
      const audio = new Float32Array([0.5, -0.5, 0.5, -0.5])
      const rms = calculateRMS(audio)
      // RMS should be 0.5 regardless of sign
      expect(rms).toBeCloseTo(0.5, 5)
    })
  })
})
