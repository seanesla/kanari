"use client"

import { useState } from "react"
import type {
  HybridAnalysis,
  GeminiSemanticAnalysis,
  AcousticBreakdown,
  AudioFeatures,
} from "@/lib/types"
import {
  combineScores,
  scoreToStressLevel,
  scoreToFatigueLevel,
} from "@/lib/ml/hybrid-scoring"
import { extractFeatures } from "@/lib/audio/feature-extractor"
import { analyzeWithBreakdown, analyzeVoiceMetrics } from "@/lib/ml/inference"

/**
 * React hook for hybrid analysis combining acoustic and semantic processing
 *
 * Runs local acoustic analysis and Gemini semantic analysis in parallel,
 * then combines results with weighted blending. Gracefully falls back to
 * acoustic-only analysis if Gemini fails.
 *
 * Usage:
 * ```tsx
 * const { analyze, isAnalyzing, error, result } = useHybridAnalysis()
 *
 * const analysis = await analyze(audioData, audioBase64, "audio/webm")
 * ```
 */
export function useHybridAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<HybridAnalysis | null>(null)

  /**
   * Analyze audio using hybrid approach (acoustic + semantic)
   *
   * @param audioData - Raw audio samples (Float32Array)
   * @param audioBase64 - Base64-encoded audio for Gemini API
   * @param mimeType - Audio MIME type (e.g., "audio/webm")
   * @returns Complete hybrid analysis result
   */
  async function analyze(
    audioData: Float32Array,
    audioBase64: string,
    mimeType: string
  ): Promise<HybridAnalysis> {
    setIsAnalyzing(true)
    setError(null)

    try {
      // Run acoustic and semantic analyses in parallel
      const [acousticResult, semanticResult] = await Promise.allSettled([
        runAcousticAnalysis(audioData),
        runSemanticAnalysis(audioBase64, mimeType),
      ])

      // Extract acoustic analysis (required - must succeed)
      if (acousticResult.status === "rejected") {
        throw new Error(`Acoustic analysis failed: ${acousticResult.reason}`)
      }

      const { breakdown, stressScore, fatigueScore, features } = acousticResult.value

      // Extract semantic analysis (optional - can fail gracefully)
      const semanticAnalysis: GeminiSemanticAnalysis | null =
        semanticResult.status === "fulfilled" ? semanticResult.value : null

      // If Gemini failed, log the error but continue
      if (semanticResult.status === "rejected") {
        console.warn("Gemini semantic analysis failed:", semanticResult.reason)
      }

      // Combine acoustic and semantic scores (70/30 weighted blend)
      const { finalStressScore, finalFatigueScore } = combineScores(
        stressScore,
        fatigueScore,
        semanticAnalysis
      )

      // Calculate confidence based on data quality and analysis method
      const confidence = calculateConfidence(features, semanticAnalysis)

      // Build final hybrid analysis result
      const analysis: HybridAnalysis = {
        // Acoustic data
        acousticBreakdown: breakdown,
        acousticStressScore: stressScore,
        acousticFatigueScore: fatigueScore,

        // Semantic data (null if Gemini failed)
        semanticAnalysis,

        // Combined scores
        finalStressScore,
        finalFatigueScore,

        // UI-friendly levels
        stressLevel: scoreToStressLevel(finalStressScore),
        fatigueLevel: scoreToFatigueLevel(finalFatigueScore),
        confidence,

        // Metadata
        analysisTimestamp: new Date().toISOString(),
        analysisMethod: semanticAnalysis ? "hybrid" : "acoustic_only",
      }

      setResult(analysis)
      return analysis
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Analysis failed"
      setError(errorMessage)
      throw err
    } finally {
      setIsAnalyzing(false)
    }
  }

  return {
    analyze,
    isAnalyzing,
    error,
    result,
  }
}

// ============================================
// Private Helper Functions
// ============================================

/**
 * Run acoustic analysis on raw audio data
 *
 * Uses Meyda for feature extraction and local heuristics for scoring.
 */
async function runAcousticAnalysis(audioData: Float32Array): Promise<{
  breakdown: AcousticBreakdown
  stressScore: number
  fatigueScore: number
  features: AudioFeatures
}> {
  // Extract audio features using Meyda
  const features = extractFeatures(audioData)

  // Get acoustic breakdown with per-feature contributions
  const breakdown = analyzeWithBreakdown(features)

  // Get stress/fatigue scores using existing heuristics
  const metrics = analyzeVoiceMetrics(features)

  return {
    breakdown,
    stressScore: metrics.stressScore,
    fatigueScore: metrics.fatigueScore,
    features,
  }
}

/**
 * Run Gemini semantic analysis on audio
 *
 * Calls the /api/gemini/analyze endpoint for emotion detection and semantic analysis.
 */
async function runSemanticAnalysis(
  audioBase64: string,
  mimeType: string
): Promise<GeminiSemanticAnalysis> {
  const response = await fetch("/api/gemini/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audioData: audioBase64, mimeType }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || `Gemini API failed: ${response.status}`)
  }

  const data = await response.json()
  return data.analysis
}

/**
 * Calculate overall confidence score
 *
 * Combines acoustic feature quality with semantic analysis availability
 */
function calculateConfidence(
  features: AudioFeatures,
  semanticAnalysis: GeminiSemanticAnalysis | null
): number {
  let confidence = 0.7 // Base confidence

  // Adjust for audio quality (same logic as acoustic-only)
  if (features.pauseCount > 10) confidence += 0.1
  else if (features.pauseCount < 3) confidence -= 0.15

  if (features.rms < 0.05) confidence -= 0.15
  else if (features.rms > 0.15) confidence += 0.05

  // Boost confidence if we have semantic analysis
  if (semanticAnalysis) {
    confidence += 0.15 // Hybrid analysis is more reliable
    // Further boost if emotion detection is confident
    if (semanticAnalysis.emotionConfidence > 0.8) {
      confidence += 0.05
    }
  }

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, confidence))
}
