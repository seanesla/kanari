"use client"

import { useState, useCallback } from "react"
import type { Suggestion, RecoveryBlock, UserSettings } from "@/lib/types"

/**
 * Dropped suggestion info when dragging to calendar
 */
export interface DroppedSuggestionInfo {
  suggestion: Suggestion
  date: Date
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
  handleExternalDrop: (suggestionId: string, date: Date, hour: number, minute: number) => void
  handleTimeSlotClick: (date: Date, hour: number) => void
  handleScheduleConfirm: (suggestion: Suggestion, scheduledFor: string) => Promise<boolean>
  handleDismiss: (suggestion: Suggestion) => Promise<boolean>
  handleComplete: (suggestion: Suggestion) => Promise<boolean>
  handleEventClick: (suggestion: Suggestion) => void
  handleDragStart: () => void
  handleDragEnd: () => void
  closeDialogs: () => void
}

interface UseSuggestionWorkflowParams {
  suggestions: Suggestion[]
  scheduleSuggestion: (id: string, scheduledFor: string) => Promise<boolean>
  dismissSuggestion: (id: string) => Promise<boolean>
  completeSuggestion: (id: string) => Promise<boolean>
  scheduleGoogleEvent?: (suggestion: Suggestion, settings?: UserSettings) => Promise<RecoveryBlock | null>
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
  const handleExternalDrop = useCallback((suggestionId: string, date: Date, hour: number, minute: number) => {
    const suggestion = suggestions.find(s => s.id === suggestionId)
    if (!suggestion) return

    setDroppedSuggestion({ suggestion, date, hour, minute })
    setScheduleDialogSuggestion(suggestion)
  }, [suggestions])

  // Handle clicking an empty time slot on calendar
  const handleTimeSlotClick = useCallback((date: Date, hour: number) => {
    const pendingSuggestion = suggestions.find(s => s.status === "pending")
    if (pendingSuggestion) {
      setDroppedSuggestion({ suggestion: pendingSuggestion, date, hour, minute: 0 })
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

  // Complete suggestion from detail dialog
  const handleComplete = useCallback(async (suggestion: Suggestion): Promise<boolean> => {
    const success = await completeSuggestion(suggestion.id)
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

  return {
    // State
    selectedSuggestion,
    scheduleDialogSuggestion,
    pendingDragActive,
    droppedSuggestion,
    // Handlers
    handlers: {
      handleSuggestionClick,
      handleScheduleFromDialog,
      handleExternalDrop,
      handleTimeSlotClick,
      handleScheduleConfirm,
      handleDismiss,
      handleComplete,
      handleEventClick,
      handleDragStart,
      handleDragEnd,
      closeDialogs,
    },
  }
}
