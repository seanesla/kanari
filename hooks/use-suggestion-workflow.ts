"use client"

import { useState, useCallback, useMemo } from "react"
import type { Suggestion, RecoveryBlock, EffectivenessFeedback } from "@/lib/types"
import type { LocalCalendarEventOptions } from "@/hooks/use-local-calendar"

/**
 * Dropped suggestion info when dragging to calendar
 */
export interface DroppedSuggestionInfo {
  suggestion: Suggestion
  /** YYYY-MM-DD in the app's selected timezone */
  dateISO: string
  hour: number
  minute: number
}

/**
 * Workflow state for suggestion dialogs and drag-drop
 */
export interface SuggestionWorkflowState {
  selectedSuggestion: Suggestion | null
  scheduleDialogSuggestion: Suggestion | null
  pendingDragActive: boolean
  droppedSuggestion: DroppedSuggestionInfo | null
}

/**
 * Handlers for suggestion workflow interactions
 */
export interface SuggestionWorkflowHandlers {
  handleSuggestionClick: (suggestion: Suggestion) => void
  handleScheduleFromDialog: (suggestion: Suggestion) => void
  handleExternalDrop: (suggestionId: string, dateISO: string, hour: number, minute: number) => void
  handleTimeSlotClick: (dateISO: string, hour: number, minute: number) => void
  handleScheduleConfirm: (suggestion: Suggestion, scheduledFor: string) => Promise<boolean>
  handleDismiss: (suggestion: Suggestion) => Promise<boolean>
  /**
   * Complete a suggestion without feedback (legacy flow).
   * For the full flow with feedback dialog, use the suggestion detail dialog's built-in feedback integration.
   */
  handleComplete: (suggestion: Suggestion) => Promise<boolean>
  /**
   * Complete a suggestion with effectiveness feedback.
   * Called after user provides feedback (very_helpful, somewhat_helpful, not_helpful) or skips.
   * @param suggestion - The suggestion being completed
   * @param feedback - The effectiveness feedback from the user
   */
  handleCompleteWithFeedback: (suggestion: Suggestion, feedback: EffectivenessFeedback) => Promise<boolean>
  handleEventClick: (suggestion: Suggestion) => void
  handleDragStart: () => void
  handleDragEnd: () => void
  closeDialogs: () => void
}

interface UseSuggestionWorkflowParams {
  suggestions: Suggestion[]
  scheduleSuggestion: (id: string, scheduledFor: string) => Promise<boolean>
  dismissSuggestion: (id: string) => Promise<boolean>
  /** Complete a suggestion with optional effectiveness feedback */
  completeSuggestion: (id: string, feedback?: EffectivenessFeedback) => Promise<boolean>
  scheduleGoogleEvent?: (suggestion: Suggestion, options?: LocalCalendarEventOptions) => Promise<RecoveryBlock | null>
  isCalendarConnected?: boolean
}

/**
 * Hook for managing suggestion workflow state and interactions
 *
 * Encapsulates:
 * - Dialog state (detail dialog, schedule dialog)
 * - Drag-drop state for calendar integration
 * - All interaction handlers (click, schedule, dismiss, complete, drag)
 */
export function useSuggestionWorkflow({
  suggestions,
  scheduleSuggestion,
  dismissSuggestion,
  completeSuggestion,
  scheduleGoogleEvent,
  isCalendarConnected,
}: UseSuggestionWorkflowParams): SuggestionWorkflowState & { handlers: SuggestionWorkflowHandlers } {
  // Dialog state
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null)
  const [scheduleDialogSuggestion, setScheduleDialogSuggestion] = useState<Suggestion | null>(null)

  // Drag-drop state
  const [pendingDragActive, setPendingDragActive] = useState(false)
  const [droppedSuggestion, setDroppedSuggestion] = useState<DroppedSuggestionInfo | null>(null)

  // Open detail dialog for a suggestion
  const handleSuggestionClick = useCallback((suggestion: Suggestion) => {
    setSelectedSuggestion(suggestion)
  }, [])

  // Transition from detail dialog to schedule dialog
  const handleScheduleFromDialog = useCallback((suggestion: Suggestion) => {
    setSelectedSuggestion(null)
    setScheduleDialogSuggestion(suggestion)
  }, [])

  // Handle drop from sidebar to calendar time slot
  const handleExternalDrop = useCallback((suggestionId: string, dateISO: string, hour: number, minute: number) => {
    const suggestion = suggestions.find(s => s.id === suggestionId)
    if (!suggestion) return

    setDroppedSuggestion({ suggestion, dateISO, hour, minute })
    setScheduleDialogSuggestion(suggestion)
  }, [suggestions])

  // Handle clicking an empty time slot on calendar
  const handleTimeSlotClick = useCallback((dateISO: string, hour: number, minute: number) => {
    const pendingSuggestion = suggestions.find(s => s.status === "pending")
    if (pendingSuggestion) {
      setDroppedSuggestion({ suggestion: pendingSuggestion, dateISO, hour, minute })
      setScheduleDialogSuggestion(pendingSuggestion)
    }
  }, [suggestions])

  // Confirm scheduling and optionally sync to Google Calendar
  const handleScheduleConfirm = useCallback(async (suggestion: Suggestion, scheduledFor: string) => {
    const success = await scheduleSuggestion(suggestion.id, scheduledFor)
    if (success) {
      setScheduleDialogSuggestion(null)
      setDroppedSuggestion(null)

      // Optionally sync to Google Calendar
      if (isCalendarConnected && scheduleGoogleEvent) {
        const updatedSuggestion = { ...suggestion, status: "scheduled" as const, scheduledFor }
        await scheduleGoogleEvent(updatedSuggestion)
      }
    }
    return success
  }, [scheduleSuggestion, isCalendarConnected, scheduleGoogleEvent])

  // Dismiss suggestion from detail dialog
  const handleDismiss = useCallback(async (suggestion: Suggestion): Promise<boolean> => {
    const success = await dismissSuggestion(suggestion.id)
    if (success) {
      setSelectedSuggestion(null)
    }
    return success
  }, [dismissSuggestion])

  // Complete suggestion from detail dialog (legacy - no feedback)
  const handleComplete = useCallback(async (suggestion: Suggestion): Promise<boolean> => {
    const success = await completeSuggestion(suggestion.id)
    if (success) {
      setSelectedSuggestion(null)
    }
    return success
  }, [completeSuggestion])

  /**
   * Complete suggestion with effectiveness feedback.
   * This is the preferred flow - called after user rates how helpful the suggestion was.
   *
   * @param suggestion - The suggestion being completed
   * @param feedback - User's effectiveness feedback (very_helpful, somewhat_helpful, not_helpful, skipped)
   */
  const handleCompleteWithFeedback = useCallback(async (
    suggestion: Suggestion,
    feedback: EffectivenessFeedback
  ): Promise<boolean> => {
    const success = await completeSuggestion(suggestion.id, feedback)
    if (success) {
      setSelectedSuggestion(null)
    }
    return success
  }, [completeSuggestion])

  // Handle clicking a calendar event
  const handleEventClick = useCallback((suggestion: Suggestion) => {
    setSelectedSuggestion(suggestion)
  }, [])

  // Drag state handlers
  const handleDragStart = useCallback(() => setPendingDragActive(true), [])
  const handleDragEnd = useCallback(() => setPendingDragActive(false), [])

  // Close all dialogs and reset state
  const closeDialogs = useCallback(() => {
    setSelectedSuggestion(null)
    setScheduleDialogSuggestion(null)
    setDroppedSuggestion(null)
  }, [])

  // Memoize handlers object to prevent unnecessary re-renders in consumers
  const handlers = useMemo<SuggestionWorkflowHandlers>(() => ({
    handleSuggestionClick,
    handleScheduleFromDialog,
    handleExternalDrop,
    handleTimeSlotClick,
    handleScheduleConfirm,
    handleDismiss,
    handleComplete,
    handleCompleteWithFeedback,
    handleEventClick,
    handleDragStart,
    handleDragEnd,
    closeDialogs,
  }), [
    handleSuggestionClick,
    handleScheduleFromDialog,
    handleExternalDrop,
    handleTimeSlotClick,
    handleScheduleConfirm,
    handleDismiss,
    handleComplete,
    handleCompleteWithFeedback,
    handleEventClick,
    handleDragStart,
    handleDragEnd,
    closeDialogs,
  ])

  return {
    selectedSuggestion,
    scheduleDialogSuggestion,
    pendingDragActive,
    droppedSuggestion,
    handlers,
  }
}
