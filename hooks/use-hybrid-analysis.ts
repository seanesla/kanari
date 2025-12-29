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
 * NOTE: This is a stub that will be replaced when the acoustic-breakdown
 * branch is merged. For now, it returns mock data.
 */
async function runAcousticAnalysis(audioData: Float32Array): Promise<{
  breakdown: AcousticBreakdown
  stressScore: number
  fatigueScore: number
  features: AudioFeatures
}> {
  // TODO: Replace with actual analyzeWithBreakdown from @/lib/ml/inference
  // when the acoustic-breakdown branch is merged
  //
  // import { analyzeWithBreakdown } from "@/lib/ml/inference"
  // return analyzeWithBreakdown(features)

  // For now, return stub data
  // This will be replaced with real implementation
  return new Promise((resolve) => {
    setTimeout(() => {
      // Extract features from audio (stub - will use real feature extraction)
      const features: AudioFeatures = {
        mfcc: Array(13).fill(0),
        spectralCentroid: 0.5,
        spectralFlux: 0.12,
        spectralRolloff: 0.8,
        rms: 0.2,
        zcr: 0.06,
        speechRate: 4.5,
        pauseRatio: 0.25,
        pauseCount: 8,
        avgPauseDuration: 450,
      }

      // Generate mock breakdown (will be replaced with real acoustic analysis)
      const breakdown: AcousticBreakdown = {
        speechRate: {
          featureName: "speechRate",
          displayName: "Speech Rate",
          rawValue: 4.5,
          normalizedValue: 0.6,
          status: "normal",
          contribution: 10,
          maxContribution: 30,
          description: "Speech rate is normal at 4.5 syllables/sec",
        },
        rmsEnergy: {
          featureName: "rms",
          displayName: "Voice Energy",
          rawValue: 0.2,
          normalizedValue: 0.5,
          status: "normal",
          contribution: 12,
          maxContribution: 25,
          description: "Voice energy is normal",
        },
        spectralFlux: {
          featureName: "spectralFlux",
          displayName: "Spectral Flux",
          rawValue: 0.12,
          normalizedValue: 0.6,
          status: "normal",
          contribution: 12,
          maxContribution: 25,
          description: "Spectral flux is normal",
        },
        spectralCentroid: {
          featureName: "spectralCentroid",
          displayName: "Voice Brightness",
          rawValue: 0.5,
          normalizedValue: 0.5,
          status: "normal",
          contribution: 10,
          maxContribution: 20,
          description: "Voice brightness is normal",
        },
        pauseRatio: {
          featureName: "pauseRatio",
          displayName: "Pause Ratio",
          rawValue: 0.25,
          normalizedValue: 0.4,
          status: "normal",
          contribution: 12,
          maxContribution: 25,
          description: "Pause ratio is normal at 25%",
        },
        zcr: {
          featureName: "zcr",
          displayName: "Zero Crossing Rate",
          rawValue: 0.06,
          normalizedValue: 0.5,
          status: "normal",
          contribution: 10,
          maxContribution: 20,
          description: "Zero crossing rate is normal",
        },
      }

      resolve({
        breakdown,
        stressScore: 42,
        fatigueScore: 38,
        features,
      })
    }, 500) // Simulate processing delay
  })
}

/**
 * Run Gemini semantic analysis on audio
 *
 * NOTE: This is a stub that will call the /api/gemini/analyze endpoint
 * when it's implemented in the gemini-semantic-api branch.
 */
async function runSemanticAnalysis(
  audioBase64: string,
  mimeType: string
): Promise<GeminiSemanticAnalysis> {
  // TODO: Replace with actual API call when gemini-semantic-api branch is merged
  //
  // const response = await fetch("/api/gemini/analyze", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ audio: audioBase64, mimeType }),
  // })
  // if (!response.ok) throw new Error("Gemini API failed")
  // return await response.json()

  // For now, return stub data
  // This will be replaced with real API implementation
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        segments: [
          {
            timestamp: "00:00",
            content: "I'm feeling a bit overwhelmed with all the tasks today.",
            emotion: "neutral",
          },
          {
            timestamp: "00:05",
            content: "There's just so much to get done.",
            emotion: "sad",
          },
        ],
        overallEmotion: "neutral",
        emotionConfidence: 0.75,
        observations: [
          {
            type: "stress_cue",
            observation: "Speaker mentions feeling overwhelmed",
            relevance: "high",
          },
          {
            type: "fatigue_cue",
            observation: "Tone suggests low energy",
            relevance: "medium",
          },
        ],
        stressInterpretation: "Speaker sounds pressured by workload",
        fatigueInterpretation: "Voice lacks enthusiasm, suggests tiredness",
        summary:
          "Speaker expresses being overwhelmed by tasks, with neutral-to-low emotional tone suggesting mild stress and fatigue.",
      })
    }, 800) // Simulate API delay
  })
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
