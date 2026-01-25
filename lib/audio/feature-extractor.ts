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
  private yinDiff: Float32Array | null = null
  private yinCmndf: Float32Array | null = null

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
    const frameSummary = this.extractFrameFeatures(audioData)

    // Extract temporal features (speech rate, pauses)
    const temporalFeatures = this.extractTemporalFeatures(
      audioData,
      frameSummary.rmsValues,
      frameSummary.rmsMean
    )

    // Extract pitch features using YIN algorithm
    const pitchFeatures = this.extractPitchFeatures(audioData)

    return {
      mfcc: frameSummary.mfcc,
      spectralCentroid: frameSummary.spectralCentroid,
      spectralFlux: frameSummary.spectralFlux,
      spectralRolloff: frameSummary.spectralRolloff,
      rms: frameSummary.rmsMean,
      zcr: frameSummary.zcrMean,
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
  private calculateSpectralCentroidNormalizedWithTotal(
    spectrum: ArrayLike<number>,
    total: number
  ): number {
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
  private calculateSpectralRolloffNormalizedWithTotal(
    spectrum: ArrayLike<number>,
    total: number,
    percent: number = DEFAULT_SPECTRAL_ROLLOFF_PERCENT
  ): number {
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
  private calculateSpectralFluxNormalizedWithSums(
    currentSpectrum: ArrayLike<number>,
    currentSum: number,
    previousSpectrum: ArrayLike<number>,
    previousSum: number
  ): number {
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
   * Extract features frame-by-frame using sliding window
   */
  private extractFrameFeatures(audioData: Float32Array): {
    mfcc: number[]
    spectralCentroid: number
    spectralFlux: number
    spectralRolloff: number
    rmsMean: number
    zcrMean: number
    rmsValues: number[]
  } {
    const rmsValues: number[] = []

    // Running sums/counts (avoid holding per-frame arrays for summary-only features).
    let rmsSum = 0
    let rmsCount = 0
    let zcrSum = 0
    let zcrCount = 0

    let spectralCentroidSum = 0
    let spectralCentroidCount = 0
    let spectralFluxSum = 0
    let spectralFluxCount = 0
    let spectralRolloffSum = 0
    let spectralRolloffCount = 0

    // MFCC aggregation (mean per coefficient across frames).
    let mfccSums: number[] | null = null
    let mfccCounts: number[] | null = null
    let mfccLength = 13
    let mfccFramesSeen = 0

    // Track previous amplitude spectrum for spectralFlux.
    // Use a reusable `number[]` (not Float32Array) to preserve original numeric precision.
    let previousSpectrum: number[] | null = null
    let previousSpectrumSum = 0

    // Process audio in overlapping windows
    const numFrames =
      audioData.length >= this.bufferSize
        ? Math.floor((audioData.length - this.bufferSize) / this.hopSize) + 1
        : 0

    for (let i = 0; i < numFrames; i++) {
      const start = i * this.hopSize
      const end = start + this.bufferSize

      // Extract frame without copying (subarray is a view).
      const frame = audioData.subarray(start, end)

      // Always compute time-domain features, even if Meyda extraction fails.
      const rms = this.calculateRms(frame)
      rmsValues.push(rms)
      if (Number.isFinite(rms)) {
        rmsSum += rms
        rmsCount += 1
      }

      const zcr = this.calculateZcr(frame)
      if (Number.isFinite(zcr)) {
        zcrSum += zcr
        zcrCount += 1
      }

      try {
        const features = Meyda.extract(["mfcc", "amplitudeSpectrum"], frame)

        if (!features) continue

        const mfcc = features.mfcc as number[] | undefined
        if (mfcc) {
          // Match previous behavior: coefficient count comes from the first MFCC frame.
          if (!mfccSums) {
            mfccLength = mfcc.length || 13
            mfccSums = Array(mfccLength).fill(0)
            mfccCounts = Array(mfccLength).fill(0)
          }

          for (let coef = 0; coef < mfccLength; coef++) {
            const value = mfcc[coef] ?? 0
            if (!Number.isFinite(value)) continue
            mfccSums[coef] += value
            mfccCounts![coef] += 1
          }
          mfccFramesSeen += 1
        }

        const currentSpectrum = features.amplitudeSpectrum as ArrayLike<number> | undefined
        if (!currentSpectrum) continue

        const currentSum = this.sumSpectrum(currentSpectrum)

        const centroidNorm =
          currentSum > 0 ? this.calculateSpectralCentroidNormalizedWithTotal(currentSpectrum, currentSum) : 0
        if (Number.isFinite(centroidNorm)) {
          spectralCentroidSum += centroidNorm
          spectralCentroidCount += 1
        }

        const rolloffNorm =
          currentSum > 0 ? this.calculateSpectralRolloffNormalizedWithTotal(currentSpectrum, currentSum) : 0
        if (Number.isFinite(rolloffNorm)) {
          spectralRolloffSum += rolloffNorm
          spectralRolloffCount += 1
        }

        if (previousSpectrum) {
          const fluxNorm =
            currentSum > 0 && previousSpectrumSum > 0
              ? this.calculateSpectralFluxNormalizedWithSums(
                  currentSpectrum,
                  currentSum,
                  previousSpectrum,
                  previousSpectrumSum
                )
              : 0
          if (Number.isFinite(fluxNorm)) {
            spectralFluxSum += fluxNorm
            spectralFluxCount += 1
          }
        }

        // Store current spectrum for next iteration (copy to avoid mutation/reuse issues).
        const spectrumLength = currentSpectrum.length
        if (!previousSpectrum || previousSpectrum.length !== spectrumLength) {
          previousSpectrum = new Array(spectrumLength)
        }

        for (let s = 0; s < spectrumLength; s++) {
          previousSpectrum[s] = currentSpectrum[s] ?? 0
        }
        previousSpectrumSum = currentSum
      } catch (error) {
        // Skip frame on extraction error
        console.warn("Feature extraction failed for frame, skipping:", error)
      }
    }

    const mfcc =
      mfccFramesSeen > 0 && mfccSums && mfccCounts
        ? mfccSums.map((sum, i) => (mfccCounts[i] > 0 ? sum / mfccCounts[i] : 0))
        : Array(13).fill(0)

    return {
      mfcc,
      spectralCentroid: spectralCentroidCount > 0 ? spectralCentroidSum / spectralCentroidCount : 0,
      spectralFlux: spectralFluxCount > 0 ? spectralFluxSum / spectralFluxCount : 0,
      spectralRolloff: spectralRolloffCount > 0 ? spectralRolloffSum / spectralRolloffCount : 0,
      rmsMean: rmsCount > 0 ? rmsSum / rmsCount : 0,
      zcrMean: zcrCount > 0 ? zcrSum / zcrCount : 0,
      rmsValues,
    }
  }

  /**
   * Extract temporal features: speech rate, pause ratio, pause count, average pause duration
   */
  private extractTemporalFeatures(audioData: Float32Array, rmsValues: number[], rmsMean: number) {
    // Energy-based voice activity detection
    const rmsThreshold = rmsMean * 0.3 // 30% of mean RMS as threshold
    const frameDuration = this.hopSize / this.sampleRate // Duration of each frame in seconds

    let pauseCount = 0
    let currentPauseDuration = 0
    let pauseDurationsSum = 0
    let pauseDurationsCount = 0
    let silenceDuration = 0
    let speechFrameCount = 0
    let speechRmsSum = 0

    let prevWasSpeech = false
    for (let i = 0; i < rmsValues.length; i++) {
      const frameRms = rmsValues[i] ?? 0
      const isSpeech = frameRms > rmsThreshold

      if (isSpeech) {
        speechFrameCount += 1
        speechRmsSum += frameRms

        // End of pause (includes initial leading silence).
        if (i > 0 && !prevWasSpeech && currentPauseDuration > 0) {
          pauseDurationsSum += currentPauseDuration
          pauseDurationsCount += 1
          currentPauseDuration = 0
        }
      } else {
        // Silence frame
        silenceDuration += frameDuration
        currentPauseDuration += frameDuration

        // Start of new pause
        if (i > 0 && prevWasSpeech) {
          pauseCount += 1
        }
      }

      prevWasSpeech = isSpeech
    }

    // Add final pause if recording ended during silence
    if (currentPauseDuration > 0) {
      pauseDurationsSum += currentPauseDuration
      pauseDurationsCount += 1
    }

    // Calculate pause ratio
    const totalDuration = (audioData.length / this.sampleRate)
    const pauseRatio = totalDuration > 0 ? silenceDuration / totalDuration : 0

    // Calculate average pause duration (in milliseconds)
    const avgPauseDuration =
      pauseDurationsCount > 0
        ? ((pauseDurationsSum / pauseDurationsCount) * 1000)
        : 0

    // Estimate speech rate (syllables per second)
    // Using energy peaks as proxy for syllables
    const speechRate = this.estimateSpeechRate(rmsValues, rmsThreshold, frameDuration, {
      speechFrameCount,
      speechRmsSum,
    })

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
    rmsThreshold: number,
    frameDuration: number,
    precomputed?: { speechFrameCount: number; speechRmsSum: number }
  ): number {
    const speechFrameCount =
      precomputed?.speechFrameCount ??
      rmsValues.reduce((count, v) => count + (v > rmsThreshold ? 1 : 0), 0)
    if (speechFrameCount === 0) return 0

    const speechRmsSum =
      precomputed?.speechRmsSum ??
      rmsValues.reduce((sum, v) => (v > rmsThreshold ? sum + v : sum), 0)

    // Find peaks in RMS (potential syllables)
    const peakThreshold = (speechRmsSum / speechFrameCount) * 0.8
    let peakCount = 0

    // Iterate only speech frames, but without allocating a compacted `speechRms` array.
    let prev: number | null = null
    let curr: number | null = null
    for (let i = 0; i < rmsValues.length; i++) {
      const v = rmsValues[i] ?? 0
      if (v <= rmsThreshold) continue

      if (prev === null) {
        prev = v
        continue
      }
      if (curr === null) {
        curr = v
        continue
      }

      const next = v
      if (curr > peakThreshold && curr > prev && curr > next) {
        peakCount += 1
      }
      prev = curr
      curr = next
    }

    // Calculate speech duration (only counting speech frames)
    const speechDuration = speechFrameCount * frameDuration

    // Speech rate = peaks (syllables) per second
    if (speechDuration <= 0) return 0

    // Overlapping windows can over-count peaks vs duration.
    // Compensate by scaling with hop/buffer ratio (512/256 => 0.5).
    const overlapCompensation = this.hopSize / this.bufferSize
    return (peakCount / speechDuration) * overlapCompensation
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
    let sum = 0
    let count = 0
    for (const v of values) {
      if (!Number.isFinite(v)) continue
      const d = v - avg
      sum += d * d
      count += 1
    }
    return count > 0 ? Math.sqrt(sum / count) : 0
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
    if (!this.yinDiff || this.yinDiff.length < maxLag + 1) {
      this.yinDiff = new Float32Array(maxLag + 1)
      this.yinCmndf = new Float32Array(maxLag + 1)
    }
    const diff = this.yinDiff
    for (let tau = 1; tau <= maxLag; tau++) {
      let sum = 0
      for (let j = 0; j < halfLength; j++) {
        const delta = frame[j] - frame[j + tau]
        sum += delta * delta
      }
      diff[tau] = sum
    }

    // Step 2: Compute cumulative mean normalized difference d'(τ)
    const cmndf = this.yinCmndf!
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
    const numFrames =
      audioData.length >= this.bufferSize
        ? Math.floor((audioData.length - this.bufferSize) / this.hopSize) + 1
        : 0
    let minPitch = Number.POSITIVE_INFINITY
    let maxPitch = Number.NEGATIVE_INFINITY

    for (let i = 0; i < numFrames; i++) {
      const start = i * this.hopSize
      const end = start + this.bufferSize
      const frame = audioData.subarray(start, end)

      const pitch = this.extractPitch(frame)
      if (pitch !== null) {
        pitchValues.push(pitch)
        if (pitch < minPitch) minPitch = pitch
        if (pitch > maxPitch) maxPitch = pitch
      }
    }

    if (pitchValues.length === 0) {
      return { pitchMean: 0, pitchStdDev: 0, pitchRange: 0 }
    }

    const pitchMean = this.mean(pitchValues)
    const pitchStdDev = this.stdDev(pitchValues)
    const pitchRange = (Number.isFinite(minPitch) && Number.isFinite(maxPitch)) ? maxPitch - minPitch : 0

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
