"use client"

// Dynamic import to avoid SSR issues with onnxruntime-web
// The vad-web package imports onnxruntime-web/wasm which requires browser APIs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let NonRealTimeVADClass: any = null

async function getVAD() {
  if (typeof window === "undefined") {
    throw new Error("VAD can only be used in browser environment")
  }
  if (!NonRealTimeVADClass) {
    const vadModule = await import("@ricky0123/vad-web")
    NonRealTimeVADClass = vadModule.NonRealTimeVAD
  }
  return NonRealTimeVADClass
}

export interface VADOptions {
  /**
   * Sample rate for audio processing (must be 16kHz for Silero VAD)
   */
  sampleRate?: number

  /**
   * Minimum speech duration in milliseconds to consider as valid speech
   */
  minSpeechDuration?: number

  /**
   * Minimum silence duration in milliseconds before considering speech ended
   */
  minSilenceDuration?: number

  /**
   * Probability threshold for speech detection (0-1)
   */
  positiveSpeechThreshold?: number

  /**
   * Probability threshold for silence detection (0-1)
   */
  negativeSpeechThreshold?: number
}

export interface SpeechSegment {
  audio: Float32Array
  start: number // seconds
  end: number // seconds
}

const DEFAULT_SAMPLE_RATE = 16000 // Required by Silero VAD
const DEFAULT_MIN_SPEECH_MS = 250
const DEFAULT_MIN_SILENCE_MS = 500
const DEFAULT_POSITIVE_THRESHOLD = 0.5
const DEFAULT_NEGATIVE_THRESHOLD = 0.35

/**
 * Voice Activity Detection using Silero VAD
 * Segments audio into speech and non-speech regions
 */
export class VoiceActivityDetector {
  private options: Required<VADOptions>

  constructor(options: VADOptions = {}) {
    this.options = {
      sampleRate: options.sampleRate ?? DEFAULT_SAMPLE_RATE,
      minSpeechDuration: options.minSpeechDuration ?? DEFAULT_MIN_SPEECH_MS,
      minSilenceDuration: options.minSilenceDuration ?? DEFAULT_MIN_SILENCE_MS,
      positiveSpeechThreshold:
        options.positiveSpeechThreshold ?? DEFAULT_POSITIVE_THRESHOLD,
      negativeSpeechThreshold:
        options.negativeSpeechThreshold ?? DEFAULT_NEGATIVE_THRESHOLD,
    }

    // Validate sample rate
    if (this.options.sampleRate !== 16000) {
      console.warn(
        `Silero VAD requires 16kHz sample rate. Got ${this.options.sampleRate}Hz. Converting...`
      )
    }
  }

  /**
   * Segment audio into speech regions
   * Returns array of speech segments with timing information
   */
  async segment(audioData: Float32Array): Promise<SpeechSegment[]> {
    try {
      // Resample if necessary
      const processedAudio =
        this.options.sampleRate === 16000
          ? audioData
          : this.resample(audioData, this.options.sampleRate, 16000)

      // Process with VAD
      const segments = await this.processWithVAD(processedAudio)

      return segments
    } catch (error) {
      console.error("VAD segmentation failed:", error)
      // Fallback: return entire audio as single segment
      return [
        {
          audio: audioData,
          start: 0,
          end: audioData.length / this.options.sampleRate,
        },
      ]
    }
  }

  /**
   * Process audio with Silero VAD using NonRealTimeVAD for offline processing
   */
  private async processWithVAD(audioData: Float32Array): Promise<SpeechSegment[]> {
    const segments: SpeechSegment[] = []

    // Get VAD class via dynamic import (avoids SSR issues)
    const NonRealTimeVAD = await getVAD()

    // Create NonRealTimeVAD instance for offline audio processing
    const vad = await NonRealTimeVAD.new({
      positiveSpeechThreshold: this.options.positiveSpeechThreshold,
      negativeSpeechThreshold: this.options.negativeSpeechThreshold,
      minSpeechMs: this.options.minSpeechDuration,
      redemptionMs: this.options.minSilenceDuration,
      // Load ONNX model from CDN (not bundled with Next.js)
      modelURL: "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.30/dist/silero_vad_legacy.onnx",
      // Configure ONNX Runtime WASM paths to use CDN
      ortConfig: (ort) => {
        ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/"
      },
    })

    // NonRealTimeVAD.run() is an async generator for pre-recorded audio
    for await (const { audio, start, end } of vad.run(audioData, 16000)) {
      segments.push({
        audio: new Float32Array(audio),
        start: start / 1000, // Convert ms to seconds
        end: end / 1000,
      })
    }

    // If no segments detected, return entire audio as single segment
    if (segments.length === 0) {
      segments.push({
        audio: audioData,
        start: 0,
        end: audioData.length / 16000,
      })
    }

    return segments
  }

  /**
   * Simple linear interpolation resampling
   * For production, consider using a proper resampling library
   */
  private resample(
    audioData: Float32Array,
    fromRate: number,
    toRate: number
  ): Float32Array {
    if (fromRate === toRate) return audioData

    const ratio = toRate / fromRate
    const newLength = Math.round(audioData.length * ratio)
    const resampled = new Float32Array(newLength)

    for (let i = 0; i < newLength; i++) {
      const srcIndex = i / ratio
      const srcIndexFloor = Math.floor(srcIndex)
      const srcIndexCeil = Math.min(srcIndexFloor + 1, audioData.length - 1)
      const fraction = srcIndex - srcIndexFloor

      // Linear interpolation
      resampled[i] =
        audioData[srcIndexFloor] * (1 - fraction) +
        audioData[srcIndexCeil] * fraction
    }

    return resampled
  }
}

/**
 * Simplified VAD using energy-based detection
 * Fallback when Silero VAD is not available or fails
 */
export class SimpleVAD {
  private sampleRate: number
  private energyThreshold: number

  constructor(sampleRate: number = 16000, energyThreshold: number = 0.01) {
    this.sampleRate = sampleRate
    this.energyThreshold = energyThreshold
  }

  /**
   * Segment audio using energy-based detection
   */
  segment(audioData: Float32Array): SpeechSegment[] {
    const frameSize = 512
    const hopSize = 256
    const frames: { energy: number; index: number }[] = []

    // Calculate energy for each frame
    for (let i = 0; i < audioData.length - frameSize; i += hopSize) {
      const frame = audioData.slice(i, i + frameSize)
      const energy = this.calculateEnergy(frame)
      frames.push({ energy, index: i })
    }

    // Calculate adaptive threshold
    const energies = frames.map((f) => f.energy)
    const meanEnergy = energies.reduce((a, b) => a + b, 0) / energies.length
    const threshold = meanEnergy * this.energyThreshold

    // Find speech segments
    const segments: SpeechSegment[] = []
    let segmentStart: number | null = null

    for (let i = 0; i < frames.length; i++) {
      const isSpeech = frames[i].energy > threshold

      if (isSpeech && segmentStart === null) {
        // Start of speech segment
        segmentStart = frames[i].index
      } else if (!isSpeech && segmentStart !== null) {
        // End of speech segment
        const segmentEnd = frames[i].index
        const segmentAudio = audioData.slice(segmentStart, segmentEnd)

        segments.push({
          audio: segmentAudio,
          start: segmentStart / this.sampleRate,
          end: segmentEnd / this.sampleRate,
        })

        segmentStart = null
      }
    }

    // Handle case where speech continues to end
    if (segmentStart !== null) {
      segments.push({
        audio: audioData.slice(segmentStart),
        start: segmentStart / this.sampleRate,
        end: audioData.length / this.sampleRate,
      })
    }

    // If no segments found, return entire audio
    if (segments.length === 0) {
      segments.push({
        audio: audioData,
        start: 0,
        end: audioData.length / this.sampleRate,
      })
    }

    return segments
  }

  /**
   * Calculate RMS energy of audio frame
   */
  private calculateEnergy(frame: Float32Array): number {
    let sum = 0
    for (let i = 0; i < frame.length; i++) {
      sum += frame[i] * frame[i]
    }
    return Math.sqrt(sum / frame.length)
  }
}

/**
 * Convenience function to segment audio with fallback to simple VAD
 */
export async function segmentSpeech(
  audioData: Float32Array,
  options?: VADOptions
): Promise<SpeechSegment[]> {
  try {
    const vad = new VoiceActivityDetector(options)
    return await vad.segment(audioData)
  } catch (error) {
    console.warn("Silero VAD failed, falling back to energy-based VAD:", error)
    const simpleVad = new SimpleVAD(options?.sampleRate ?? 16000)
    return simpleVad.segment(audioData)
  }
}
