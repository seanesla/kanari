"use client"

import Meyda, { MeydaAnalyzer } from "meyda"
import type { AudioFeatures } from "@/lib/types"

export interface FeatureExtractionOptions {
  sampleRate?: number
  bufferSize?: number
  hopSize?: number
}

const DEFAULT_SAMPLE_RATE = 16000
const DEFAULT_BUFFER_SIZE = 512
const DEFAULT_HOP_SIZE = 256

/**
 * Extract audio features from raw audio data using Meyda
 */
export class FeatureExtractor {
  private sampleRate: number
  private bufferSize: number
  private hopSize: number

  constructor(options: FeatureExtractionOptions = {}) {
    this.sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE
    this.bufferSize = options.bufferSize ?? DEFAULT_BUFFER_SIZE
    this.hopSize = options.hopSize ?? DEFAULT_HOP_SIZE
  }

  /**
   * Extract complete audio features from audio buffer
   */
  extract(audioData: Float32Array): AudioFeatures {
    // Extract frame-level features using windowed analysis
    const frameFeatures = this.extractFrameFeatures(audioData)

    // Aggregate frame features into summary statistics
    const spectralCentroid = this.mean(frameFeatures.spectralCentroid)
    const spectralFlux = this.mean(frameFeatures.spectralFlux)
    const spectralRolloff = this.mean(frameFeatures.spectralRolloff)
    const rms = this.mean(frameFeatures.rms)
    const zcr = this.mean(frameFeatures.zcr)
    const mfcc = this.aggregateMFCCs(frameFeatures.mfcc)

    // Extract temporal features (speech rate, pauses)
    const temporalFeatures = this.extractTemporalFeatures(audioData, frameFeatures.rms)

    return {
      mfcc,
      spectralCentroid,
      spectralFlux,
      spectralRolloff,
      rms,
      zcr,
      ...temporalFeatures,
    }
  }

  /**
   * Extract features frame-by-frame using sliding window
   */
  private extractFrameFeatures(audioData: Float32Array) {
    const mfccFrames: number[][] = []
    const spectralCentroid: number[] = []
    const spectralFlux: number[] = []
    const spectralRolloff: number[] = []
    const rms: number[] = []
    const zcr: number[] = []

    // Process audio in overlapping windows
    const numFrames = Math.floor((audioData.length - this.bufferSize) / this.hopSize) + 1

    for (let i = 0; i < numFrames; i++) {
      const start = i * this.hopSize
      const end = start + this.bufferSize

      // Extract frame
      const frame = audioData.slice(start, end)

      // Use Meyda to extract features for this frame
      const features = Meyda.extract(
        [
          "mfcc",
          "spectralCentroid",
          "spectralFlux",
          "spectralRolloff",
          "rms",
          "zcr",
        ],
        frame
      )

      if (features) {
        if (features.mfcc) mfccFrames.push(features.mfcc as number[])
        if (typeof features.spectralCentroid === "number")
          spectralCentroid.push(features.spectralCentroid)
        if (typeof features.spectralFlux === "number")
          spectralFlux.push(features.spectralFlux)
        if (typeof features.spectralRolloff === "number")
          spectralRolloff.push(features.spectralRolloff)
        if (typeof features.rms === "number") rms.push(features.rms)
        if (typeof features.zcr === "number") zcr.push(features.zcr)
      }
    }

    return {
      mfcc: mfccFrames,
      spectralCentroid,
      spectralFlux,
      spectralRolloff,
      rms,
      zcr,
    }
  }

  /**
   * Extract temporal features: speech rate, pause ratio, pause count, average pause duration
   */
  private extractTemporalFeatures(audioData: Float32Array, rmsValues: number[]) {
    // Energy-based voice activity detection
    const rmsThreshold = this.mean(rmsValues) * 0.3 // 30% of mean RMS as threshold
    const frameDuration = this.hopSize / this.sampleRate // Duration of each frame in seconds

    // Detect speech/silence frames
    const speechFrames: boolean[] = rmsValues.map((rms) => rms > rmsThreshold)

    // Count pauses (transitions from speech to silence)
    let pauseCount = 0
    let currentPauseDuration = 0
    const pauseDurations: number[] = []
    let speechDuration = 0
    let silenceDuration = 0

    for (let i = 0; i < speechFrames.length; i++) {
      if (speechFrames[i]) {
        // Speech frame
        speechDuration += frameDuration

        // End of pause
        if (i > 0 && !speechFrames[i - 1] && currentPauseDuration > 0) {
          pauseDurations.push(currentPauseDuration)
          currentPauseDuration = 0
        }
      } else {
        // Silence frame
        silenceDuration += frameDuration
        currentPauseDuration += frameDuration

        // Start of new pause
        if (i > 0 && speechFrames[i - 1]) {
          pauseCount++
        }
      }
    }

    // Add final pause if recording ended during silence
    if (currentPauseDuration > 0) {
      pauseDurations.push(currentPauseDuration)
    }

    // Calculate pause ratio
    const totalDuration = (audioData.length / this.sampleRate)
    const pauseRatio = totalDuration > 0 ? silenceDuration / totalDuration : 0

    // Calculate average pause duration (in milliseconds)
    const avgPauseDuration =
      pauseDurations.length > 0
        ? (this.mean(pauseDurations) * 1000)
        : 0

    // Estimate speech rate (syllables per second)
    // Using energy peaks as proxy for syllables
    const speechRate = this.estimateSpeechRate(rmsValues, speechFrames, frameDuration)

    return {
      speechRate,
      pauseRatio,
      pauseCount,
      avgPauseDuration,
    }
  }

  /**
   * Estimate speech rate using energy peaks as syllable proxy
   */
  private estimateSpeechRate(
    rmsValues: number[],
    speechFrames: boolean[],
    frameDuration: number
  ): number {
    // Only consider speech frames
    const speechRms = rmsValues.filter((_, i) => speechFrames[i])

    if (speechRms.length === 0) return 0

    // Find peaks in RMS (potential syllables)
    const rmsThreshold = this.mean(speechRms) * 0.8
    let peakCount = 0

    for (let i = 1; i < speechRms.length - 1; i++) {
      // Peak detection: local maximum above threshold
      if (
        speechRms[i] > rmsThreshold &&
        speechRms[i] > speechRms[i - 1] &&
        speechRms[i] > speechRms[i + 1]
      ) {
        peakCount++
      }
    }

    // Calculate speech duration (only counting speech frames)
    const speechDuration = speechFrames.filter(Boolean).length * frameDuration

    // Speech rate = peaks (syllables) per second
    return speechDuration > 0 ? peakCount / speechDuration : 0
  }

  /**
   * Aggregate MFCCs across frames by taking mean of each coefficient
   */
  private aggregateMFCCs(mfccFrames: number[][]): number[] {
    if (mfccFrames.length === 0) {
      return Array(13).fill(0) // Return 13 zero coefficients
    }

    const numCoefficients = mfccFrames[0]?.length ?? 13
    const aggregated: number[] = []

    for (let coef = 0; coef < numCoefficients; coef++) {
      const coefficientValues = mfccFrames.map((frame) => frame[coef] ?? 0)
      aggregated.push(this.mean(coefficientValues))
    }

    return aggregated
  }

  /**
   * Calculate mean of array
   */
  private mean(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }
}

/**
 * Convenience function to extract features from audio data
 */
export function extractFeatures(
  audioData: Float32Array,
  options?: FeatureExtractionOptions
): AudioFeatures {
  const extractor = new FeatureExtractor(options)
  return extractor.extract(audioData)
}
