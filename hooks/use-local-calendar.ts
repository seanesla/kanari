"use client"

/**
 * Local calendar hook
 *
 * Manages scheduling of suggestions to a local calendar (stored in IndexedDB).
 * Events are displayed in the FullCalendar component.
 */

import { useState, useCallback } from "react"
import { Temporal } from "temporal-polyfill"
import type { Suggestion, RecoveryBlock } from "@/lib/types"
import { logDebug, logError } from "@/lib/logger"

export interface LocalCalendarEventOptions {
  timeZone?: string
}

export interface UseLocalCalendarReturn {
  // Local calendar is always "connected"
  isConnected: true
  isLoading: boolean
  error: string | null

  // Actions
  scheduleEvent: (suggestion: Suggestion, options?: LocalCalendarEventOptions) => Promise<RecoveryBlock | null>
  deleteEvent: (eventId: string) => Promise<void>
  clearError: () => void
}

/**
 * Generate a unique recovery block ID
 */
function generateRecoveryBlockId(): string {
  return `rb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function useLocalCalendar(): UseLocalCalendarReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Schedule a suggestion to the local calendar
   * Creates a RecoveryBlock that can be persisted to IndexedDB
   */
  const scheduleEvent = useCallback(
    async (suggestion: Suggestion, options?: LocalCalendarEventOptions): Promise<RecoveryBlock | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const timeZone = options?.timeZone || Temporal.Now.timeZoneId()

        // Ensure the suggestion has a scheduledFor time
        if (!suggestion.scheduledFor) {
          throw new Error("Suggestion must have a scheduledFor time")
        }

        logDebug("useLocalCalendar", "Scheduling event locally", {
          suggestionId: suggestion.id,
          scheduledFor: suggestion.scheduledFor,
          timeZone,
        })

        // Create a local recovery block
        const recoveryBlock: RecoveryBlock = {
          id: generateRecoveryBlockId(),
          suggestionId: suggestion.id,
          calendarEventId: `local_${suggestion.id}`, // Local marker
          scheduledAt: suggestion.scheduledFor,
          duration: suggestion.duration,
          completed: false,
        }

        logDebug("useLocalCalendar", "Created local recovery block", recoveryBlock)

        return recoveryBlock
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to schedule event"
        logError("useLocalCalendar", "Failed to schedule event", err)
        setError(errorMessage)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  /**
   * Delete a local calendar event
   * Since events are local, this is just a no-op placeholder
   * The actual deletion happens when the suggestion is dismissed/deleted
   */
  const deleteEvent = useCallback(
    async (eventId: string) => {
      setIsLoading(true)
      setError(null)

      try {
        logDebug("useLocalCalendar", "Delete event requested", { eventId })
        // No-op for local calendar - the suggestion deletion handles cleanup
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to delete event"
        logError("useLocalCalendar", "Failed to delete event", err)
        setError(errorMessage)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    isConnected: true, // Local calendar is always available
    isLoading,
    error,
    scheduleEvent,
    deleteEvent,
    clearError,
  }
}
