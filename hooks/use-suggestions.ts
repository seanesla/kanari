"use client"

import { useState, useCallback, useRef } from "react"
import type {
  Suggestion,
  VoiceMetrics,
  TrendDirection,
  SuggestionStatus,
  Recording,
  AudioFeatures,
  VoicePatterns,
  HistoricalContext,
  BurnoutPrediction,
  GeminiDiffSuggestion,
  SuggestionDecision,
} from "@/lib/types"
import { useAllSuggestions, useSuggestionActions } from "./use-storage"
import { useSuggestionMemory } from "./use-suggestion-memory"
import { predictBurnoutRisk, recordingsToTrendData } from "@/lib/ml/forecasting"
import { createGeminiHeaders } from "@/lib/utils"

/**
 * React hook for managing Gemini-powered recovery suggestions with diff-aware generation.
 *
 * Key changes from recording-bound approach:
 * - Suggestions are now global (not tied to specific recordings)
 * - Regeneration uses diff-aware mode (keep/update/drop/new decisions)
 * - Memory context sent to Gemini includes user action history
 *
 * Usage:
 * ```tsx
 * const { suggestions, loading, error, regenerateWithDiff, updateSuggestion } = useSuggestions()
 *
 * // Regenerate suggestions with diff-aware mode (reviews existing, makes decisions)
 * await regenerateWithDiff(metrics, trend, allRecordings)
 *
 * // Update suggestion status (persisted to IndexedDB)
 * updateSuggestion(suggestionId, "completed")
 * ```
 */

interface DiffSummary {
  kept: number
  updated: number
  dropped: number
  added: number
}

interface UseSuggestionsResult {
  suggestions: Suggestion[]
  activeSuggestions: Suggestion[]
  loading: boolean
  error: string | null
  updateError: string | null
  lastDiffSummary: DiffSummary | null
  clearUpdateError: () => void
  clearDiffSummary: () => void
  regenerateWithDiff: (metrics: VoiceMetrics, trend: TrendDirection, allRecordings?: Recording[]) => Promise<void>
  updateSuggestion: (id: string, status: SuggestionStatus) => Promise<boolean>
  // Kanban-specific actions
  moveSuggestion: (id: string, newStatus: SuggestionStatus, scheduledFor?: string) => Promise<boolean>
  scheduleSuggestion: (id: string, scheduledFor: string) => Promise<boolean>
  dismissSuggestion: (id: string) => Promise<boolean>
  completeSuggestion: (id: string) => Promise<boolean>
}

/**
 * Convert audio features to qualitative voice patterns
 */
export function featuresToVoicePatterns(features?: AudioFeatures): VoicePatterns {
  if (!features) {
    return { speechRate: "normal", energyLevel: "moderate", pauseFrequency: "normal", voiceTone: "neutral" }
  }

  return {
    speechRate: features.speechRate > 5.5 ? "fast" : features.speechRate < 3 ? "slow" : "normal",
    energyLevel: features.rms > 0.3 ? "high" : features.rms < 0.1 ? "low" : "moderate",
    pauseFrequency: features.pauseRatio > 0.4 ? "frequent" : features.pauseRatio < 0.2 ? "rare" : "normal",
    voiceTone: features.spectralCentroid > 0.5 ? "bright" : features.spectralCentroid < 0.3 ? "dull" : "neutral"
  }
}

/**
 * Compute historical context from recordings
 */
export function computeHistoricalContext(recordings: Recording[]): HistoricalContext {
  const validRecordings = recordings.filter(r => r.metrics)

  if (validRecordings.length === 0) {
    return { recordingCount: 0, daysOfData: 0, averageStress: 0, averageFatigue: 0, stressChange: "stable", fatigueChange: "stable" }
  }

  const avgStress = validRecordings.reduce((sum, r) => sum + (r.metrics?.stressScore || 0), 0) / validRecordings.length
  const avgFatigue = validRecordings.reduce((sum, r) => sum + (r.metrics?.fatigueScore || 0), 0) / validRecordings.length

  // Calculate unique days
  const uniqueDays = new Set(validRecordings.map(r => r.createdAt.split("T")[0]))

  // Calculate change from baseline (compare latest to average)
  const latest = validRecordings[0]?.metrics
  const stressDiff = latest ? latest.stressScore - avgStress : 0
  const fatigueDiff = latest ? latest.fatigueScore - avgFatigue : 0

  const formatChange = (diff: number) => {
    if (Math.abs(diff) < 5) return "stable"
    const sign = diff > 0 ? "+" : ""
    return `${sign}${Math.round(diff)}% from baseline`
  }

  return {
    recordingCount: validRecordings.length,
    daysOfData: uniqueDays.size,
    averageStress: Math.round(avgStress),
    averageFatigue: Math.round(avgFatigue),
    stressChange: formatChange(stressDiff),
    fatigueChange: formatChange(fatigueDiff)
  }
}

export function useSuggestions(): UseSuggestionsResult {
  // Get ALL suggestions globally (not recording-bound)
  const allSuggestions = useAllSuggestions()
  const { memoryContext, getActiveSuggestions, buildMemoryContext } = useSuggestionMemory()
  const {
    addSuggestion,
    addSuggestions,
    updateSuggestion: updateSuggestionInDB,
    deleteSuggestion,
  } = useSuggestionActions()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [lastDiffSummary, setLastDiffSummary] = useState<DiffSummary | null>(null)

  const clearUpdateError = useCallback(() => setUpdateError(null), [])
  const clearDiffSummary = useCallback(() => setLastDiffSummary(null), [])

  /**
   * Regenerate suggestions using diff-aware mode.
   * Gemini reviews existing suggestions and decides: keep, update, drop, or add new.
   */
  const regenerateWithDiff = useCallback(async (
    metrics: VoiceMetrics,
    trend: TrendDirection,
    allRecordings?: Recording[]
  ) => {
    setLoading(true)
    setError(null)
    setLastDiffSummary(null)

    try {
      // Build enriched context if historical data provided
      let voicePatterns: VoicePatterns | undefined
      let history: HistoricalContext | undefined
      let burnoutPrediction: BurnoutPrediction | undefined

      if (allRecordings && allRecordings.length > 0) {
        // Get the latest recording
        const sortedRecordings = [...allRecordings].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        const latestRecording = sortedRecordings[0]

        // Extract voice patterns from latest recording
        voicePatterns = featuresToVoicePatterns(latestRecording?.features)

        // Compute historical context
        history = computeHistoricalContext(allRecordings)

        // Predict burnout risk if we have enough data
        if (allRecordings.length >= 2) {
          const trendData = recordingsToTrendData(allRecordings)
          burnoutPrediction = predictBurnoutRisk(trendData)
        }
      }

      // Get active suggestions for diff review
      const activeSuggestions = getActiveSuggestions()

      // Build memory context
      const memory = buildMemoryContext()

      // Get headers with API key from settings
      const headers = await createGeminiHeaders({
        "Content-Type": "application/json",
      })

      const response = await fetch("/api/gemini", {
        method: "POST",
        headers,
        body: JSON.stringify({
          stressScore: metrics.stressScore,
          stressLevel: metrics.stressLevel,
          fatigueScore: metrics.fatigueScore,
          fatigueLevel: metrics.fatigueLevel,
          trend,
          // Enriched context
          voicePatterns,
          history,
          burnout: burnoutPrediction,
          confidence: metrics.confidence,
          // Diff-aware mode
          diffMode: true,
          existingSuggestions: activeSuggestions,
          memoryContext: memory,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `API error: ${response.status}`)
      }

      const data = await response.json()

      if (!data.diffMode || !data.suggestions || !Array.isArray(data.suggestions)) {
        throw new Error("Invalid diff response format from API")
      }

      // Process diff response
      const now = new Date().toISOString()

      for (const diffSuggestion of data.suggestions as GeminiDiffSuggestion[]) {
        switch (diffSuggestion.decision) {
          case "keep":
            // No action needed - suggestion stays as-is
            break

          case "update":
            // Update the existing suggestion with new content
            await updateSuggestionInDB(diffSuggestion.id, {
              content: diffSuggestion.content,
              rationale: diffSuggestion.rationale,
              duration: diffSuggestion.duration,
              category: diffSuggestion.category,
              lastDecision: "update" as SuggestionDecision,
              lastDecisionReason: diffSuggestion.decisionReason,
              lastUpdatedAt: now,
              version: (activeSuggestions.find(s => s.id === diffSuggestion.id)?.version || 1) + 1,
            })
            break

          case "drop":
            // Delete the suggestion (or mark as dismissed based on reason)
            await deleteSuggestion(diffSuggestion.id)
            break

          case "new":
            // Add new suggestion
            const newSuggestion: Suggestion = {
              id: diffSuggestion.id,
              content: diffSuggestion.content,
              rationale: diffSuggestion.rationale,
              duration: diffSuggestion.duration,
              category: diffSuggestion.category,
              status: "pending",
              createdAt: now,
              version: 1,
              lastDecision: "new",
            }
            await addSuggestion(newSuggestion)
            break
        }
      }

      // Store diff summary for UI display
      setLastDiffSummary(data.summary)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to regenerate suggestions"
      setError(errorMessage)
      console.error("Error regenerating suggestions:", err)
    } finally {
      setLoading(false)
    }
  }, [getActiveSuggestions, buildMemoryContext, updateSuggestionInDB, deleteSuggestion, addSuggestion])

  /**
   * Update suggestion status (persisted to IndexedDB)
   * Returns true on success, false on failure
   */
  const updateSuggestion = useCallback(async (id: string, status: SuggestionStatus): Promise<boolean> => {
    try {
      setUpdateError(null)
      await updateSuggestionInDB(id, {
        status,
        lastUpdatedAt: new Date().toISOString(),
      })
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update suggestion"
      setUpdateError(errorMessage)
      console.error("Error updating suggestion:", err)
      return false
    }
  }, [updateSuggestionInDB])

  /**
   * Move suggestion to a new status (for kanban drag-drop)
   * Optionally set scheduledFor when moving to "scheduled"
   * Returns true on success, false on failure
   */
  const moveSuggestion = useCallback(async (id: string, newStatus: SuggestionStatus, scheduledFor?: string): Promise<boolean> => {
    try {
      setUpdateError(null)
      const updates: Partial<Suggestion> = {
        status: newStatus,
        lastUpdatedAt: new Date().toISOString(),
      }
      if (scheduledFor) {
        updates.scheduledFor = scheduledFor
      }
      await updateSuggestionInDB(id, updates)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to move suggestion"
      setUpdateError(errorMessage)
      console.error("Error moving suggestion:", err)
      return false
    }
  }, [updateSuggestionInDB])

  /**
   * Schedule a suggestion for a specific time
   * Returns true on success, false on failure
   */
  const scheduleSuggestion = useCallback(async (id: string, scheduledFor: string): Promise<boolean> => {
    try {
      setUpdateError(null)
      await updateSuggestionInDB(id, {
        status: "scheduled",
        scheduledFor,
        lastUpdatedAt: new Date().toISOString(),
      })
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to schedule suggestion"
      setUpdateError(errorMessage)
      console.error("Error scheduling suggestion:", err)
      return false
    }
  }, [updateSuggestionInDB])

  /**
   * Dismiss a suggestion (marks as dismissed)
   * Returns true on success, false on failure
   */
  const dismissSuggestion = useCallback(async (id: string): Promise<boolean> => {
    try {
      setUpdateError(null)
      await updateSuggestionInDB(id, {
        status: "dismissed",
        lastUpdatedAt: new Date().toISOString(),
      })
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to dismiss suggestion"
      setUpdateError(errorMessage)
      console.error("Error dismissing suggestion:", err)
      return false
    }
  }, [updateSuggestionInDB])

  /**
   * Mark a scheduled suggestion as completed
   * Returns true on success, false on failure
   */
  const completeSuggestion = useCallback(async (id: string): Promise<boolean> => {
    try {
      setUpdateError(null)
      await updateSuggestionInDB(id, {
        status: "completed",
        lastUpdatedAt: new Date().toISOString(),
      })
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to complete suggestion"
      setUpdateError(errorMessage)
      console.error("Error completing suggestion:", err)
      return false
    }
  }, [updateSuggestionInDB])

  // Get active suggestions (pending + scheduled) for display
  const activeSuggestions = getActiveSuggestions()

  return {
    suggestions: allSuggestions,
    activeSuggestions,
    loading,
    error,
    updateError,
    lastDiffSummary,
    clearUpdateError,
    clearDiffSummary,
    regenerateWithDiff,
    updateSuggestion,
    // Kanban-specific actions
    moveSuggestion,
    scheduleSuggestion,
    dismissSuggestion,
    completeSuggestion,
  }
}
