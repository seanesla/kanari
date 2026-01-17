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
const DEFAULT_SPECTRAL_ROLLOFF_PERCENT = 0.85

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
   * Calculate RMS energy of a frame
   */
  private calculateRms(frame: Float32Array): number {
    if (frame.length === 0) return 0

    let sumSquares = 0
    for (let i = 0; i < frame.length; i++) {
      const s = frame[i]
      sumSquares += s * s
    }

    return Math.sqrt(sumSquares / frame.length)
  }

  /**
   * Calculate zero crossing rate (normalized 0..1)
   */
  private calculateZcr(frame: Float32Array): number {
    if (frame.length < 2) return 0

    let crossings = 0
    let prev = frame[0] ?? 0
    for (let i = 1; i < frame.length; i++) {
      const current = frame[i] ?? 0
      if ((prev >= 0 && current < 0) || (prev < 0 && current >= 0)) {
        crossings++
      }
      prev = current
    }

    return crossings / frame.length
  }

  private sumSpectrum(spectrum: ArrayLike<number>): number {
    let sum = 0
    for (let i = 0; i < spectrum.length; i++) {
      const v = spectrum[i] ?? 0
      if (Number.isFinite(v)) sum += Math.abs(v)
    }
    return sum
  }

  /**
   * Calculate spectral centroid as a normalized value (0..1).
   *
   * We compute this manually from the amplitude spectrum to ensure consistent units
   * across environments (Meyda output has differed between runtimes).
   *
   * Pattern doc: docs/error-patterns/voice-feature-unit-mismatch-causes-stuck-scores.md
   */
  private calculateSpectralCentroidNormalized(spectrum: ArrayLike<number>): number {
    const total = this.sumSpectrum(spectrum)
    if (total <= 0) return 0

    let weightedIndexSum = 0
    for (let i = 0; i < spectrum.length; i++) {
      const v = spectrum[i] ?? 0
      if (!Number.isFinite(v)) continue
      weightedIndexSum += i * Math.abs(v)
    }

    // Convert bin index to normalized frequency: f_norm = (i * sampleRate / bufferSize) / (sampleRate/2) = 2i/bufferSize
    const centroidNorm = (2 * weightedIndexSum) / (this.bufferSize * total)
    return Math.max(0, Math.min(1, centroidNorm))
  }

  /**
   * Calculate spectral rolloff as a normalized value (0..1).
   * Rolloff is the frequency below which `percent` of the spectral energy is contained.
   */
  private calculateSpectralRolloffNormalized(
    spectrum: ArrayLike<number>,
    percent: number = DEFAULT_SPECTRAL_ROLLOFF_PERCENT
  ): number {
    const total = this.sumSpectrum(spectrum)
    if (total <= 0) return 0

    const target = total * Math.max(0, Math.min(1, percent))
    let cumulative = 0
    let rolloffIndex = 0
    for (let i = 0; i < spectrum.length; i++) {
      const v = spectrum[i] ?? 0
      if (!Number.isFinite(v)) continue
      cumulative += Math.abs(v)
      if (cumulative >= target) {
        rolloffIndex = i
        break
      }
    }

    const rolloffNorm = (2 * rolloffIndex) / this.bufferSize
    return Math.max(0, Math.min(1, rolloffNorm))
  }

  /**
   * Calculate spectral flux (normalized 0..1) between two spectra.
   *
   * Uses L2 distance between L1-normalized spectra, then scales by sqrt(2)
   * (the max possible L2 distance between two probability distributions).
   */
  private calculateSpectralFluxNormalized(
    currentSpectrum: ArrayLike<number>,
    previousSpectrum: ArrayLike<number>
  ): number {
    const currentSum = this.sumSpectrum(currentSpectrum)
    const previousSum = this.sumSpectrum(previousSpectrum)
    if (currentSum <= 0 || previousSum <= 0) return 0

    const len = Math.min(currentSpectrum.length, previousSpectrum.length)
    let diffSquares = 0

    for (let i = 0; i < len; i++) {
      const c = currentSpectrum[i] ?? 0
      const p = previousSpectrum[i] ?? 0
      if (!Number.isFinite(c) || !Number.isFinite(p)) continue
      const cNorm = Math.abs(c) / currentSum
      const pNorm = Math.abs(p) / previousSum
      const diff = cNorm - pNorm
      diffSquares += diff * diff
    }

    const flux = Math.sqrt(diffSquares) / Math.SQRT2
    return Math.max(0, Math.min(1, flux))
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
    let previousSpectrum: Float32Array | number[] | null = null

    for (let i = 0; i < numFrames; i++) {
      const start = i * this.hopSize
      const end = start + this.bufferSize

      // Extract frame
      const frame = audioData.slice(start, end)

      // Always compute time-domain features, even if Meyda extraction fails.
      rms.push(this.calculateRms(frame))
      zcr.push(this.calculateZcr(frame))

      try {
        // Use Meyda to extract features for this frame
        // Note: spectralFlux is computed manually to avoid Meyda bug
        const features = Meyda.extract(
          [
            "mfcc",
            "amplitudeSpectrum",
          ],
          frame
        )

        if (features) {
          if (features.mfcc) mfccFrames.push(features.mfcc as number[])

          // Calculate spectralFlux manually using amplitude spectrum
          const currentSpectrum = features.amplitudeSpectrum as ArrayLike<number> | undefined
          if (currentSpectrum) {
            const centroidNorm = this.calculateSpectralCentroidNormalized(currentSpectrum)
            if (Number.isFinite(centroidNorm)) {
              spectralCentroid.push(centroidNorm)
            }

            const rolloffNorm = this.calculateSpectralRolloffNormalized(currentSpectrum)
            if (Number.isFinite(rolloffNorm)) {
              spectralRolloff.push(rolloffNorm)
            }

            if (previousSpectrum) {
              const fluxNorm = this.calculateSpectralFluxNormalized(currentSpectrum, previousSpectrum)
              if (Number.isFinite(fluxNorm)) {
                spectralFlux.push(fluxNorm)
              }
            }

            // Store current spectrum for next iteration (copy to avoid mutation/reuse issues).
            previousSpectrum = Array.from(currentSpectrum)
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
    let silenceDuration = 0

    for (let i = 0; i < speechFrames.length; i++) {
      if (speechFrames[i]) {
        // Speech frame
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
    if (speechDuration <= 0) return 0

    // Overlapping windows can over-count peaks vs duration.
    // Compensate by scaling with hop/buffer ratio (512/256 => 0.5).
    const overlapCompensation = this.hopSize / this.bufferSize
    return (peakCount / speechDuration) * overlapCompensation
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

    let sum = 0
    let count = 0
    for (const value of values) {
      if (!Number.isFinite(value)) continue
      sum += value
      count++
    }

    return count > 0 ? sum / count : 0
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
