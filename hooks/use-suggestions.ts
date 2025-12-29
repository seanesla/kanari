"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import type { Suggestion, VoiceMetrics, TrendDirection } from "@/lib/types"
import { useSuggestionsByRecording, useSuggestionActions } from "./use-storage"

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
  fetchSuggestions: (metrics: VoiceMetrics, trend: TrendDirection) => Promise<void>
  updateSuggestion: (id: string, status: Suggestion["status"]) => void
  regenerate: (metrics: VoiceMetrics, trend: TrendDirection) => Promise<void>
}

export function useSuggestions(recordingId: string | null): UseSuggestionsResult {
  // Get persisted suggestions from IndexedDB
  const { suggestions: persistedSuggestions, isLoading: suggestionsLoading, forRecordingId } = useSuggestionsByRecording(recordingId)
  const { addSuggestions, updateSuggestion: updateSuggestionInDB, deleteSuggestionsByRecording } = useSuggestionActions()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track if we've already initiated a fetch for this recording
  const fetchInitiatedRef = useRef<string | null>(null)

  /**
   * Fetch suggestions from Gemini API and persist to IndexedDB
   */
  const fetchSuggestions = useCallback(async (metrics: VoiceMetrics, trend: TrendDirection) => {
    if (!recordingId) {
      setError("No recording ID provided")
      return
    }

    setLoading(true)
    setError(null)

    try {
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
   */
  const updateSuggestion = useCallback((id: string, status: Suggestion["status"]) => {
    updateSuggestionInDB(id, { status }).catch((err) => {
      console.error("Error updating suggestion:", err)
    })
  }, [updateSuggestionInDB])

  /**
   * Regenerate suggestions - clear existing and fetch new ones
   */
  const regenerate = useCallback(async (metrics: VoiceMetrics, trend: TrendDirection) => {
    if (!recordingId) {
      setError("No recording ID provided")
      return
    }

    // Reset fetch tracking so we can fetch again
    fetchInitiatedRef.current = null

    // Delete existing suggestions for this recording
    await deleteSuggestionsByRecording(recordingId)

    // Fetch new suggestions
    await fetchSuggestions(metrics, trend)
  }, [recordingId, deleteSuggestionsByRecording, fetchSuggestions])

  return {
    suggestions: persistedSuggestions,
    loading,
    suggestionsLoading,
    forRecordingId,
    error,
    fetchSuggestions,
    updateSuggestion,
    regenerate,
  }
}
