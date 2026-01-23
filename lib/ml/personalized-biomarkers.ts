import type {
  AudioFeatures,
  BiomarkerCalibration,
  BiomarkerExplanations,
  FatigueLevel,
  StressLevel,
  VoiceDataQuality,
} from "@/lib/types"
import { FATIGUE, SCORE_LEVELS, STRESS } from "./thresholds"

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function scoreToStressLevel(score: number): StressLevel {
  if (score >= SCORE_LEVELS.HIGH) return "high"
  if (score >= SCORE_LEVELS.ELEVATED) return "elevated"
  if (score >= SCORE_LEVELS.MODERATE) return "moderate"
  return "low"
}

export function scoreToFatigueLevel(score: number): FatigueLevel {
  if (score >= SCORE_LEVELS.HIGH) return "exhausted"
  if (score >= SCORE_LEVELS.ELEVATED) return "tired"
  if (score >= SCORE_LEVELS.MODERATE) return "normal"
  return "rested"
}

function intensityToScore(intensity: number): number {
  // 0 => ~20 (low), 1 => ~55 (elevated), 2 => ~90 (high)
  const raw = 20 + Math.max(0, intensity) * 35
  return clampScore(raw)
}

type Contribution = { label: string; strength: number }

function pickTopDrivers(contribs: Contribution[], limit: number = 3): string[] {
  return contribs
    .filter((c) => c.strength > 0.25)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, limit)
    .map((c) => c.label)
}

function computeBaselineRelativeStress(options: {
  features: AudioFeatures
  baseline: AudioFeatures
}): { score: number; drivers: string[] } {
  const { features, baseline } = options

  // "Meaningful change" scales. These are intentionally simple constants.
  const SPEECH_RATE_DELTA = 0.9
  const RMS_DELTA = 0.06
  const FLUX_DELTA = 0.05
  const ZCR_DELTA = 0.03

  const rate = Math.max(0, (features.speechRate - baseline.speechRate) / SPEECH_RATE_DELTA)
  const rms = Math.max(0, (features.rms - baseline.rms) / RMS_DELTA)
  const flux = Math.max(0, (features.spectralFlux - baseline.spectralFlux) / FLUX_DELTA)
  const zcr = Math.max(0, (features.zcr - baseline.zcr) / ZCR_DELTA)

  const weighted =
    rate * 0.35 +
    rms * 0.25 +
    flux * 0.25 +
    zcr * 0.15

  const drivers = pickTopDrivers([
    { label: "Faster speech than your baseline", strength: rate },
    { label: "Higher vocal energy than usual", strength: rms },
    { label: "More vocal agitation than usual", strength: flux },
    { label: "More vocal tension than usual", strength: zcr },
  ])

  return { score: intensityToScore(weighted), drivers }
}

function computeBaselineRelativeFatigue(options: {
  features: AudioFeatures
  baseline: AudioFeatures
}): { score: number; drivers: string[] } {
  const { features, baseline } = options

  const SPEECH_RATE_DELTA = 0.8
  const RMS_DELTA = 0.05
  const PAUSE_RATIO_DELTA = 0.12
  const CENTROID_DELTA = 0.15

  const rate = Math.max(0, (baseline.speechRate - features.speechRate) / SPEECH_RATE_DELTA)
  const rms = Math.max(0, (baseline.rms - features.rms) / RMS_DELTA)
  const pauses = Math.max(0, (features.pauseRatio - baseline.pauseRatio) / PAUSE_RATIO_DELTA)
  const centroid = Math.max(0, (baseline.spectralCentroid - features.spectralCentroid) / CENTROID_DELTA)

  const weighted =
    rate * 0.3 +
    rms * 0.3 +
    pauses * 0.25 +
    centroid * 0.15

  const drivers = pickTopDrivers([
    { label: "Slower speech than your baseline", strength: rate },
    { label: "Lower vocal energy than usual", strength: rms },
    { label: "More pauses than your baseline", strength: pauses },
    { label: "Duller tone than usual", strength: centroid },
  ])

  return { score: intensityToScore(weighted), drivers }
}

function computeThresholdDrivers(options: {
  features: AudioFeatures
  stressScore: number
  fatigueScore: number
}): BiomarkerExplanations {
  const { features, stressScore, fatigueScore } = options

  const stress: Contribution[] = []
  const fatigue: Contribution[] = []

  // Stress indicators
  if (features.speechRate > STRESS.SPEECH_RATE_HIGH) {
    stress.push({ label: "Very fast speech", strength: 2 })
  } else if (features.speechRate > STRESS.SPEECH_RATE_MODERATE) {
    stress.push({ label: "Faster speech", strength: 1 })
  }

  if (features.rms > STRESS.RMS_HIGH) {
    stress.push({ label: "High vocal energy", strength: 1.4 })
  } else if (features.rms > STRESS.RMS_MODERATE) {
    stress.push({ label: "Elevated vocal energy", strength: 0.9 })
  }

  if (features.spectralFlux > STRESS.SPECTRAL_FLUX_HIGH) {
    stress.push({ label: "Rapid vocal changes", strength: 1.2 })
  } else if (features.spectralFlux > STRESS.SPECTRAL_FLUX_MODERATE) {
    stress.push({ label: "More vocal variability", strength: 0.8 })
  }

  if (features.zcr > STRESS.ZCR_HIGH) {
    stress.push({ label: "More vocal tension", strength: 1.1 })
  } else if (features.zcr > STRESS.ZCR_MODERATE) {
    stress.push({ label: "Slight vocal tension", strength: 0.7 })
  }

  // Fatigue indicators
  if (features.speechRate < FATIGUE.SPEECH_RATE_LOW) {
    fatigue.push({ label: "Very slow speech", strength: 2 })
  } else if (features.speechRate < FATIGUE.SPEECH_RATE_MODERATE) {
    fatigue.push({ label: "Slower speech", strength: 1 })
  }

  if (features.rms < FATIGUE.RMS_LOW) {
    fatigue.push({ label: "Very low vocal energy", strength: 1.5 })
  } else if (features.rms < FATIGUE.RMS_MODERATE) {
    fatigue.push({ label: "Lower vocal energy", strength: 1 })
  }

  if (features.pauseRatio > FATIGUE.PAUSE_RATIO_HIGH) {
    fatigue.push({ label: "Frequent pauses", strength: 1.2 })
  } else if (features.pauseRatio > FATIGUE.PAUSE_RATIO_MODERATE) {
    fatigue.push({ label: "More pauses", strength: 0.8 })
  }

  if (features.spectralCentroid < FATIGUE.SPECTRAL_CENTROID_LOW) {
    fatigue.push({ label: "Duller vocal tone", strength: 1.1 })
  } else if (features.spectralCentroid < FATIGUE.SPECTRAL_CENTROID_MODERATE) {
    fatigue.push({ label: "Less bright vocal tone", strength: 0.7 })
  }

  return {
    mode: "threshold",
    stress: stressScore >= SCORE_LEVELS.MODERATE ? pickTopDrivers(stress) : [],
    fatigue: fatigueScore >= SCORE_LEVELS.MODERATE ? pickTopDrivers(fatigue) : [],
  }
}

export function computeVoiceDataQuality(options: {
  speechSeconds: number
  totalSeconds: number
  rms?: number
  maxAbs?: number
}): VoiceDataQuality {
  const speechSeconds = Number.isFinite(options.speechSeconds) ? Math.max(0, options.speechSeconds) : 0
  const totalSeconds = Number.isFinite(options.totalSeconds) ? Math.max(0, options.totalSeconds) : 0
  const speechRatio = totalSeconds > 0 ? Math.max(0, Math.min(1, speechSeconds / totalSeconds)) : 0

  const reasons: string[] = []

  // Speech amount confidence: 1-exp(-t/k) makes early seconds matter most.
  const speechAmount = 1 - Math.exp(-speechSeconds / 4)
  const ratioScore = clamp01((speechRatio - 0.2) / 0.6)

  let quality = clamp01(speechAmount * 0.75 + ratioScore * 0.25)

  if (speechSeconds < 2) {
    quality *= 0.55
    reasons.push("Very little speech")
  } else if (speechSeconds < 5) {
    quality *= 0.8
    reasons.push("Short speech sample")
  }

  if (totalSeconds > 0 && speechRatio < 0.25) {
    quality *= 0.8
    reasons.push("Mostly silence")
  }

  const rms = options.rms
  if (typeof rms === "number" && Number.isFinite(rms) && rms < 0.05) {
    quality *= 0.85
    reasons.push("Very quiet audio")
  }

  const maxAbs = options.maxAbs
  if (typeof maxAbs === "number" && Number.isFinite(maxAbs) && maxAbs > 0.98) {
    quality *= 0.9
    reasons.push("Audio near clipping")
  }

  return {
    speechSeconds,
    totalSeconds,
    speechRatio,
    quality: clamp01(quality),
    reasons,
  }
}

export function applyBiomarkerCalibration(options: {
  rawScore: number
  dimension: "stress" | "fatigue"
  calibration?: BiomarkerCalibration | null
}): number {
  const raw = clampScore(options.rawScore)
  const calibration = options.calibration
  if (!calibration) return raw

  const bias = options.dimension === "stress" ? calibration.stressBias : calibration.fatigueBias
  const scale = options.dimension === "stress" ? calibration.stressScale : calibration.fatigueScale

  const safeScale = Math.max(0.75, Math.min(1.25, Number.isFinite(scale) ? scale : 1))
  const safeBias = Math.max(-25, Math.min(25, Number.isFinite(bias) ? bias : 0))

  const centered = raw - 50
  const calibrated = 50 + centered * safeScale + safeBias
  return clampScore(calibrated)
}

export function updateCalibrationFromSelfReport(options: {
  dimension: "stress" | "fatigue"
  acousticScore: number
  selfReportScore: number
  calibration?: BiomarkerCalibration | null
  now?: string
}): BiomarkerCalibration {
  const now = options.now ?? new Date().toISOString()

  const prev: BiomarkerCalibration = options.calibration ?? {
    stressBias: 0,
    fatigueBias: 0,
    stressScale: 1,
    fatigueScale: 1,
    sampleCount: 0,
    updatedAt: now,
  }

  const dimension = options.dimension
  const raw = clampScore(options.acousticScore)
  const target = clampScore(options.selfReportScore)

  const biasKey = dimension === "stress" ? "stressBias" : "fatigueBias"
  const scaleKey = dimension === "stress" ? "stressScale" : "fatigueScale"

  const prevBias = prev[biasKey]
  const prevScale = prev[scaleKey]

  const predicted = clampScore(50 + (raw - 50) * prevScale + prevBias)
  const error = target - predicted

  // Small, stable learning rates. Clamp to avoid overfitting.
  const BIAS_LR = 0.08
  const SCALE_LR = 0.04
  const centered = (raw - 50) / 50

  const nextBias = Math.max(-25, Math.min(25, prevBias + BIAS_LR * error))
  const nextScale = Math.max(0.75, Math.min(1.25, prevScale + SCALE_LR * error * centered))

  return {
    ...prev,
    [biasKey]: nextBias,
    [scaleKey]: nextScale,
    sampleCount: prev.sampleCount ?? 0,
    updatedAt: now,
  }
}

export function updateCalibrationFromSelfReportSubmission(options: {
  acousticStressScore: number
  acousticFatigueScore: number
  selfReportStressScore: number
  selfReportFatigueScore: number
  calibration?: BiomarkerCalibration | null
  now?: string
}): BiomarkerCalibration {
  const now = options.now ?? new Date().toISOString()

  const base = options.calibration ?? {
    stressBias: 0,
    fatigueBias: 0,
    stressScale: 1,
    fatigueScale: 1,
    sampleCount: 0,
    updatedAt: now,
  }

  const nextStress = updateCalibrationFromSelfReport({
    dimension: "stress",
    acousticScore: options.acousticStressScore,
    selfReportScore: options.selfReportStressScore,
    calibration: base,
    now,
  })

  const next = updateCalibrationFromSelfReport({
    dimension: "fatigue",
    acousticScore: options.acousticFatigueScore,
    selfReportScore: options.selfReportFatigueScore,
    calibration: nextStress,
    now,
  })

  return {
    ...next,
    sampleCount: (base.sampleCount ?? 0) + 1,
    updatedAt: now,
  }
}

export function computePersonalizedAcousticScores(options: {
  features: AudioFeatures
  baseline?: AudioFeatures | null
  fallbackScores: { stressScore: number; fatigueScore: number }
}): {
  stressScore: number
  fatigueScore: number
  stressLevel: StressLevel
  fatigueLevel: FatigueLevel
  explanations: BiomarkerExplanations
} {
  const { features, baseline, fallbackScores } = options

  if (baseline) {
    const relStress = computeBaselineRelativeStress({ features, baseline })
    const relFatigue = computeBaselineRelativeFatigue({ features, baseline })

    const stressScore = clampScore(fallbackScores.stressScore * 0.35 + relStress.score * 0.65)
    const fatigueScore = clampScore(fallbackScores.fatigueScore * 0.3 + relFatigue.score * 0.7)

    return {
      stressScore,
      fatigueScore,
      stressLevel: scoreToStressLevel(stressScore),
      fatigueLevel: scoreToFatigueLevel(fatigueScore),
      explanations: {
        mode: "baseline",
        stress: relStress.drivers,
        fatigue: relFatigue.drivers,
      },
    }
  }

  const stressScore = clampScore(fallbackScores.stressScore)
  const fatigueScore = clampScore(fallbackScores.fatigueScore)

  return {
    stressScore,
    fatigueScore,
    stressLevel: scoreToStressLevel(stressScore),
    fatigueLevel: scoreToFatigueLevel(fatigueScore),
    explanations: computeThresholdDrivers({ features, stressScore, fatigueScore }),
  }
}

export function computeCombinedConfidence(options: {
  baseConfidence: number
  quality: VoiceDataQuality
}): number {
  return clamp01(clamp01(options.baseConfidence) * clamp01(options.quality.quality))
}
