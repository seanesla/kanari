"use client"

import Meyda from "meyda"
import type { AudioFeatures } from "@/lib/types"

export interface FeatureExtractionOptions {
  sampleRate?: number
  bufferSize?: number
  hopSize?: number
}

const DEFAULT_SAMPLE_RATE = 16000
const DEFAULT_BUFFER_SIZE = 512
const DEFAULT_HOP_SIZE = 256

// Pitch detection constants
const YIN_THRESHOLD = 0.15 // Confidence threshold for pitch detection
const MIN_PITCH_HZ = 50 // Minimum detectable pitch (low male voice)
const MAX_PITCH_HZ = 500 // Maximum detectable pitch (high female voice)

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

    // Configure Meyda globals for offline processing
    // Required for spectralFlux and other features that depend on buffer/sample rate
    Meyda.bufferSize = this.bufferSize
    Meyda.sampleRate = this.sampleRate
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

    // Extract pitch features using YIN algorithm
    const pitchFeatures = this.extractPitchFeatures(audioData)

    return {
      mfcc,
      spectralCentroid,
      spectralFlux,
      spectralRolloff,
      rms,
      zcr,
      ...temporalFeatures,
      ...pitchFeatures,
    }
  }

  /**
   * Calculate spectral flux manually (L2 norm of spectrum difference)
   * This avoids Meyda 5.6.3 bug with spectralFlux calculation
   */
  private calculateSpectralFlux(
    currentSpectrum: number[],
    previousSpectrum: number[]
  ): number {
    let sum = 0
    const len = Math.min(currentSpectrum.length, previousSpectrum.length)
    for (let i = 0; i < len; i++) {
      const diff = currentSpectrum[i] - previousSpectrum[i]
      sum += diff * diff
    }
    return Math.sqrt(sum)
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

    // Track previous amplitude spectrum for manual spectralFlux calculation
    // (Meyda 5.6.3 has a bug with spectralFlux when using Meyda.extract())
    let previousSpectrum: number[] | null = null

    for (let i = 0; i < numFrames; i++) {
      const start = i * this.hopSize
      const end = start + this.bufferSize

      // Extract frame
      const frame = audioData.slice(start, end)

      try {
        // Use Meyda to extract features for this frame
        // Note: spectralFlux is computed manually to avoid Meyda bug
        const features = Meyda.extract(
          [
            "mfcc",
            "spectralCentroid",
            "amplitudeSpectrum",
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
          if (typeof features.spectralRolloff === "number")
            spectralRolloff.push(features.spectralRolloff)
          if (typeof features.rms === "number") rms.push(features.rms)
          if (typeof features.zcr === "number") zcr.push(features.zcr)

          // Calculate spectralFlux manually using amplitude spectrum
          const currentSpectrum = features.amplitudeSpectrum as number[] | undefined
          if (currentSpectrum && previousSpectrum) {
            const flux = this.calculateSpectralFlux(currentSpectrum, previousSpectrum)
            spectralFlux.push(flux)
          }

          // Store current spectrum for next iteration
          if (currentSpectrum) {
            previousSpectrum = [...currentSpectrum]
          }
        }
      } catch (error) {
        // Skip frame on extraction error
        console.warn("Feature extraction failed for frame, skipping:", error)
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

  /**
   * Calculate standard deviation of array
   */
  private stdDev(values: number[]): number {
    if (values.length < 2) return 0
    const avg = this.mean(values)
    const squaredDiffs = values.map((v) => (v - avg) ** 2)
    return Math.sqrt(this.mean(squaredDiffs))
  }

  /**
   * YIN pitch detection algorithm
   * Returns fundamental frequency in Hz, or null if unvoiced/uncertain
   */
  private extractPitch(frame: Float32Array): number | null {
    const halfLength = Math.floor(frame.length / 2)

    // Compute min/max lags based on pitch range
    const minLag = Math.floor(this.sampleRate / MAX_PITCH_HZ)
    const maxLag = Math.min(halfLength, Math.floor(this.sampleRate / MIN_PITCH_HZ))

    if (maxLag <= minLag) return null

    // Step 1: Compute difference function d(τ)
    const diff = new Float32Array(maxLag + 1)
    for (let tau = 1; tau <= maxLag; tau++) {
      let sum = 0
      for (let j = 0; j < halfLength; j++) {
        const delta = frame[j] - frame[j + tau]
        sum += delta * delta
      }
      diff[tau] = sum
    }

    // Step 2: Compute cumulative mean normalized difference d'(τ)
    const cmndf = new Float32Array(maxLag + 1)
    cmndf[0] = 1
    let runningSum = 0
    for (let tau = 1; tau <= maxLag; tau++) {
      runningSum += diff[tau]
      cmndf[tau] = runningSum > 0 ? (diff[tau] * tau) / runningSum : 1
    }

    // Step 3: Absolute threshold - find first dip below threshold
    let bestTau = -1
    for (let tau = minLag; tau <= maxLag; tau++) {
      if (cmndf[tau] < YIN_THRESHOLD) {
        // Find local minimum
        while (tau + 1 <= maxLag && cmndf[tau + 1] < cmndf[tau]) {
          tau++
        }
        bestTau = tau
        break
      }
    }

    if (bestTau === -1) return null

    // Step 4: Parabolic interpolation for sub-sample accuracy
    if (bestTau > 0 && bestTau < maxLag) {
      const s0 = cmndf[bestTau - 1]
      const s1 = cmndf[bestTau]
      const s2 = cmndf[bestTau + 1]
      const adjustment = (s2 - s0) / (2 * (2 * s1 - s2 - s0))
      if (Math.abs(adjustment) < 1) {
        bestTau = bestTau + adjustment
      }
    }

    // Convert lag to frequency
    const pitch = this.sampleRate / bestTau
    return pitch >= MIN_PITCH_HZ && pitch <= MAX_PITCH_HZ ? pitch : null
  }

  /**
   * Extract pitch features across all frames
   */
  private extractPitchFeatures(audioData: Float32Array): {
    pitchMean: number
    pitchStdDev: number
    pitchRange: number
  } {
    const pitchValues: number[] = []
    const numFrames = Math.floor((audioData.length - this.bufferSize) / this.hopSize) + 1

    for (let i = 0; i < numFrames; i++) {
      const start = i * this.hopSize
      const end = start + this.bufferSize
      const frame = audioData.slice(start, end)

      const pitch = this.extractPitch(frame)
      if (pitch !== null) {
        pitchValues.push(pitch)
      }
    }

    if (pitchValues.length === 0) {
      return { pitchMean: 0, pitchStdDev: 0, pitchRange: 0 }
    }

    const pitchMean = this.mean(pitchValues)
    const pitchStdDev = this.stdDev(pitchValues)
    const pitchRange = Math.max(...pitchValues) - Math.min(...pitchValues)

    return { pitchMean, pitchStdDev, pitchRange }
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
