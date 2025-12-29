import type { AudioFeatures, VoiceMetrics, StressLevel, FatigueLevel } from "@/lib/types"

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
  // Normal: 3-5 syllables/sec, stressed: >5.5
  if (features.speechRate > 5.5) {
    score += 30
    weight += 30
  } else if (features.speechRate > 4.5) {
    score += 15
    weight += 30
  } else {
    weight += 30
  }

  // RMS energy (stressed: higher and more variable)
  // We use RMS as proxy for loudness/intensity
  if (features.rms > 0.3) {
    score += 25
    weight += 25
  } else if (features.rms > 0.2) {
    score += 12
    weight += 25
  } else {
    weight += 25
  }

  // Spectral flux (stressed: more rapid spectral changes)
  // Higher values indicate more dynamic/agitated speech
  if (features.spectralFlux > 0.15) {
    score += 25
    weight += 25
  } else if (features.spectralFlux > 0.1) {
    score += 12
    weight += 25
  } else {
    weight += 25
  }

  // Zero crossing rate (stressed: higher ZCR due to tension)
  if (features.zcr > 0.08) {
    score += 20
    weight += 20
  } else if (features.zcr > 0.05) {
    score += 10
    weight += 20
  } else {
    weight += 20
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
  // Normal: 3-5 syllables/sec, fatigued: <3
  if (features.speechRate < 3) {
    score += 30
    weight += 30
  } else if (features.speechRate < 3.5) {
    score += 15
    weight += 30
  } else {
    weight += 30
  }

  // RMS energy (fatigued: lower energy/volume)
  if (features.rms < 0.1) {
    score += 25
    weight += 25
  } else if (features.rms < 0.15) {
    score += 12
    weight += 25
  } else {
    weight += 25
  }

  // Pause ratio (fatigued: more pauses)
  if (features.pauseRatio > 0.4) {
    score += 25
    weight += 25
  } else if (features.pauseRatio > 0.3) {
    score += 12
    weight += 25
  } else {
    weight += 25
  }

  // Spectral centroid (fatigued: lower, less bright voice)
  // Normalized spectral centroid (0-1 range assumed)
  if (features.spectralCentroid < 0.3) {
    score += 20
    weight += 20
  } else if (features.spectralCentroid < 0.45) {
    score += 10
    weight += 20
  } else {
    weight += 20
  }

  return weight > 0 ? Math.round((score / weight) * 100) : 0
}

/**
 * Map numeric score to categorical level
 */
function scoreToStressLevel(score: number): StressLevel {
  if (score >= 70) return "high"
  if (score >= 50) return "elevated"
  if (score >= 30) return "moderate"
  return "low"
}

function scoreToFatigueLevel(score: number): FatigueLevel {
  if (score >= 70) return "exhausted"
  if (score >= 50) return "tired"
  if (score >= 30) return "normal"
  return "rested"
}

/**
 * Calculate confidence based on feature quality
 * Factors: pause count (more data = better), RMS (too low = poor quality)
 */
function calculateConfidence(features: AudioFeatures): number {
  let confidence = 0.7 // Base confidence

  // More pauses = more speech samples = higher confidence
  if (features.pauseCount > 10) confidence += 0.15
  else if (features.pauseCount > 5) confidence += 0.1
  else if (features.pauseCount < 3) confidence -= 0.1

  // Very low RMS = poor audio quality
  if (features.rms < 0.05) confidence -= 0.2
  else if (features.rms > 0.15) confidence += 0.1

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
    features.rms < 0 || features.rms > 1 ||
    features.speechRate < 0 || features.speechRate > 20 ||
    features.pauseRatio < 0 || features.pauseRatio > 1 ||
    features.zcr < 0 || features.zcr > 1
  ) {
    return false
  }

  // Ensure we have enough speech data
  if (features.pauseCount < 2) {
    return false // Too little speech to analyze
  }

  return true
}
