"use client"

import { useState, useCallback } from "react"
import type { Suggestion, VoiceMetrics, TrendDirection } from "@/lib/types"

/**
 * React hook for fetching Gemini-powered recovery suggestions
 *
 * Usage:
 * ```tsx
 * const { suggestions, loading, error, fetchSuggestions, updateSuggestion } = useSuggestions()
 *
 * // Fetch new suggestions
 * await fetchSuggestions(metrics, trend)
 *
 * // Update suggestion status
 * updateSuggestion(suggestionId, "accepted")
 * ```
 */

interface UseSuggestionsResult {
  suggestions: Suggestion[]
  loading: boolean
  error: string | null
  fetchSuggestions: (metrics: VoiceMetrics, trend: TrendDirection) => Promise<void>
  updateSuggestion: (id: string, status: Suggestion["status"]) => void
  clearSuggestions: () => void
}

export function useSuggestions(): UseSuggestionsResult {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetch suggestions from Gemini API
   */
  const fetchSuggestions = useCallback(async (metrics: VoiceMetrics, trend: TrendDirection) => {
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

      setSuggestions(data.suggestions)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch suggestions"
      setError(errorMessage)
      console.error("Error fetching suggestions:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Update suggestion status (accept/dismiss/schedule)
   */
  const updateSuggestion = useCallback((id: string, status: Suggestion["status"]) => {
    setSuggestions((prev) =>
      prev.map((suggestion) =>
        suggestion.id === id ? { ...suggestion, status } : suggestion
      )
    )
  }, [])

  /**
   * Clear all suggestions
   */
  const clearSuggestions = useCallback(() => {
    setSuggestions([])
    setError(null)
  }, [])

  return {
    suggestions,
    loading,
    error,
    fetchSuggestions,
    updateSuggestion,
    clearSuggestions,
  }
}

/**
 * Hook for managing suggestions with persistence to localStorage
 *
 * This version saves suggestions to localStorage and loads them on mount.
 * Useful for maintaining suggestion history across sessions.
 */
export function usePersistentSuggestions(storageKey = "kanari-suggestions"): UseSuggestionsResult {
  const [suggestions, setSuggestions] = useState<Suggestion[]>(() => {
    // Load from localStorage on mount
    if (typeof window === "undefined") return []

    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        return Array.isArray(parsed) ? parsed : []
      }
    } catch (err) {
      console.error("Failed to load suggestions from localStorage:", err)
    }

    return []
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Save suggestions to localStorage whenever they change
   */
  const saveSuggestions = useCallback(
    (newSuggestions: Suggestion[]) => {
      setSuggestions(newSuggestions)

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(storageKey, JSON.stringify(newSuggestions))
        } catch (err) {
          console.error("Failed to save suggestions to localStorage:", err)
        }
      }
    },
    [storageKey]
  )

  /**
   * Fetch new suggestions and append to existing ones
   */
  const fetchSuggestions = useCallback(
    async (metrics: VoiceMetrics, trend: TrendDirection) => {
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

        // Append new suggestions to existing ones
        saveSuggestions([...suggestions, ...data.suggestions])
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch suggestions"
        setError(errorMessage)
        console.error("Error fetching suggestions:", err)
      } finally {
        setLoading(false)
      }
    },
    [suggestions, saveSuggestions]
  )

  /**
   * Update suggestion status and persist
   */
  const updateSuggestion = useCallback(
    (id: string, status: Suggestion["status"]) => {
      const updated = suggestions.map((suggestion) =>
        suggestion.id === id ? { ...suggestion, status } : suggestion
      )
      saveSuggestions(updated)
    },
    [suggestions, saveSuggestions]
  )

  /**
   * Clear all suggestions from state and localStorage
   */
  const clearSuggestions = useCallback(() => {
    saveSuggestions([])
    setError(null)
  }, [saveSuggestions])

  return {
    suggestions,
    loading,
    error,
    fetchSuggestions,
    updateSuggestion,
    clearSuggestions,
  }
}
