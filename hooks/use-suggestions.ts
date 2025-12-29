"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import type { Suggestion, VoiceMetrics, TrendDirection, SuggestionStatus, Recording, AudioFeatures, VoicePatterns, HistoricalContext, BurnoutPrediction } from "@/lib/types"
import { useSuggestionsByRecording, useSuggestionActions } from "./use-storage"
import { predictBurnoutRisk, recordingsToTrendData } from "@/lib/ml/forecasting"

/**
 * React hook for fetching Gemini-powered recovery suggestions with IndexedDB persistence
 *
 * Usage:
 * ```tsx
 * const { suggestions, loading, error, fetchSuggestions, updateSuggestion, regenerate } = useSuggestions(recordingId)
 *
 * // Fetch new suggestions (automatically persisted)
 * await fetchSuggestions(metrics, trend)
 *
 * // Update suggestion status (persisted to IndexedDB)
 * updateSuggestion(suggestionId, "accepted")
 *
 * // Regenerate suggestions (clears existing and fetches new)
 * await regenerate(metrics, trend)
 * ```
 */

interface UseSuggestionsResult {
  suggestions: Suggestion[]
  loading: boolean
  suggestionsLoading: boolean
  forRecordingId: string | null
  error: string | null
  updateError: string | null
  clearUpdateError: () => void
  fetchSuggestions: (metrics: VoiceMetrics, trend: TrendDirection, allRecordings?: Recording[]) => Promise<void>
  updateSuggestion: (id: string, status: SuggestionStatus) => Promise<boolean>
  regenerate: (metrics: VoiceMetrics, trend: TrendDirection, allRecordings?: Recording[]) => Promise<void>
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

export function useSuggestions(recordingId: string | null): UseSuggestionsResult {
  // Get persisted suggestions from IndexedDB
  const { suggestions: persistedSuggestions, isLoading: suggestionsLoading, forRecordingId } = useSuggestionsByRecording(recordingId)
  const { addSuggestions, updateSuggestion: updateSuggestionInDB, deleteSuggestionsByRecording } = useSuggestionActions()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)

  // Track if we've already initiated a fetch for this recording
  const fetchInitiatedRef = useRef<string | null>(null)

  const clearUpdateError = useCallback(() => setUpdateError(null), [])

  /**
   * Fetch suggestions from Gemini API and persist to IndexedDB
   */
  const fetchSuggestions = useCallback(async (
    metrics: VoiceMetrics,
    trend: TrendDirection,
    allRecordings?: Recording[]
  ) => {
    if (!recordingId) {
      setError("No recording ID provided")
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Build enriched context if historical data provided
      let voicePatterns: VoicePatterns | undefined
      let history: HistoricalContext | undefined
      let burnoutPrediction: BurnoutPrediction | undefined

      if (allRecordings && allRecordings.length > 0) {
        // Get the latest recording (should match recordingId)
        const latestRecording = allRecordings.find(r => r.id === recordingId)

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

      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
          confidence: metrics.confidence
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `API error: ${response.status}`)
      }

      const data = await response.json()

      if (!data.suggestions || !Array.isArray(data.suggestions)) {
        throw new Error("Invalid response format from API")
      }

      // Add recordingId to each suggestion and persist to IndexedDB
      const suggestionsWithRecordingId: Suggestion[] = data.suggestions.map((s: Suggestion) => ({
        ...s,
        recordingId,
      }))

      await addSuggestions(suggestionsWithRecordingId)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch suggestions"
      setError(errorMessage)
      console.error("Error fetching suggestions:", err)
    } finally {
      setLoading(false)
    }
  }, [recordingId, addSuggestions])

  /**
   * Update suggestion status (persisted to IndexedDB)
   * Returns true on success, false on failure
   */
  const updateSuggestion = useCallback(async (id: string, status: SuggestionStatus): Promise<boolean> => {
    try {
      setUpdateError(null)
      await updateSuggestionInDB(id, { status })
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
      const updates: Partial<Suggestion> = { status: newStatus }
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
      await updateSuggestionInDB(id, { status: "scheduled", scheduledFor })
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
      await updateSuggestionInDB(id, { status: "dismissed" })
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
      await updateSuggestionInDB(id, { status: "completed" })
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to complete suggestion"
      setUpdateError(errorMessage)
      console.error("Error completing suggestion:", err)
      return false
    }
  }, [updateSuggestionInDB])

  /**
   * Regenerate suggestions - clear existing and fetch new ones
   */
  const regenerate = useCallback(async (
    metrics: VoiceMetrics,
    trend: TrendDirection,
    allRecordings?: Recording[]
  ) => {
    if (!recordingId) {
      setError("No recording ID provided")
      return
    }

    // Reset fetch tracking so we can fetch again
    fetchInitiatedRef.current = null

    // Delete existing suggestions for this recording
    await deleteSuggestionsByRecording(recordingId)

    // Fetch new suggestions
    await fetchSuggestions(metrics, trend, allRecordings)
  }, [recordingId, deleteSuggestionsByRecording, fetchSuggestions])

  return {
    suggestions: persistedSuggestions,
    loading,
    suggestionsLoading,
    forRecordingId,
    error,
    updateError,
    clearUpdateError,
    fetchSuggestions,
    updateSuggestion,
    regenerate,
    // Kanban-specific actions
    moveSuggestion,
    scheduleSuggestion,
    dismissSuggestion,
    completeSuggestion,
  }
}
