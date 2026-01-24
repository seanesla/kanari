"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Temporal } from "temporal-polyfill"
import { logError } from "@/lib/logger"
import type {
  Suggestion,
  VoiceMetrics,
  TrendDirection,
  SuggestionStatus,
  CheckInSession,
  AudioFeatures,
  VoicePatterns,
  HistoricalContext,
  BurnoutPrediction,
  GeminiDiffSuggestion,
  SuggestionDecision,
  EffectivenessFeedback,
} from "@/lib/types"
import { useAllSuggestions, useSuggestionActions } from "./use-storage"
import { useSuggestionMemory } from "./use-suggestion-memory"
import { predictBurnoutRisk, sessionsToTrendData } from "@/lib/ml/forecasting"
import { createGeminiHeaders } from "@/lib/utils"
import { useTimeZone } from "@/lib/timezone-context"
import {
  computeExpiredSuggestionIds,
  LAST_SUGGESTION_AUTOGEN_DATE_KEY,
  LAST_SUGGESTION_ROLLOVER_DATE_KEY,
  normalizeSuggestionKey,
  toLocalDateISO,
} from "@/lib/suggestions/rollover"

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
 * await regenerateWithDiff(metrics, trend, sessions)
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
  regenerateWithDiff: (metrics: VoiceMetrics, trend: TrendDirection, sessions?: CheckInSession[]) => Promise<void>
  updateSuggestion: (id: string, status: SuggestionStatus) => Promise<boolean>
  // Kanban-specific actions
  moveSuggestion: (id: string, newStatus: SuggestionStatus, scheduledFor?: string) => Promise<boolean>
  scheduleSuggestion: (id: string, scheduledFor: string) => Promise<boolean>
  dismissSuggestion: (id: string) => Promise<boolean>
  /**
   * Mark a suggestion as completed with optional effectiveness feedback.
   * @param id - The suggestion ID to complete
   * @param feedback - Optional effectiveness feedback from the user (very_helpful, somewhat_helpful, not_helpful, skipped)
   */
  completeSuggestion: (id: string, feedback?: EffectivenessFeedback) => Promise<boolean>
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
 * Compute historical context from check-in sessions
 */
export function computeHistoricalContext(sessions: CheckInSession[]): HistoricalContext {
  const validSessions = sessions.filter(s => s.acousticMetrics)

  if (validSessions.length === 0) {
    return { recordingCount: 0, daysOfData: 0, averageStress: 0, averageFatigue: 0, stressChange: "stable", fatigueChange: "stable" }
  }

  const avgStress = validSessions.reduce((sum, s) => sum + (s.acousticMetrics?.stressScore || 0), 0) / validSessions.length
  const avgFatigue = validSessions.reduce((sum, s) => sum + (s.acousticMetrics?.fatigueScore || 0), 0) / validSessions.length

  // Calculate unique days
  const uniqueDays = new Set(validSessions.map(s => s.startedAt.split("T")[0]))

  // Calculate change from baseline (compare latest to average)
  const latest = validSessions[0]?.acousticMetrics
  const stressDiff = latest ? latest.stressScore - avgStress : 0
  const fatigueDiff = latest ? latest.fatigueScore - avgFatigue : 0

  const formatChange = (diff: number) => {
    if (Math.abs(diff) < 5) return "stable"
    const sign = diff > 0 ? "+" : ""
    return `${sign}${Math.round(diff)}% from baseline`
  }

  return {
    recordingCount: validSessions.length,
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
  const { getActiveSuggestions, buildMemoryContext } = useSuggestionMemory()
  const { timeZone } = useTimeZone()
  const {
    addSuggestion,
    updateSuggestion: updateSuggestionInDB,
    deleteSuggestion,
  } = useSuggestionActions()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [lastDiffSummary, setLastDiffSummary] = useState<DiffSummary | null>(null)

  // Drive day-boundary checks even if the app stays open.
  const [dayTick, setDayTick] = useState(0)

  const rolloverInFlightRef = useRef(false)
  const autogenInFlightRef = useRef(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!timeZone) return

    let cancelled = false
    let timeoutId: number | null = null

    const scheduleNextTick = () => {
      if (cancelled) return

      let delayMs = 60_000

      try {
        const now = Temporal.Now.zonedDateTimeISO(timeZone)
        const nextMidnight = now.toPlainDate().add({ days: 1 }).toZonedDateTime({
          timeZone,
          plainTime: Temporal.PlainTime.from("00:00"),
        })
        delayMs = Math.max(0, nextMidnight.epochMilliseconds - now.epochMilliseconds) + 500
      } catch {
        // If timezone math fails, fall back to a cheap periodic tick.
        delayMs = 60_000
      }

      timeoutId = window.setTimeout(() => {
        setDayTick((t) => t + 1)
        scheduleNextTick()
      }, delayMs)
    }

    scheduleNextTick()

    return () => {
      cancelled = true
      if (timeoutId !== null) window.clearTimeout(timeoutId)
    }
  }, [timeZone])

  const clearUpdateError = useCallback(() => setUpdateError(null), [])
  const clearDiffSummary = useCallback(() => setLastDiffSummary(null), [])

  /**
   * Regenerate suggestions using diff-aware mode.
   * Gemini reviews existing suggestions and decides: keep, update, drop, or add new.
   */
  const regenerateWithDiff = useCallback(async (
    metrics: VoiceMetrics,
    trend: TrendDirection,
    sessions?: CheckInSession[]
  ) => {
    setLoading(true)
    setError(null)
    setLastDiffSummary(null)

    try {
      // Build enriched context if historical data provided
      let voicePatterns: VoicePatterns | undefined
      let history: HistoricalContext | undefined
      let burnoutPrediction: BurnoutPrediction | undefined

      if (sessions && sessions.length > 0) {
        // Get the latest session
        const sortedSessions = [...sessions].sort(
          (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
        )
        const latestSession = sortedSessions[0]

        // Extract voice patterns from latest session
        voicePatterns = featuresToVoicePatterns(latestSession?.acousticMetrics?.features)

        // Compute historical context
        history = computeHistoricalContext(sortedSessions)

        // Predict burnout risk if we have enough data
        if (sessions.length >= 2) {
          const trendData = sessionsToTrendData(sessions)
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

      const existingKeys = new Set(
        activeSuggestions.map((s) => normalizeSuggestionKey({
          content: s.content,
          category: s.category,
          duration: s.duration,
        }))
      )

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
            {
              const incomingKey = normalizeSuggestionKey({
                content: diffSuggestion.content,
                category: diffSuggestion.category,
                duration: diffSuggestion.duration,
              })

              // Defensive dedupe: Gemini can occasionally emit duplicates across a single run.
              if (existingKeys.has(incomingKey)) break

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
              existingKeys.add(incomingKey)
              break
            }
        }
      }

      // Store diff summary for UI display
      setLastDiffSummary(data.summary)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to regenerate suggestions"
      setError(errorMessage)
      logError("Suggestions", "Error regenerating suggestions:", err)
    } finally {
      setLoading(false)
    }
  }, [getActiveSuggestions, buildMemoryContext, updateSuggestionInDB, deleteSuggestion, addSuggestion])

  // Daily rollover:
  // 1) Remove uncompleted suggestions from previous days (prevents duplicated "daily" tasks).
  // 2) Auto-generate a fresh set once per day (when possible) based on the latest check-in metrics.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (typeof indexedDB === "undefined") return
    if (!timeZone) return

    const nowISO = new Date().toISOString()
    const { todayISO, expiredSuggestionIds } = computeExpiredSuggestionIds({
      suggestions: allSuggestions,
      timeZone,
      nowISO,
    })

    const lastRollover = window.localStorage.getItem(LAST_SUGGESTION_ROLLOVER_DATE_KEY)
    if (lastRollover === todayISO) return
    if (rolloverInFlightRef.current) return
    rolloverInFlightRef.current = true

    ;(async () => {
      if (expiredSuggestionIds.length > 0) {
        try {
          const { db } = await import("@/lib/storage/db")
          await db.transaction("rw", db.suggestions, db.recoveryBlocks, async () => {
            await db.suggestions.bulkDelete(expiredSuggestionIds)
            await db.recoveryBlocks.where("suggestionId").anyOf(expiredSuggestionIds).delete()
          })
        } catch (err) {
          logError("Suggestions", "Error rolling over daily suggestions:", err)
        }
      }

      window.localStorage.setItem(LAST_SUGGESTION_ROLLOVER_DATE_KEY, todayISO)
    })().finally(() => {
      rolloverInFlightRef.current = false
    })
  }, [allSuggestions, dayTick, timeZone])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (typeof indexedDB === "undefined") return
    if (!timeZone) return
    if (loading) return
    if (autogenInFlightRef.current) return

    const nowISO = new Date().toISOString()
    const { todayISO } = computeExpiredSuggestionIds({
      suggestions: [],
      timeZone,
      nowISO,
    })

    const lastAutogen = window.localStorage.getItem(LAST_SUGGESTION_AUTOGEN_DATE_KEY)
    if (lastAutogen === todayISO) return

    // Generate once per day only when there are no pending suggestions created today.
    const hasPendingToday = allSuggestions.some((s) => {
      if (s.status !== "pending") return false
      return toLocalDateISO(s.createdAt, timeZone) === todayISO
    })

    if (hasPendingToday) {
      window.localStorage.setItem(LAST_SUGGESTION_AUTOGEN_DATE_KEY, todayISO)
      return
    }

    autogenInFlightRef.current = true
    ;(async () => {
      try {
        const { db, toCheckInSession } = await import("@/lib/storage/db")
        const sessionsRaw = await db.checkInSessions.orderBy("startedAt").reverse().limit(30).toArray()
        const sessions = sessionsRaw.map(toCheckInSession)

        const latest = sessions.find((s) => s.acousticMetrics)
        if (!latest?.acousticMetrics) return

        const metrics: VoiceMetrics = {
          stressScore: latest.acousticMetrics.stressScore,
          stressLevel: latest.acousticMetrics.stressLevel,
          fatigueScore: latest.acousticMetrics.fatigueScore,
          fatigueLevel: latest.acousticMetrics.fatigueLevel,
          confidence: latest.acousticMetrics.confidence,
          analyzedAt: latest.acousticMetrics.analyzedAt ?? nowISO,
        }

        const trend: TrendDirection = sessions.length >= 2
          ? predictBurnoutRisk(sessionsToTrendData(sessions)).trend
          : "stable"

        await regenerateWithDiff(metrics, trend, sessions)
      } catch (err) {
        logError("Suggestions", "Error auto-generating daily suggestions:", err)
      } finally {
        window.localStorage.setItem(LAST_SUGGESTION_AUTOGEN_DATE_KEY, todayISO)
      }
    })().finally(() => {
      autogenInFlightRef.current = false
    })
  }, [allSuggestions, dayTick, loading, regenerateWithDiff, timeZone])

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
      logError("Suggestions", "Error updating suggestion:", err)
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
      logError("Suggestions", "Error moving suggestion:", err)
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
      logError("Suggestions", "Error scheduling suggestion:", err)
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
      logError("Suggestions", "Error dismissing suggestion:", err)
      return false
    }
  }, [updateSuggestionInDB])

  /**
   * Mark a scheduled suggestion as completed with optional effectiveness feedback.
   *
   * When user completes a suggestion, they can optionally provide feedback on
   * whether the suggestion was helpful (very_helpful, somewhat_helpful, not_helpful, skipped).
   * This feedback is stored with the suggestion for analytics and to improve future recommendations.
   *
   * @param id - The suggestion ID to complete
   * @param feedback - Optional effectiveness feedback from the user
   * @returns true on success, false on failure
   */
  const completeSuggestion = useCallback(async (id: string, feedback?: EffectivenessFeedback): Promise<boolean> => {
    try {
      setUpdateError(null)
      const now = new Date().toISOString()

      // Build update object with completion data and optional feedback
      const updates: Partial<Suggestion> = {
        status: "completed",
        completedAt: now,
        lastUpdatedAt: now,
      }

      // Add effectiveness feedback if provided
      if (feedback) {
        updates.effectiveness = feedback
      }

      await updateSuggestionInDB(id, updates)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to complete suggestion"
      setUpdateError(errorMessage)
      logError("Suggestions", "Error completing suggestion:", err)
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
