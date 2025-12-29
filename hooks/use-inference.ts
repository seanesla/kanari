"use client"

import { useMemo } from "react"
import { analyzeVoiceMetrics, validateFeatures } from "@/lib/ml/inference"
import type { AudioFeatures, VoiceMetrics } from "@/lib/types"

/**
 * React hook for ML inference on audio features
 *
 * Usage:
 * ```tsx
 * const { metrics, isValid, error } = useInference(audioFeatures)
 * ```
 */

interface UseInferenceResult {
  metrics: VoiceMetrics | null
  isValid: boolean
  error: string | null
}

export function useInference(features: AudioFeatures | null | undefined): UseInferenceResult {
  return useMemo(() => {
    // No features provided
    if (!features) {
      return {
        metrics: null,
        isValid: false,
        error: null,
      }
    }

    // Validate features
    const isValid = validateFeatures(features)

    if (!isValid) {
      return {
        metrics: null,
        isValid: false,
        error: "Invalid or insufficient audio features for analysis",
      }
    }

    // Perform inference
    try {
      const metrics = analyzeVoiceMetrics(features)

      return {
        metrics,
        isValid: true,
        error: null,
      }
    } catch (error) {
      return {
        metrics: null,
        isValid: false,
        error: error instanceof Error ? error.message : "Failed to analyze audio features",
      }
    }
  }, [features])
}

/**
 * Batch inference hook for multiple recordings
 *
 * Usage:
 * ```tsx
 * const results = useBatchInference(recordings)
 * ```
 */
export function useBatchInference(
  recordings: Array<{ id: string; features?: AudioFeatures }>
): Map<string, VoiceMetrics> {
  return useMemo(() => {
    const results = new Map<string, VoiceMetrics>()

    for (const recording of recordings) {
      if (!recording.features) continue

      const isValid = validateFeatures(recording.features)
      if (!isValid) continue

      try {
        const metrics = analyzeVoiceMetrics(recording.features)
        results.set(recording.id, metrics)
      } catch (error) {
        console.error(`Failed to analyze recording ${recording.id}:`, error)
      }
    }

    return results
  }, [recordings])
}
