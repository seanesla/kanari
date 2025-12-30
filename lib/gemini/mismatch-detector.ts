/**
 * Mismatch Detector
 *
 * Compares semantic content (what users say) with acoustic biomarkers
 * (how they say it) to detect mismatches that might indicate hidden stress,
 * fatigue, or emotional states.
 *
 * This is the key differentiator for Kanari's conversational check-in:
 * User says "I'm fine" + voice shows fatigue = mismatch detected
 * → Gemini gently probes: "Your voice sounds flat today—rough night?"
 */

import type { MismatchResult, AudioFeatures, VoiceMetrics, VoicePatterns } from "@/lib/types"

// Positive sentiment keywords and phrases
const POSITIVE_KEYWORDS = [
  "fine",
  "good",
  "great",
  "okay",
  "alright",
  "well",
  "better",
  "excellent",
  "wonderful",
  "amazing",
  "fantastic",
  "happy",
  "relaxed",
  "calm",
  "peaceful",
  "energized",
  "excited",
  "rested",
]

// Negative sentiment keywords and phrases
const NEGATIVE_KEYWORDS = [
  "tired",
  "exhausted",
  "stressed",
  "overwhelmed",
  "anxious",
  "worried",
  "sad",
  "depressed",
  "frustrated",
  "angry",
  "upset",
  "struggling",
  "difficult",
  "hard",
  "rough",
  "terrible",
  "awful",
  "bad",
  "not good",
  "not great",
  "not well",
]

// Dismissive phrases that often mask true feelings
const DISMISSIVE_PHRASES = [
  "i'm fine",
  "i'm okay",
  "it's fine",
  "it's okay",
  "no big deal",
  "whatever",
  "doesn't matter",
  "i guess",
  "not really",
  "kind of",
  "sort of",
]

/**
 * Analyze semantic sentiment from transcript text
 */
function analyzeSemanticSignal(text: string): "positive" | "neutral" | "negative" {
  const lowerText = text.toLowerCase()

  // Count positive and negative indicators
  let positiveScore = 0
  let negativeScore = 0
  let dismissiveScore = 0

  for (const keyword of POSITIVE_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      positiveScore++
    }
  }

  for (const keyword of NEGATIVE_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      negativeScore++
    }
  }

  for (const phrase of DISMISSIVE_PHRASES) {
    if (lowerText.includes(phrase)) {
      dismissiveScore++
    }
  }

  // Dismissive phrases often indicate masked negative feelings
  // Treat them as neutral rather than positive
  if (dismissiveScore > 0) {
    positiveScore = Math.max(0, positiveScore - dismissiveScore)
  }

  // Determine overall sentiment
  if (negativeScore > positiveScore) {
    return "negative"
  } else if (positiveScore > negativeScore && positiveScore > 0) {
    return "positive"
  }

  return "neutral"
}

/**
 * Analyze acoustic signal from voice features
 */
function analyzeAcousticSignal(
  features: AudioFeatures,
  metrics: VoiceMetrics
): "stressed" | "fatigued" | "normal" | "energetic" {
  // Use the pre-computed metrics for primary classification
  const { stressScore, fatigueScore, stressLevel, fatigueLevel } = metrics

  // High stress indicators
  if (stressLevel === "high" || stressLevel === "elevated" || stressScore > 65) {
    return "stressed"
  }

  // High fatigue indicators
  if (fatigueLevel === "exhausted" || fatigueLevel === "tired" || fatigueScore > 65) {
    return "fatigued"
  }

  // Check for energetic patterns using raw features
  // High RMS + fast speech rate + bright tone = energetic
  if (
    features.rms > 0.15 &&
    features.speechRate > 4.5 &&
    features.spectralCentroid > 2000
  ) {
    return "energetic"
  }

  return "normal"
}

/**
 * Determine if there's a significant mismatch
 */
function isMismatch(
  semanticSignal: "positive" | "neutral" | "negative",
  acousticSignal: "stressed" | "fatigued" | "normal" | "energetic"
): boolean {
  // Key mismatches we care about:

  // 1. Says positive things but sounds stressed/fatigued
  if (semanticSignal === "positive" && (acousticSignal === "stressed" || acousticSignal === "fatigued")) {
    return true
  }

  // 2. Says neutral things but sounds very stressed/fatigued (might be masking)
  if (semanticSignal === "neutral" && (acousticSignal === "stressed" || acousticSignal === "fatigued")) {
    return true
  }

  // 3. Says negative things but sounds energetic (could be performance/deflection)
  // This is less common but worth noting
  if (semanticSignal === "negative" && acousticSignal === "energetic") {
    return true
  }

  return false
}

/**
 * Generate suggestion for Gemini based on mismatch type
 */
function generateSuggestion(
  semanticSignal: "positive" | "neutral" | "negative",
  acousticSignal: "stressed" | "fatigued" | "normal" | "energetic"
): string | null {
  if (!isMismatch(semanticSignal, acousticSignal)) {
    return null
  }

  // Says positive/neutral but sounds fatigued
  if (acousticSignal === "fatigued") {
    return "User said they're doing okay but their voice shows signs of fatigue (low energy, slower speech, flatter tone). Consider gently asking about their sleep or energy levels."
  }

  // Says positive/neutral but sounds stressed
  if (acousticSignal === "stressed") {
    return "User said things are fine but their voice shows stress patterns (faster speech, tension). Consider gently asking what's on their mind or if anything feels overwhelming."
  }

  // Says negative but sounds energetic
  if (semanticSignal === "negative" && acousticSignal === "energetic") {
    return "User expressed concerns but their voice sounds energetic. They might be venting productively or processing something. Keep listening supportively."
  }

  return null
}

/**
 * Calculate confidence based on feature strength
 */
function calculateConfidence(
  features: AudioFeatures,
  metrics: VoiceMetrics
): number {
  // Base confidence on metrics confidence if available
  let confidence = metrics.confidence ?? 0.7

  // Adjust based on speech duration (more data = higher confidence)
  // This is approximated from pause ratio and speech rate
  const hasSufficientData = features.speechRate > 0 && features.pauseRatio < 0.8
  if (!hasSufficientData) {
    confidence *= 0.6
  }

  // Adjust based on feature extremity (more extreme = higher confidence)
  const stressExtremity = Math.abs(metrics.stressScore - 50) / 50
  const fatigueExtremity = Math.abs(metrics.fatigueScore - 50) / 50
  const extremityBoost = (stressExtremity + fatigueExtremity) / 2 * 0.2
  confidence = Math.min(1, confidence + extremityBoost)

  return confidence
}

/**
 * Main mismatch detection function
 *
 * @param transcript - What the user said (transcribed text)
 * @param features - Raw acoustic features from Meyda
 * @param metrics - Computed stress/fatigue metrics
 * @returns MismatchResult with detection info and suggestions
 */
export function detectMismatch(
  transcript: string,
  features: AudioFeatures,
  metrics: VoiceMetrics
): MismatchResult {
  // Analyze semantic content
  const semanticSignal = analyzeSemanticSignal(transcript)

  // Analyze acoustic patterns
  const acousticSignal = analyzeAcousticSignal(features, metrics)

  // Check for mismatch
  const detected = isMismatch(semanticSignal, acousticSignal)

  // Generate suggestion for Gemini
  const suggestionForGemini = generateSuggestion(semanticSignal, acousticSignal)

  // Calculate confidence
  const confidence = calculateConfidence(features, metrics)

  return {
    detected,
    semanticSignal,
    acousticSignal,
    confidence,
    suggestionForGemini,
  }
}

/**
 * Convert AudioFeatures to VoicePatterns for display/context
 */
export function featuresToPatterns(features: AudioFeatures): VoicePatterns {
  // Speech rate classification
  let speechRate: VoicePatterns["speechRate"] = "normal"
  if (features.speechRate > 5) {
    speechRate = "fast"
  } else if (features.speechRate < 3) {
    speechRate = "slow"
  }

  // Energy level from RMS
  let energyLevel: VoicePatterns["energyLevel"] = "moderate"
  if (features.rms > 0.2) {
    energyLevel = "high"
  } else if (features.rms < 0.08) {
    energyLevel = "low"
  }

  // Pause frequency
  let pauseFrequency: VoicePatterns["pauseFrequency"] = "normal"
  if (features.pauseRatio > 0.4 || features.pauseCount > 10) {
    pauseFrequency = "frequent"
  } else if (features.pauseRatio < 0.15 && features.pauseCount < 3) {
    pauseFrequency = "rare"
  }

  // Voice tone from spectral centroid
  let voiceTone: VoicePatterns["voiceTone"] = "neutral"
  if (features.spectralCentroid > 2500) {
    voiceTone = "bright"
  } else if (features.spectralCentroid < 1500) {
    voiceTone = "dull"
  }

  return {
    speechRate,
    energyLevel,
    pauseFrequency,
    voiceTone,
  }
}

/**
 * Quick check if mismatch detection should run
 * Returns false if there's not enough data
 */
export function shouldRunMismatchDetection(
  transcript: string,
  features: AudioFeatures | undefined
): boolean {
  // Need both transcript and features
  if (!transcript || !features) {
    return false
  }

  // Need minimum text length (at least a few words)
  const wordCount = transcript.trim().split(/\s+/).length
  if (wordCount < 3) {
    return false
  }

  // Need valid features
  if (features.speechRate === 0 && features.rms === 0) {
    return false
  }

  return true
}
