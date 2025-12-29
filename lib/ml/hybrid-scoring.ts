import type {
  GeminiSemanticAnalysis,
  StressLevel,
  FatigueLevel,
  ObservationType,
  ObservationRelevance,
  EmotionType,
} from "@/lib/types"

/**
 * Hybrid Scoring System
 *
 * Combines local acoustic analysis (70% weight) with Gemini semantic analysis (30% weight)
 * to produce more accurate stress and fatigue scores.
 *
 * Acoustic features (speech rate, energy, spectral analysis) are objective measurements,
 * but miss semantic content. Gemini adds context awareness (frustration, confusion, etc.)
 * that pure acoustic analysis cannot capture.
 */

// ============================================
// Type Definitions
// ============================================

export interface ScoreAdjustments {
  stressAdjustment: number // Positive = increases score
  fatigueAdjustment: number // Positive = increases score
}

export interface CombinedScores {
  finalStressScore: number // 0-100
  finalFatigueScore: number // 0-100
}

// ============================================
// Core Scoring Functions
// ============================================

/**
 * Calculate semantic adjustments from Gemini analysis
 *
 * Maps Gemini observations (stress cues, fatigue cues, emotions) to score adjustments.
 * These adjustments are applied to the acoustic baseline.
 *
 * @param semanticAnalysis - Gemini's semantic analysis result
 * @returns Score adjustments for stress and fatigue (0-20 range typically)
 */
export function calculateSemanticAdjustments(
  semanticAnalysis: GeminiSemanticAnalysis
): ScoreAdjustments {
  let stressAdjustment = 0
  let fatigueAdjustment = 0

  // Process observations (stress cues, fatigue cues, positive cues)
  for (const obs of semanticAnalysis.observations) {
    const adjustment = getObservationAdjustment(obs.type, obs.relevance)

    if (obs.type === "stress_cue") {
      stressAdjustment += adjustment
    } else if (obs.type === "fatigue_cue") {
      fatigueAdjustment += adjustment
    } else if (obs.type === "positive_cue") {
      // Positive cues reduce both stress and fatigue
      stressAdjustment -= adjustment * 0.7 // Slightly less reduction
      fatigueAdjustment -= adjustment * 0.7
    }
  }

  // Process overall emotion
  const emotionAdjustment = getEmotionAdjustment(
    semanticAnalysis.overallEmotion,
    semanticAnalysis.emotionConfidence
  )
  stressAdjustment += emotionAdjustment.stress
  fatigueAdjustment += emotionAdjustment.fatigue

  // Clamp adjustments to reasonable range (-15 to +20)
  stressAdjustment = Math.max(-15, Math.min(20, stressAdjustment))
  fatigueAdjustment = Math.max(-15, Math.min(20, fatigueAdjustment))

  return { stressAdjustment, fatigueAdjustment }
}

/**
 * Combine acoustic and semantic scores with weighted blending
 *
 * Acoustic analysis is weighted 70% (objective, reliable baseline)
 * Semantic analysis adjustments weighted 30% (contextual refinement)
 *
 * @param acousticStress - Stress score from acoustic features (0-100)
 * @param acousticFatigue - Fatigue score from acoustic features (0-100)
 * @param semanticAnalysis - Gemini semantic analysis (null if unavailable)
 * @returns Final combined stress and fatigue scores
 */
export function combineScores(
  acousticStress: number,
  acousticFatigue: number,
  semanticAnalysis: GeminiSemanticAnalysis | null
): CombinedScores {
  // If no semantic analysis, return 100% acoustic scores
  if (!semanticAnalysis) {
    return {
      finalStressScore: Math.round(acousticStress),
      finalFatigueScore: Math.round(acousticFatigue),
    }
  }

  // Calculate semantic adjustments
  const adjustments = calculateSemanticAdjustments(semanticAnalysis)

  // Apply weighted blend: 70% acoustic + 30% semantic adjustment
  const ACOUSTIC_WEIGHT = 0.7
  const SEMANTIC_WEIGHT = 0.3

  const finalStressScore =
    acousticStress * ACOUSTIC_WEIGHT +
    (acousticStress + adjustments.stressAdjustment) * SEMANTIC_WEIGHT

  const finalFatigueScore =
    acousticFatigue * ACOUSTIC_WEIGHT +
    (acousticFatigue + adjustments.fatigueAdjustment) * SEMANTIC_WEIGHT

  // Clamp to valid range [0, 100]
  return {
    finalStressScore: Math.max(0, Math.min(100, Math.round(finalStressScore))),
    finalFatigueScore: Math.max(0, Math.min(100, Math.round(finalFatigueScore))),
  }
}

/**
 * Convert numeric score to categorical stress level
 */
export function scoreToStressLevel(score: number): StressLevel {
  if (score >= 70) return "high"
  if (score >= 50) return "elevated"
  if (score >= 30) return "moderate"
  return "low"
}

/**
 * Convert numeric score to categorical fatigue level
 */
export function scoreToFatigueLevel(score: number): FatigueLevel {
  if (score >= 70) return "exhausted"
  if (score >= 50) return "tired"
  if (score >= 30) return "normal"
  return "rested"
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get score adjustment based on observation type and relevance
 */
function getObservationAdjustment(
  type: ObservationType,
  relevance: ObservationRelevance
): number {
  const relevanceMultiplier = {
    high: 1.0,
    medium: 0.6,
    low: 0.3,
  }

  const baseAdjustment = {
    stress_cue: 12, // High stress cue adds 12 points at high relevance
    fatigue_cue: 12, // High fatigue cue adds 12 points at high relevance
    positive_cue: 8, // Positive cue reduces by 8 points at high relevance
  }

  return baseAdjustment[type] * relevanceMultiplier[relevance]
}

/**
 * Get score adjustments based on overall emotion
 *
 * Emotions map to stress/fatigue adjustments weighted by confidence
 */
function getEmotionAdjustment(
  emotion: EmotionType,
  confidence: number
): { stress: number; fatigue: number } {
  const baseAdjustments = {
    happy: { stress: -8, fatigue: -8 }, // Happy reduces both
    sad: { stress: 0, fatigue: 10 }, // Sadness indicates fatigue
    angry: { stress: 12, fatigue: 0 }, // Anger indicates stress
    neutral: { stress: 0, fatigue: 0 }, // Neutral = no adjustment
  }

  const adjustment = baseAdjustments[emotion]

  // Scale by confidence (low confidence = smaller adjustment)
  return {
    stress: adjustment.stress * confidence,
    fatigue: adjustment.fatigue * confidence,
  }
}
