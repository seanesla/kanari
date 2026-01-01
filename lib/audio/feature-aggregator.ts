import type { AudioFeatures } from "@/lib/types"

export interface FeatureAccumulator {
  totalWeight: number
  sums: AudioFeatures
}

function safeWeight(weight: number): number {
  return Number.isFinite(weight) && weight > 0 ? weight : 1
}

export function createFeatureAccumulator(features: AudioFeatures, weight: number): FeatureAccumulator {
  const w = safeWeight(weight)

  return {
    totalWeight: w,
    sums: {
      mfcc: features.mfcc.map((value) => value * w),
      spectralCentroid: features.spectralCentroid * w,
      spectralFlux: features.spectralFlux * w,
      spectralRolloff: features.spectralRolloff * w,
      rms: features.rms * w,
      zcr: features.zcr * w,
      speechRate: features.speechRate * w,
      pauseRatio: features.pauseRatio * w,
      pauseCount: features.pauseCount * w,
      avgPauseDuration: features.avgPauseDuration * w,
      pitchMean: features.pitchMean * w,
      pitchStdDev: features.pitchStdDev * w,
      pitchRange: features.pitchRange * w,
    },
  }
}

export function updateFeatureAccumulator(
  accumulator: FeatureAccumulator,
  features: AudioFeatures,
  weight: number
): FeatureAccumulator {
  const w = safeWeight(weight)
  accumulator.totalWeight += w

  if (features.mfcc.length > accumulator.sums.mfcc.length) {
    accumulator.sums.mfcc = [
      ...accumulator.sums.mfcc,
      ...new Array(features.mfcc.length - accumulator.sums.mfcc.length).fill(0),
    ]
  }

  for (let i = 0; i < features.mfcc.length; i++) {
    accumulator.sums.mfcc[i] += features.mfcc[i] * w
  }

  accumulator.sums.spectralCentroid += features.spectralCentroid * w
  accumulator.sums.spectralFlux += features.spectralFlux * w
  accumulator.sums.spectralRolloff += features.spectralRolloff * w
  accumulator.sums.rms += features.rms * w
  accumulator.sums.zcr += features.zcr * w
  accumulator.sums.speechRate += features.speechRate * w
  accumulator.sums.pauseRatio += features.pauseRatio * w
  accumulator.sums.pauseCount += features.pauseCount * w
  accumulator.sums.avgPauseDuration += features.avgPauseDuration * w
  accumulator.sums.pitchMean += features.pitchMean * w
  accumulator.sums.pitchStdDev += features.pitchStdDev * w
  accumulator.sums.pitchRange += features.pitchRange * w

  return accumulator
}

export function getAverageFeatures(accumulator: FeatureAccumulator): AudioFeatures {
  const weight = safeWeight(accumulator.totalWeight)

  return {
    mfcc: accumulator.sums.mfcc.map((value) => value / weight),
    spectralCentroid: accumulator.sums.spectralCentroid / weight,
    spectralFlux: accumulator.sums.spectralFlux / weight,
    spectralRolloff: accumulator.sums.spectralRolloff / weight,
    rms: accumulator.sums.rms / weight,
    zcr: accumulator.sums.zcr / weight,
    speechRate: accumulator.sums.speechRate / weight,
    pauseRatio: accumulator.sums.pauseRatio / weight,
    pauseCount: accumulator.sums.pauseCount / weight,
    avgPauseDuration: accumulator.sums.avgPauseDuration / weight,
    pitchMean: accumulator.sums.pitchMean / weight,
    pitchStdDev: accumulator.sums.pitchStdDev / weight,
    pitchRange: accumulator.sums.pitchRange / weight,
  }
}
