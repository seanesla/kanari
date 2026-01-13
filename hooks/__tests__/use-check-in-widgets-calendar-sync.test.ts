// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { Temporal } from "temporal-polyfill"

let useCheckIn: typeof import("../use-check-in").useCheckIn

type GeminiWidgetEvent =
  | { widget: "breathing_exercise"; args: { type: string; duration: number } }
  | { widget: "journal_prompt"; args: { prompt: string; placeholder?: string; category?: string } }
  | { widget: "stress_gauge"; args: { stressLevel: number; fatigueLevel: number; message?: string } }
  | { widget: "quick_actions"; args: { actions: { label: string; action: string }[] } }
  | {
      widget: "schedule_activity"
      args: {
        title: string
        category: "break" | "exercise" | "mindfulness" | "social" | "rest"
        date: string
        time: string
        duration: number
      }
    }

type GeminiLiveCallbacks = {
  onWidget?: (event: GeminiWidgetEvent) => void
  onModelTranscript?: (text: string, finished: boolean) => void
}

let geminiCallbacks: GeminiLiveCallbacks | null = null
let scheduleEventMock: ReturnType<typeof vi.fn>
let addSuggestionMock: ReturnType<typeof vi.fn>
let putRecoveryBlockMock: ReturnType<typeof vi.fn>

beforeEach(async () => {
  geminiCallbacks = null
  scheduleEventMock = vi.fn(async (suggestion: { id: string; scheduledFor?: string; duration: number }) => ({
    id: "rb_test",
    suggestionId: suggestion.id,
    calendarEventId: "evt_test",
    scheduledAt: suggestion.scheduledFor ?? new Date().toISOString(),
    duration: suggestion.duration,
    completed: false,
  }))
  addSuggestionMock = vi.fn(async () => {})
  putRecoveryBlockMock = vi.fn(async () => {})

  // Allow the widget persistence path to run (we mock Dexie itself below).
  Object.defineProperty(globalThis, "indexedDB", {
    value: {},
    configurable: true,
    writable: true,
  })

  vi.resetModules()
  vi.unmock("@/hooks/use-gemini-live")

  vi.doMock("@/lib/timezone-context", () => ({
    useTimeZone: () => ({ timeZone: "UTC" }),
  }))

  vi.doMock("@/hooks/use-gemini-live", () => ({
    useGeminiLive: (options: GeminiLiveCallbacks) => {
      geminiCallbacks = options
      return [
        {
          state: "ready",
          isReady: true,
          isModelSpeaking: false,
          isUserSpeaking: false,
          userTranscript: "",
          modelTranscript: "",
          error: null,
        },
        {
          connect: vi.fn(async () => {}),
          disconnect: vi.fn(),
          sendAudio: vi.fn(),
          sendText: vi.fn(),
          injectContext: vi.fn(),
          endAudioStream: vi.fn(),
          getClient: vi.fn(() => null),
          reattachToClient: vi.fn(),
        },
      ] as const
    },
  }))

  vi.doMock("@/hooks/use-local-calendar", () => ({
    useLocalCalendar: () => ({
      isConnected: true,
      isLoading: false,
      error: null,
      scheduleEvent: scheduleEventMock,
      deleteEvent: vi.fn(async () => {}),
      clearError: vi.fn(),
    }),
  }))

  vi.doMock("@/lib/storage/db", () => ({
    db: {
      suggestions: { add: addSuggestionMock, delete: vi.fn(async () => {}) },
      recoveryBlocks: {
        put: putRecoveryBlockMock,
        where: vi.fn(() => ({
          equals: vi.fn(() => ({
            toArray: vi.fn(async () => []),
          })),
        })),
        delete: vi.fn(async () => {}),
      },
      journalEntries: { add: vi.fn(async () => {}) },
      settings: { get: vi.fn(async () => ({ id: "default", calendarConnected: true })) },
    },
    fromSuggestion: (record: unknown) => record,
    fromRecoveryBlock: (record: unknown) => record,
    fromJournalEntry: (record: unknown) => record,
  }))

  ;({ useCheckIn } = await import("../use-check-in"))
})

afterEach(() => {
  // Restore IndexedDB absence for other tests that rely on it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).indexedDB
})

describe("useCheckIn schedule_activity calendar sync", () => {
  it("syncs AI-scheduled activities to local calendar", async () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onWidget?.({
        widget: "schedule_activity",
        args: {
          title: "Take a short walk",
          category: "exercise",
          date: "2025-01-01",
          time: "09:30",
          duration: 10,
        },
      })
    })

    expect(result.current[0].widgets[0]?.type).toBe("schedule_activity")
    expect(result.current[0].widgets[0]?.status).toBe("scheduled")

    await waitFor(() => {
      expect(scheduleEventMock).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(putRecoveryBlockMock).toHaveBeenCalledTimes(1)
    })
  })

  it("accepts tool args that include AM/PM (e.g., '10:00 PM')", async () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onWidget?.({
        widget: "schedule_activity",
        // Some model variants incorrectly emit non-24h time strings in tool args.
        // We should still schedule successfully and normalize the widget time.
        args: {
          title: "Appointment",
          category: "rest",
          date: "2025-01-01",
          time: "10:00 PM",
          duration: 30,
        },
      })
    })

    // Widget should be created immediately (optimistic).
    expect(result.current[0].widgets[0]?.type).toBe("schedule_activity")

    await waitFor(() => {
      expect(scheduleEventMock).toHaveBeenCalledTimes(1)
    })

    const scheduledSuggestion = scheduleEventMock.mock.calls[0]?.[0] as { scheduledFor?: string } | undefined
    expect(scheduledSuggestion?.scheduledFor).toBeTruthy()

    const scheduledAt = Temporal.Instant.from(scheduledSuggestion!.scheduledFor!).toZonedDateTimeISO("UTC")
    expect(scheduledAt.hour).toBe(22)
    expect(scheduledAt.minute).toBe(0)

    // Widget args should be normalized to HH:MM (24h) for consistent UI formatting.
    expect(result.current[0].widgets[0]?.type).toBe("schedule_activity")
    expect(result.current[0].widgets[0]?.args.time).toBe("22:00")
  })

  it("uses explicit user-provided time (e.g., 9:30PM) over tool args", async () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onModelTranscript?.("Hi", true) // Unblock user input ("AI speaks first")
      result.current[1].sendTextMessage("Schedule me an appointment at 9:30PM.")
    })

    act(() => {
      geminiCallbacks?.onWidget?.({
        widget: "schedule_activity",
        args: {
          title: "Appointment",
          category: "rest",
          date: "2025-01-01",
          time: "09:30", // Wrong: AM instead of PM
          duration: 30,
        },
      })
    })

    await waitFor(() => {
      expect(scheduleEventMock).toHaveBeenCalledTimes(1)
    })

    const scheduledSuggestion = scheduleEventMock.mock.calls[0]?.[0] as { scheduledFor?: string } | undefined
    expect(scheduledSuggestion?.scheduledFor).toBeTruthy()

    const scheduledAt = Temporal.Instant.from(scheduledSuggestion!.scheduledFor!).toZonedDateTimeISO("UTC")
    expect(scheduledAt.hour).toBe(21)
    expect(scheduledAt.minute).toBe(30)

    // UI widget args should also reflect the corrected time.
    expect(result.current[0].widgets[0]?.type).toBe("schedule_activity")
    expect(result.current[0].widgets[0]?.args.time).toBe("21:30")
  })

  it("does not round minutes when the user says a specific time", async () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onModelTranscript?.("Hi", true) // Unblock user input ("AI speaks first")
      result.current[1].sendTextMessage("Can you schedule a break for 9:30 pm?")
    })

    act(() => {
      geminiCallbacks?.onWidget?.({
        widget: "schedule_activity",
        args: {
          title: "Break",
          category: "break",
          date: "2025-01-01",
          time: "21:00", // Wrong: rounded down
          duration: 15,
        },
      })
    })

    await waitFor(() => {
      expect(scheduleEventMock).toHaveBeenCalledTimes(1)
    })

    const scheduledSuggestion = scheduleEventMock.mock.calls[0]?.[0] as { scheduledFor?: string } | undefined
    expect(scheduledSuggestion?.scheduledFor).toBeTruthy()

    const scheduledAt = Temporal.Instant.from(scheduledSuggestion!.scheduledFor!).toZonedDateTimeISO("UTC")
    expect(scheduledAt.hour).toBe(21)
    expect(scheduledAt.minute).toBe(30)
  })

  it("does not override ambiguous times without AM/PM", async () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onModelTranscript?.("Hi", true) // Unblock user input ("AI speaks first")
      result.current[1].sendTextMessage("Schedule a break at 9:30 tomorrow.")
    })

    act(() => {
      geminiCallbacks?.onWidget?.({
        widget: "schedule_activity",
        args: {
          title: "Break",
          category: "break",
          date: "2025-01-01",
          time: "21:30",
          duration: 15,
        },
      })
    })

    await waitFor(() => {
      expect(scheduleEventMock).toHaveBeenCalledTimes(1)
    })

    const scheduledSuggestion = scheduleEventMock.mock.calls[0]?.[0] as { scheduledFor?: string } | undefined
    expect(scheduledSuggestion?.scheduledFor).toBeTruthy()

    const scheduledAt = Temporal.Instant.from(scheduledSuggestion!.scheduledFor!).toZonedDateTimeISO("UTC")
    expect(scheduledAt.hour).toBe(21)
    expect(scheduledAt.minute).toBe(30)

    expect(result.current[0].widgets[0]?.type).toBe("schedule_activity")
    expect(result.current[0].widgets[0]?.args.time).toBe("21:30")
  })

  it("auto-schedules next check-in requests when user provides an explicit date/time", async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date("2026-01-09T21:54:16Z"))

      const { result } = renderHook(() => useCheckIn())

      act(() => {
        geminiCallbacks?.onModelTranscript?.("Hi", true) // Unblock user input ("AI speaks first")
        result.current[1].sendTextMessage("Schedule a check-in today at 10:00 PM.")
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500) // Wait past the fallback window (1200ms)
      })

      await act(async () => {
        // Flush the async persistence path.
        await Promise.resolve()
      })

      expect(scheduleEventMock).toHaveBeenCalledTimes(1)

      const scheduledSuggestion = scheduleEventMock.mock.calls[0]?.[0] as { scheduledFor?: string } | undefined
      expect(scheduledSuggestion?.scheduledFor).toBeTruthy()

      const scheduledAt = Temporal.Instant.from(scheduledSuggestion!.scheduledFor!).toZonedDateTimeISO("UTC")
      expect(scheduledAt.hour).toBe(22)
      expect(scheduledAt.minute).toBe(0)

      // Shows a confirmation widget and does NOT end the conversation.
      expect(result.current[0].widgets.some((w) => w.type === "schedule_activity" && w.status === "scheduled")).toBe(true)
      expect(result.current[0].messages.some((m) => m.role === "assistant" && /scheduled/i.test(m.content))).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it("auto-schedules explicit appointment requests when user provides an explicit date/time", async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date("2026-01-09T21:54:16Z"))

      const { result } = renderHook(() => useCheckIn())

      act(() => {
        geminiCallbacks?.onModelTranscript?.("Hi", true) // Unblock user input ("AI speaks first")
        result.current[1].sendTextMessage("Schedule an appointment today at 10:00 PM for 30 minutes.")
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500) // Wait past the fallback window (1200ms)
      })

      await act(async () => {
        // Flush the async persistence path.
        await Promise.resolve()
      })

      expect(scheduleEventMock).toHaveBeenCalledTimes(1)

      const scheduledSuggestion = scheduleEventMock.mock.calls[0]?.[0] as { scheduledFor?: string; content?: string } | undefined
      expect(scheduledSuggestion?.scheduledFor).toBeTruthy()
      expect(scheduledSuggestion?.content?.toLowerCase()).toContain("appointment")

      // Shows a confirmation widget and does NOT end the conversation.
      expect(result.current[0].widgets.some((w) => w.type === "schedule_activity" && w.status === "scheduled")).toBe(true)
      const confirmation = result.current[0].messages.find((m) => m.role === "assistant" && /scheduled/i.test(m.content))
      expect(confirmation?.content.toLowerCase()).toContain("appointment")
    } finally {
      vi.useRealTimers()
    }
  })

  it("does not double-schedule when the fallback runs first and the model calls schedule_activity later", async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date("2026-01-09T21:54:16Z"))

      const { result } = renderHook(() => useCheckIn())

      act(() => {
        geminiCallbacks?.onModelTranscript?.("Hi", true) // Unblock user input ("AI speaks first")
        result.current[1].sendTextMessage("Schedule an appointment today at 10:00 PM for 30 minutes.")
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500) // Wait past the fallback window (1200ms)
      })

      await act(async () => {
        // Flush the async persistence path.
        await Promise.resolve()
      })

      expect(scheduleEventMock).toHaveBeenCalledTimes(1)
      expect(addSuggestionMock).toHaveBeenCalledTimes(1)

      // Now the model "late" tool call arrives (should be ignored/deduped).
      act(() => {
        geminiCallbacks?.onWidget?.({
          widget: "schedule_activity",
          args: {
            title: "Appointment",
            category: "rest",
            date: "2026-01-09",
            time: "22:00",
            duration: 30,
          },
        })
      })

      await act(async () => {
        await Promise.resolve()
      })

      expect(scheduleEventMock).toHaveBeenCalledTimes(1)
      expect(addSuggestionMock).toHaveBeenCalledTimes(1)

      expect(result.current[0].widgets.filter((w) => w.type === "schedule_activity")).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it("dedupes duplicate schedule_activity tool calls (same time)", async () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onWidget?.({
        widget: "schedule_activity",
        args: {
          title: "Appointment",
          category: "rest",
          date: "2025-01-01",
          time: "22:00",
          duration: 30,
        },
      })
    })

    act(() => {
      geminiCallbacks?.onWidget?.({
        widget: "schedule_activity",
        args: {
          title: "Appointment",
          category: "rest",
          date: "2025-01-01",
          time: "22:00",
          duration: 30,
        },
      })
    })

    await waitFor(() => {
      expect(scheduleEventMock).toHaveBeenCalledTimes(1)
    })

    expect(addSuggestionMock).toHaveBeenCalledTimes(1)
    expect(result.current[0].widgets.filter((w) => w.type === "schedule_activity")).toHaveLength(1)
  })
})
