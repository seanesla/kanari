import type {
  AudioFeatures,
  VoiceMetrics,
  StressLevel,
  FatigueLevel,
} from "@/lib/types"
import { STRESS, FATIGUE, SCORE_LEVELS, CONFIDENCE, WEIGHTS, VALIDATION } from "./thresholds"

/**
 * Heuristic-based stress and fatigue classification
 *
 * This MVP implementation uses research-backed vocal biomarkers without requiring
 * a trained ML model. Perfect for hackathon timeline while maintaining scientific validity.
 *
 * Research basis:
 * - Stress: ↑ speech rate, ↑ RMS variance, ↑ spectral flux, ↑ fundamental frequency
 * - Fatigue: ↓ RMS energy, ↓ speech rate, ↑ pause duration, ↓ spectral centroid
 */

interface InferenceResult extends VoiceMetrics {}

/**
 * Calculate stress score from audio features
 * Range: 0-100 (higher = more stressed)
 */
function calculateStressScore(features: AudioFeatures): number {
  let score = 0
  let weight = 0

  // Speech rate (stressed people speak faster)
  if (features.speechRate > STRESS.SPEECH_RATE_HIGH) {
    score += WEIGHTS.SPEECH_RATE
    weight += WEIGHTS.SPEECH_RATE
  } else if (features.speechRate > STRESS.SPEECH_RATE_MODERATE) {
    score += WEIGHTS.MODERATE_INDICATOR
    weight += WEIGHTS.SPEECH_RATE
  } else {
    weight += WEIGHTS.SPEECH_RATE
  }

  // RMS energy (stressed: higher and more variable)
  if (features.rms > STRESS.RMS_HIGH) {
    score += WEIGHTS.RMS_ENERGY
    weight += WEIGHTS.RMS_ENERGY
  } else if (features.rms > STRESS.RMS_MODERATE) {
    score += WEIGHTS.MODERATE_SECONDARY
    weight += WEIGHTS.RMS_ENERGY
  } else {
    weight += WEIGHTS.RMS_ENERGY
  }

  // Spectral flux (stressed: more rapid spectral changes)
  if (features.spectralFlux > STRESS.SPECTRAL_FLUX_HIGH) {
    score += WEIGHTS.SPECTRAL_FLUX
    weight += WEIGHTS.SPECTRAL_FLUX
  } else if (features.spectralFlux > STRESS.SPECTRAL_FLUX_MODERATE) {
    score += WEIGHTS.MODERATE_SECONDARY
    weight += WEIGHTS.SPECTRAL_FLUX
  } else {
    weight += WEIGHTS.SPECTRAL_FLUX
  }

  // Zero crossing rate (stressed: higher ZCR due to tension)
  if (features.zcr > STRESS.ZCR_HIGH) {
    score += WEIGHTS.ZCR
    weight += WEIGHTS.ZCR
  } else if (features.zcr > STRESS.ZCR_MODERATE) {
    score += WEIGHTS.MODERATE_TERTIARY
    weight += WEIGHTS.ZCR
  } else {
    weight += WEIGHTS.ZCR
  }

  return weight > 0 ? Math.round((score / weight) * 100) : 0
}

/**
 * Calculate fatigue score from audio features
 * Range: 0-100 (higher = more fatigued)
 */
function calculateFatigueScore(features: AudioFeatures): number {
  let score = 0
  let weight = 0

  // Speech rate (fatigued people speak slower)
  if (features.speechRate < FATIGUE.SPEECH_RATE_LOW) {
    score += WEIGHTS.SPEECH_RATE
    weight += WEIGHTS.SPEECH_RATE
  } else if (features.speechRate < FATIGUE.SPEECH_RATE_MODERATE) {
    score += WEIGHTS.MODERATE_INDICATOR
    weight += WEIGHTS.SPEECH_RATE
  } else {
    weight += WEIGHTS.SPEECH_RATE
  }

  // RMS energy (fatigued: lower energy/volume)
  if (features.rms < FATIGUE.RMS_LOW) {
    score += WEIGHTS.RMS_ENERGY
    weight += WEIGHTS.RMS_ENERGY
  } else if (features.rms < FATIGUE.RMS_MODERATE) {
    score += WEIGHTS.MODERATE_SECONDARY
    weight += WEIGHTS.RMS_ENERGY
  } else {
    weight += WEIGHTS.RMS_ENERGY
  }

  // Pause ratio (fatigued: more pauses)
  if (features.pauseRatio > FATIGUE.PAUSE_RATIO_HIGH) {
    score += WEIGHTS.PAUSE_RATIO
    weight += WEIGHTS.PAUSE_RATIO
  } else if (features.pauseRatio > FATIGUE.PAUSE_RATIO_MODERATE) {
    score += WEIGHTS.MODERATE_SECONDARY
    weight += WEIGHTS.PAUSE_RATIO
  } else {
    weight += WEIGHTS.PAUSE_RATIO
  }

  // Spectral centroid (fatigued: lower, less bright voice)
  if (features.spectralCentroid < FATIGUE.SPECTRAL_CENTROID_LOW) {
    score += WEIGHTS.SPECTRAL_CENTROID
    weight += WEIGHTS.SPECTRAL_CENTROID
  } else if (features.spectralCentroid < FATIGUE.SPECTRAL_CENTROID_MODERATE) {
    score += WEIGHTS.MODERATE_TERTIARY
    weight += WEIGHTS.SPECTRAL_CENTROID
  } else {
    weight += WEIGHTS.SPECTRAL_CENTROID
  }

  return weight > 0 ? Math.round((score / weight) * 100) : 0
}

/**
 * Map numeric score to categorical level
 */
function scoreToStressLevel(score: number): StressLevel {
  if (score >= SCORE_LEVELS.HIGH) return "high"
  if (score >= SCORE_LEVELS.ELEVATED) return "elevated"
  if (score >= SCORE_LEVELS.MODERATE) return "moderate"
  return "low"
}

function scoreToFatigueLevel(score: number): FatigueLevel {
  if (score >= SCORE_LEVELS.HIGH) return "exhausted"
  if (score >= SCORE_LEVELS.ELEVATED) return "tired"
  if (score >= SCORE_LEVELS.MODERATE) return "normal"
  return "rested"
}

/**
 * Calculate confidence based on feature quality
 * Factors: pause count (more data = better), RMS (too low = poor quality)
 */
function calculateConfidence(features: AudioFeatures): number {
  let confidence = CONFIDENCE.BASE

  // More pauses = more speech samples = higher confidence
  if (features.pauseCount > CONFIDENCE.PAUSE_COUNT_HIGH) confidence += CONFIDENCE.BOOST_HIGH
  else if (features.pauseCount > CONFIDENCE.PAUSE_COUNT_MODERATE) confidence += CONFIDENCE.BOOST_MODERATE
  else if (features.pauseCount < CONFIDENCE.PAUSE_COUNT_LOW) confidence += CONFIDENCE.PENALTY_LOW_DATA

  // Very low RMS = poor audio quality
  if (features.rms < CONFIDENCE.RMS_POOR_QUALITY) confidence += CONFIDENCE.PENALTY_POOR_AUDIO
  else if (features.rms > CONFIDENCE.RMS_GOOD_QUALITY) confidence += CONFIDENCE.BOOST_MODERATE

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, confidence))
}

/**
 * Main inference function
 * Analyzes audio features and returns stress/fatigue metrics
 */
export function analyzeVoiceMetrics(features: AudioFeatures): InferenceResult {
  const stressScore = calculateStressScore(features)
  const fatigueScore = calculateFatigueScore(features)
  const confidence = calculateConfidence(features)

  return {
    stressScore,
    fatigueScore,
    stressLevel: scoreToStressLevel(stressScore),
    fatigueLevel: scoreToFatigueLevel(fatigueScore),
    confidence,
    analyzedAt: new Date().toISOString(),
  }
}

/**
 * Validate audio features before inference
 * Returns true if features are valid and sufficient for analysis
 */
export function validateFeatures(features: AudioFeatures): boolean {
  // Check for required fields
  if (
    typeof features.rms !== "number" ||
    typeof features.speechRate !== "number" ||
    typeof features.pauseRatio !== "number" ||
    typeof features.spectralCentroid !== "number" ||
    typeof features.spectralFlux !== "number" ||
    typeof features.zcr !== "number"
  ) {
    return false
  }

  // Check for reasonable ranges (basic sanity checks)
  if (
    features.rms < VALIDATION.RMS_MIN || features.rms > VALIDATION.RMS_MAX ||
    features.speechRate < VALIDATION.SPEECH_RATE_MIN || features.speechRate > VALIDATION.SPEECH_RATE_MAX ||
    features.pauseRatio < VALIDATION.PAUSE_RATIO_MIN || features.pauseRatio > VALIDATION.PAUSE_RATIO_MAX ||
    features.zcr < VALIDATION.ZCR_MIN || features.zcr > VALIDATION.ZCR_MAX
  ) {
    return false
  }

  // Ensure we have enough speech data
  if (features.pauseCount < VALIDATION.MIN_PAUSE_COUNT) {
    return false // Too little speech to analyze
  }

  return true
}

