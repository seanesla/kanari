/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useSuggestionWorkflow } from "../use-suggestion-workflow"
import type { Suggestion } from "@/lib/types"

// Mock suggestion data
const mockSuggestion: Suggestion = {
  id: "test-1",
  content: "Take a 10-minute break",
  category: "break",
  priority: "high",
  duration: 10,
  status: "pending",
  createdAt: "2024-12-24T10:00:00Z",
  reasoning: "Based on stress indicators",
}

const mockScheduledSuggestion: Suggestion = {
  ...mockSuggestion,
  id: "test-2",
  status: "scheduled",
  scheduledFor: "2024-12-24T15:00:00Z",
}

describe("useSuggestionWorkflow", () => {
  const defaultParams = {
    suggestions: [mockSuggestion, mockScheduledSuggestion],
    scheduleSuggestion: vi.fn().mockResolvedValue(true),
    dismissSuggestion: vi.fn().mockResolvedValue(true),
    completeSuggestion: vi.fn().mockResolvedValue(true),
  }

  it("initializes with null dialog states", () => {
    const { result } = renderHook(() => useSuggestionWorkflow(defaultParams))

    expect(result.current.selectedSuggestion).toBeNull()
    expect(result.current.scheduleDialogSuggestion).toBeNull()
    expect(result.current.droppedSuggestion).toBeNull()
    expect(result.current.pendingDragActive).toBe(false)
  })

  describe("dialog state management", () => {
    it("opens detail dialog on suggestion click", () => {
      const { result } = renderHook(() => useSuggestionWorkflow(defaultParams))

      act(() => {
        result.current.handlers.handleSuggestionClick(mockSuggestion)
      })

      expect(result.current.selectedSuggestion).toEqual(mockSuggestion)
    })

    it("transitions from detail to schedule dialog", () => {
      const { result } = renderHook(() => useSuggestionWorkflow(defaultParams))

      // First open detail dialog
      act(() => {
        result.current.handlers.handleSuggestionClick(mockSuggestion)
      })

      // Then click schedule from dialog
      act(() => {
        result.current.handlers.handleScheduleFromDialog(mockSuggestion)
      })

      expect(result.current.selectedSuggestion).toBeNull()
      expect(result.current.scheduleDialogSuggestion).toEqual(mockSuggestion)
    })

    it("closes all dialogs with closeDialogs", () => {
      const { result } = renderHook(() => useSuggestionWorkflow(defaultParams))

      act(() => {
        result.current.handlers.handleSuggestionClick(mockSuggestion)
      })

      act(() => {
        result.current.handlers.closeDialogs()
      })

      expect(result.current.selectedSuggestion).toBeNull()
      expect(result.current.scheduleDialogSuggestion).toBeNull()
      expect(result.current.droppedSuggestion).toBeNull()
    })
  })

  describe("drag-drop state", () => {
    it("tracks drag start/end", () => {
      const { result } = renderHook(() => useSuggestionWorkflow(defaultParams))

      expect(result.current.pendingDragActive).toBe(false)

      act(() => {
        result.current.handlers.handleDragStart()
      })
      expect(result.current.pendingDragActive).toBe(true)

      act(() => {
        result.current.handlers.handleDragEnd()
      })
      expect(result.current.pendingDragActive).toBe(false)
    })

    it("handles external drop with suggestion lookup", () => {
      const { result } = renderHook(() => useSuggestionWorkflow(defaultParams))

      const dropDateISO = "2024-12-24"

      act(() => {
        result.current.handlers.handleExternalDrop("test-1", dropDateISO, 14, 30)
      })

      expect(result.current.droppedSuggestion).toEqual({
        suggestion: mockSuggestion,
        dateISO: dropDateISO,
        hour: 14,
        minute: 30,
      })
      expect(result.current.scheduleDialogSuggestion).toEqual(mockSuggestion)
    })

    it("handles time slot click with pending suggestion", () => {
      const { result } = renderHook(() => useSuggestionWorkflow(defaultParams))

      const clickDateISO = "2024-12-24"

      act(() => {
        result.current.handlers.handleTimeSlotClick(clickDateISO, 10, 0)
      })

      // Should find the first pending suggestion
      expect(result.current.droppedSuggestion?.suggestion).toEqual(mockSuggestion)
      expect(result.current.droppedSuggestion?.hour).toBe(10)
      expect(result.current.droppedSuggestion?.minute).toBe(0)
    })
  })

  describe("action handlers", () => {
    it("calls scheduleSuggestion and closes dialog on confirm", async () => {
      const scheduleSuggestion = vi.fn().mockResolvedValue(true)
      const { result } = renderHook(() =>
        useSuggestionWorkflow({ ...defaultParams, scheduleSuggestion })
      )

      // Open schedule dialog first
      act(() => {
        result.current.handlers.handleScheduleFromDialog(mockSuggestion)
      })

      await act(async () => {
        const success = await result.current.handlers.handleScheduleConfirm(
          mockSuggestion,
          "2024-12-24T15:00:00Z"
        )
        expect(success).toBe(true)
      })

      expect(scheduleSuggestion).toHaveBeenCalledWith("test-1", "2024-12-24T15:00:00Z")
      expect(result.current.scheduleDialogSuggestion).toBeNull()
    })

    it("calls dismissSuggestion and closes dialog", async () => {
      const dismissSuggestion = vi.fn().mockResolvedValue(true)
      const { result } = renderHook(() =>
        useSuggestionWorkflow({ ...defaultParams, dismissSuggestion })
      )

      // Open detail dialog
      act(() => {
        result.current.handlers.handleSuggestionClick(mockSuggestion)
      })

      await act(async () => {
        const success = await result.current.handlers.handleDismiss(mockSuggestion)
        expect(success).toBe(true)
      })

      expect(dismissSuggestion).toHaveBeenCalledWith("test-1")
      expect(result.current.selectedSuggestion).toBeNull()
    })

    it("calls completeSuggestion and closes dialog", async () => {
      const completeSuggestion = vi.fn().mockResolvedValue(true)
      const { result } = renderHook(() =>
        useSuggestionWorkflow({ ...defaultParams, completeSuggestion })
      )

      // Open detail dialog
      act(() => {
        result.current.handlers.handleSuggestionClick(mockScheduledSuggestion)
      })

      await act(async () => {
        const success = await result.current.handlers.handleComplete(mockScheduledSuggestion)
        expect(success).toBe(true)
      })

      expect(completeSuggestion).toHaveBeenCalledWith("test-2")
      expect(result.current.selectedSuggestion).toBeNull()
    })
  })

  describe("handlers memoization", () => {
    it("returns stable handlers object across re-renders", () => {
      const { result, rerender } = renderHook(() => useSuggestionWorkflow(defaultParams))

      const initialHandlers = result.current.handlers

      rerender()

      expect(result.current.handlers).toBe(initialHandlers)
    })

    it("returns new handlers when dependencies change", () => {
      const { result, rerender } = renderHook(
        ({ suggestions }) => useSuggestionWorkflow({ ...defaultParams, suggestions }),
        { initialProps: { suggestions: [mockSuggestion] } }
      )

      const initialHandlers = result.current.handlers

      // Rerender with new suggestions array
      rerender({ suggestions: [mockSuggestion, mockScheduledSuggestion] })

      // handleExternalDrop depends on suggestions, so handlers should update
      expect(result.current.handlers).not.toBe(initialHandlers)
    })
  })
})
