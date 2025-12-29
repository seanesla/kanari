"use client"

import type { AudioFeatures } from "@/lib/types"
import { FeatureExtractor } from "./feature-extractor"
import { segmentSpeech, type SpeechSegment } from "./vad"

export interface ProcessorOptions {
  /**
   * Sample rate of the input audio
   */
  sampleRate?: number

  /**
   * Enable Voice Activity Detection to filter non-speech segments
   */
  enableVAD?: boolean

  /**
   * VAD configuration
   */
  vadOptions?: {
    minSpeechDuration?: number
    minSilenceDuration?: number
    positiveSpeechThreshold?: number
    negativeSpeechThreshold?: number
  }

  /**
   * Feature extraction configuration
   */
  featureOptions?: {
    bufferSize?: number
    hopSize?: number
  }
}

export interface ProcessingResult {
  /**
   * Extracted audio features
   */
  features: AudioFeatures

  /**
   * Speech segments detected by VAD (if enabled)
   */
  segments?: SpeechSegment[]

  /**
   * Processing metadata
   */
  metadata: {
    duration: number // Total audio duration in seconds
    speechDuration: number // Duration of detected speech in seconds
    processingTime: number // Time taken to process in milliseconds
    vadEnabled: boolean
  }
}

const DEFAULT_SAMPLE_RATE = 16000

/**
 * Audio Processor - Main orchestrator for audio processing pipeline
 *
 * Pipeline:
 * 1. Raw audio input (Float32Array)
 * 2. Voice Activity Detection (optional) - segments speech from silence
 * 3. Feature Extraction - extracts acoustic features using Meyda
 * 4. Returns features + metadata
 */
export class AudioProcessor {
  private options: Required<ProcessorOptions>
  private featureExtractor: FeatureExtractor

  constructor(options: ProcessorOptions = {}) {
    this.options = {
      sampleRate: options.sampleRate ?? DEFAULT_SAMPLE_RATE,
      enableVAD: options.enableVAD ?? true,
      vadOptions: options.vadOptions ?? {},
      featureOptions: options.featureOptions ?? {},
    }

    // Initialize feature extractor
    this.featureExtractor = new FeatureExtractor({
      sampleRate: this.options.sampleRate,
      ...this.options.featureOptions,
    })
  }

  /**
   * Process audio through the complete pipeline
   */
  async process(audioData: Float32Array): Promise<ProcessingResult> {
    const startTime = performance.now()

    try {
      // Calculate total duration
      const totalDuration = audioData.length / this.options.sampleRate

      let segments: SpeechSegment[] | undefined
      let processedAudio: Float32Array = audioData
      let speechDuration = totalDuration

      // Step 1: Voice Activity Detection (if enabled)
      if (this.options.enableVAD) {
        segments = await this.runVAD(audioData)

        // Concatenate all speech segments
        if (segments.length > 0) {
          processedAudio = this.concatenateSegments(segments)
          speechDuration = segments.reduce(
            (sum, seg) => sum + (seg.end - seg.start),
            0
          )
        }
      }

      // Step 2: Feature Extraction
      const features = this.featureExtractor.extract(processedAudio)

      // Calculate processing time
      const processingTime = performance.now() - startTime

      return {
        features,
        segments,
        metadata: {
          duration: totalDuration,
          speechDuration,
          processingTime,
          vadEnabled: this.options.enableVAD,
        },
      }
    } catch (error) {
      console.error("Audio processing failed:", error)
      throw new Error(
        `Failed to process audio: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }

  /**
   * Run Voice Activity Detection
   */
  private async runVAD(audioData: Float32Array): Promise<SpeechSegment[]> {
    try {
      const segments = await segmentSpeech(audioData, {
        sampleRate: this.options.sampleRate,
        ...this.options.vadOptions,
      })

      console.log(`VAD detected ${segments.length} speech segments`)
      return segments
    } catch (error) {
      console.error("VAD failed:", error)
      // Return entire audio as single segment on failure
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
   * Concatenate speech segments into continuous audio
   */
  private concatenateSegments(segments: SpeechSegment[]): Float32Array {
    // Calculate total length
    const totalLength = segments.reduce((sum, seg) => sum + seg.audio.length, 0)

    // Create result buffer
    const concatenated = new Float32Array(totalLength)

    // Copy segments
    let offset = 0
    for (const segment of segments) {
      concatenated.set(segment.audio, offset)
      offset += segment.audio.length
    }

    return concatenated
  }

  /**
   * Update processor options
   */
  updateOptions(options: Partial<ProcessorOptions>): void {
    if (options.sampleRate !== undefined) {
      this.options.sampleRate = options.sampleRate
    }
    if (options.enableVAD !== undefined) {
      this.options.enableVAD = options.enableVAD
    }
    if (options.vadOptions !== undefined) {
      this.options.vadOptions = { ...this.options.vadOptions, ...options.vadOptions }
    }
    if (options.featureOptions !== undefined) {
      this.options.featureOptions = {
        ...this.options.featureOptions,
        ...options.featureOptions,
      }

      // Recreate feature extractor with new options
      this.featureExtractor = new FeatureExtractor({
        sampleRate: this.options.sampleRate,
        ...this.options.featureOptions,
      })
    }
  }
}

/**
 * Convenience function to process audio with default settings
 */
export async function processAudio(
  audioData: Float32Array,
  options?: ProcessorOptions
): Promise<ProcessingResult> {
  const processor = new AudioProcessor(options)
  return processor.process(audioData)
}

/**
 * Validate audio data
 */
export function validateAudioData(audioData: Float32Array): boolean {
  if (!audioData || audioData.length === 0) {
    return false
  }

  // Check for all zeros (silent audio)
  const hasSignal = Array.from(audioData).some((sample) => Math.abs(sample) > 0.001)
  if (!hasSignal) {
    return false
  }

  // Check for clipping (values outside -1 to 1)
  const isClipped = Array.from(audioData).some((sample) => Math.abs(sample) > 1.0)
  if (isClipped) {
    console.warn("Audio data contains clipping (values > 1.0)")
  }

  return true
}
