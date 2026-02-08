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
  | {
      widget: "schedule_recurring_activity"
      args: {
        title: string
        category: "break" | "exercise" | "mindfulness" | "social" | "rest"
        startDate: string
        time: string
        duration: number
        frequency: "daily" | "weekdays" | "weekly" | "custom_weekdays"
        weekdays?: Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">
        count?: number
        untilDate?: string
      }
    }
  | {
      widget: "edit_recurring_activity"
      args: {
        title: string
        category?: "break" | "exercise" | "mindfulness" | "social" | "rest"
        scope: "single" | "future" | "all"
        fromDate?: string
        newDate?: string
        newTime?: string
        duration?: number
      }
    }
  | {
      widget: "cancel_recurring_activity"
      args: {
        title: string
        category?: "break" | "exercise" | "mindfulness" | "social" | "rest"
        scope: "single" | "future" | "all"
        fromDate?: string
      }
    }

type GeminiLiveCallbacks = {
  onWidget?: (event: GeminiWidgetEvent) => void
  onModelTranscript?: (text: string, finished: boolean) => void
  onTurnComplete?: () => void
}

let geminiCallbacks: GeminiLiveCallbacks | null = null
let scheduleEventMock: ReturnType<typeof vi.fn>
let addSuggestionMock: ReturnType<typeof vi.fn>
let putRecoveryBlockMock: ReturnType<typeof vi.fn>
let suggestionsStore: Map<string, Record<string, unknown>>
let recoveryBlocksStore: Map<string, Record<string, unknown>>
let recurringSeriesStore: Map<string, Record<string, unknown>>

beforeEach(async () => {
  geminiCallbacks = null
  suggestionsStore = new Map()
  recoveryBlocksStore = new Map()
  recurringSeriesStore = new Map()
  scheduleEventMock = vi.fn(async (suggestion: { id: string; scheduledFor?: string; duration: number }) => ({
    id: "rb_test",
    suggestionId: suggestion.id,
    calendarEventId: "evt_test",
    scheduledAt: suggestion.scheduledFor ?? new Date().toISOString(),
    duration: suggestion.duration,
    completed: false,
  }))
  addSuggestionMock = vi.fn(async (suggestion: Record<string, unknown>) => {
    const id = String(suggestion.id)
    suggestionsStore.set(id, { ...suggestion })
  })
  putRecoveryBlockMock = vi.fn(async (block: Record<string, unknown>) => {
    const id = String(block.id)
    recoveryBlocksStore.set(id, { ...block })
  })

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
      suggestions: {
        add: addSuggestionMock,
        get: vi.fn(async (id: string) => suggestionsStore.get(id)),
        update: vi.fn(async (id: string, updates: Record<string, unknown>) => {
          const existing = suggestionsStore.get(id)
          if (!existing) return 0
          suggestionsStore.set(id, { ...existing, ...updates })
          return 1
        }),
        where: vi.fn((index: string) => {
          if (index === "seriesId") {
            return {
              equals: vi.fn((seriesId: string) => ({
                toArray: vi.fn(async () =>
                  Array.from(suggestionsStore.values()).filter((suggestion) => suggestion.seriesId === seriesId)
                ),
              })),
            }
          }

          return {
            equals: vi.fn(() => ({
              toArray: vi.fn(async () => []),
            })),
          }
        }),
        delete: vi.fn(async (id: string) => {
          suggestionsStore.delete(id)
        }),
      },
      recoveryBlocks: {
        put: putRecoveryBlockMock,
        where: vi.fn((index: string) => {
          if (index === "suggestionId") {
            return {
              equals: vi.fn((suggestionId: string) => ({
                toArray: vi.fn(async () =>
                  Array.from(recoveryBlocksStore.values()).filter(
                    (block) => block.suggestionId === suggestionId
                  )
                ),
                delete: vi.fn(async () => {
                  for (const [id, block] of recoveryBlocksStore.entries()) {
                    if (block.suggestionId === suggestionId) {
                      recoveryBlocksStore.delete(id)
                    }
                  }
                }),
                modify: vi.fn(async (modifier: (value: Record<string, unknown>) => void) => {
                  for (const [id, block] of recoveryBlocksStore.entries()) {
                    if (block.suggestionId !== suggestionId) continue
                    const updated = { ...block }
                    modifier(updated)
                    recoveryBlocksStore.set(id, updated)
                  }
                }),
              })),
              anyOf: vi.fn((suggestionIds: string[]) => ({
                delete: vi.fn(async () => {
                  const set = new Set(suggestionIds)
                  for (const [id, block] of recoveryBlocksStore.entries()) {
                    if (set.has(String(block.suggestionId))) {
                      recoveryBlocksStore.delete(id)
                    }
                  }
                }),
              })),
            }
          }

          return {
            equals: vi.fn(() => ({
              toArray: vi.fn(async () => []),
              delete: vi.fn(async () => {}),
              modify: vi.fn(async () => {}),
            })),
          }
        }),
        delete: vi.fn(async (id: string) => {
          recoveryBlocksStore.delete(id)
        }),
      },
      journalEntries: { add: vi.fn(async () => {}) },
      settings: { get: vi.fn(async () => ({ id: "default", calendarConnected: true })) },
      recurringSeries: {
        put: vi.fn(async (series: Record<string, unknown>) => {
          recurringSeriesStore.set(String(series.id), { ...series })
        }),
        delete: vi.fn(async (id: string) => {
          recurringSeriesStore.delete(id)
        }),
        update: vi.fn(async (id: string, updates: Record<string, unknown>) => {
          const existing = recurringSeriesStore.get(id)
          if (!existing) return 0
          recurringSeriesStore.set(id, { ...existing, ...updates })
          return 1
        }),
        where: vi.fn((index: string) => {
          if (index === "status") {
            return {
              equals: vi.fn((status: string) => ({
                toArray: vi.fn(async () =>
                  Array.from(recurringSeriesStore.values()).filter((series) => series.status === status)
                ),
              })),
            }
          }

          return {
            equals: vi.fn(() => ({ toArray: vi.fn(async () => []) })),
          }
        }),
      },
      transaction: vi.fn(async (_mode: string, ...args: unknown[]) => {
        const callback = args[args.length - 1]
        if (typeof callback === "function") {
          return callback()
        }
        return undefined
      }),
    },
    fromSuggestion: (record: unknown) => record,
    toSuggestion: (record: unknown) => record,
    fromRecoveryBlock: (record: unknown) => record,
    fromJournalEntry: (record: unknown) => record,
    fromRecurringSeries: (record: unknown) => record,
    toRecurringSeries: (record: unknown) => record,
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

    const firstWidget = result.current[0].widgets[0]
    expect(firstWidget?.type).toBe("schedule_activity")
    if (!firstWidget || firstWidget.type !== "schedule_activity") {
      throw new Error("Expected schedule_activity widget")
    }
    expect(firstWidget.status).toBe("scheduled")

    await waitFor(() => {
      expect(scheduleEventMock).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(putRecoveryBlockMock).toHaveBeenCalledTimes(1)
    })
  })

  it("marks schedule widgets as syncing while calendar persistence is in-flight", async () => {
    let resolveSchedule: ((value: { id: string; suggestionId: string; calendarEventId: string; scheduledAt: string; duration: number; completed: boolean }) => void) | null = null

    scheduleEventMock.mockImplementationOnce(
      async (_suggestion: { id: string; scheduledFor?: string; duration: number }) =>
        await new Promise((resolve) => {
          resolveSchedule = resolve
        })
    )

    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onWidget?.({
        widget: "schedule_activity",
        args: {
          title: "Super Bowl game with dad",
          category: "social",
          date: "2025-02-09",
          time: "15:30",
          duration: 240,
        },
      })
    })

    const pendingWidget = result.current[0].widgets[0]
    expect(pendingWidget?.type).toBe("schedule_activity")
    if (!pendingWidget || pendingWidget.type !== "schedule_activity") {
      throw new Error("Expected schedule_activity widget")
    }

    expect(pendingWidget.status).toBe("scheduled")
    expect(pendingWidget.isSyncing).toBe(true)

    await waitFor(() => {
      expect(scheduleEventMock).toHaveBeenCalledTimes(1)
      expect(resolveSchedule).toBeTypeOf("function")
    })

    act(() => {
      resolveSchedule?.({
        id: "rb_test",
        suggestionId: "suggestion",
        calendarEventId: "evt_test",
        scheduledAt: "2025-02-09T15:30:00Z",
        duration: 240,
        completed: false,
      })
    })

    await waitFor(() => {
      const widget = result.current[0].widgets[0]
      expect(widget?.type).toBe("schedule_activity")
      if (!widget || widget.type !== "schedule_activity") return
      expect(widget.isSyncing).toBe(false)
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
    const firstWidget = result.current[0].widgets[0]
    expect(firstWidget?.type).toBe("schedule_activity")
    if (!firstWidget || firstWidget.type !== "schedule_activity") {
      throw new Error("Expected schedule_activity widget")
    }
    expect(firstWidget.args.time).toBe("22:00")
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
    const firstWidget = result.current[0].widgets[0]
    expect(firstWidget?.type).toBe("schedule_activity")
    if (!firstWidget || firstWidget.type !== "schedule_activity") {
      throw new Error("Expected schedule_activity widget")
    }
    expect(firstWidget.args.time).toBe("21:30")
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

  it("replaces generic tool title/duration with the user's explicit activity details", async () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onModelTranscript?.("Hi", true) // Unblock user input ("AI speaks first")
      result.current[1].sendTextMessage(
        "Please schedule an activity for cooking chicken noodle soup on 2025-01-01 at 10:00 PM for 30 minutes."
      )
    })

    act(() => {
      geminiCallbacks?.onWidget?.({
        widget: "schedule_activity",
        args: {
          title: "Rest activity",
          category: "rest",
          date: "2025-01-01",
          time: "22:00",
          duration: 20,
        },
      })
    })

    await waitFor(() => {
      expect(scheduleEventMock).toHaveBeenCalledTimes(1)
    })

    const scheduledSuggestion = scheduleEventMock.mock.calls[0]?.[0] as
      | { content?: string; duration?: number }
      | undefined
    expect(scheduledSuggestion?.content?.toLowerCase()).toContain("cooking chicken noodle soup")
    expect(scheduledSuggestion?.duration).toBe(30)

    const widget = result.current[0].widgets[0]
    expect(widget?.type).toBe("schedule_activity")
    if (!widget || widget.type !== "schedule_activity") return
    expect(widget.args.title.toLowerCase()).toContain("cooking chicken noodle soup")
    expect(widget.args.duration).toBe(30)
  })

  it("replaces mismatched check-in titles and preserves long spoken durations", async () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onModelTranscript?.("Hi", true) // Unblock user input ("AI speaks first")
      result.current[1].sendTextMessage(
        "Please schedule watching the Super Bowl with my dad on 2025-02-09 at 9:07 PM for five hours."
      )
    })

    act(() => {
      geminiCallbacks?.onWidget?.({
        widget: "schedule_activity",
        args: {
          title: "Check-in",
          category: "social",
          date: "2025-02-09",
          time: "21:07",
          duration: 30,
        },
      })
    })

    await waitFor(() => {
      expect(scheduleEventMock).toHaveBeenCalledTimes(1)
    })

    const scheduledSuggestion = scheduleEventMock.mock.calls[0]?.[0] as
      | { content?: string; duration?: number; scheduledFor?: string }
      | undefined
    expect(scheduledSuggestion?.content?.toLowerCase()).toContain("super bowl")
    expect(scheduledSuggestion?.duration).toBe(300)

    const scheduledAt = Temporal.Instant.from(scheduledSuggestion!.scheduledFor!).toZonedDateTimeISO("UTC")
    expect(scheduledAt.hour).toBe(21)
    expect(scheduledAt.minute).toBe(7)

    const widget = result.current[0].widgets[0]
    expect(widget?.type).toBe("schedule_activity")
    if (!widget || widget.type !== "schedule_activity") return
    expect(widget.args.title.toLowerCase()).toContain("super bowl")
    expect(widget.args.duration).toBe(300)
  })

  it("does not add a duplicate schedule confirmation if the assistant already confirmed", async () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onModelTranscript?.(
        "Done — scheduled \"Journaling exercise\" for Sat, Feb 7 at 10:00 PM.",
        false
      )
      geminiCallbacks?.onTurnComplete?.()
    })

    act(() => {
      geminiCallbacks?.onWidget?.({
        widget: "schedule_activity",
        args: {
          title: "Journaling exercise",
          category: "mindfulness",
          date: "2025-02-07",
          time: "22:00",
          duration: 5,
        },
      })
    })

    await waitFor(() => {
      expect(scheduleEventMock).toHaveBeenCalledTimes(1)
    })

    const scheduleConfirmations = result.current[0].messages.filter(
      (m) => m.role === "assistant" && /scheduled/i.test(m.content)
    )
    expect(scheduleConfirmations).toHaveLength(1)
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

    const firstWidget = result.current[0].widgets[0]
    expect(firstWidget?.type).toBe("schedule_activity")
    if (!firstWidget || firstWidget.type !== "schedule_activity") {
      throw new Error("Expected schedule_activity widget")
    }
    expect(firstWidget.args.time).toBe("21:30")
  })

  it("does not auto-schedule when the user did not provide an explicit duration", async () => {
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

      expect(scheduleEventMock).not.toHaveBeenCalled()
      expect(addSuggestionMock).not.toHaveBeenCalled()
      expect(result.current[0].widgets.some((w) => w.type === "schedule_activity")).toBe(false)
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

  it("auto-schedules free-form activities with a specific title and explicit duration", async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date("2026-01-09T21:54:16Z"))

      const { result } = renderHook(() => useCheckIn())

      act(() => {
        geminiCallbacks?.onModelTranscript?.("Hi", true) // Unblock user input ("AI speaks first")
        result.current[1].sendTextMessage(
          "Please schedule an activity for cooking chicken noodle soup today at 10:00 PM for 30 minutes."
        )
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500) // Wait past the fallback window (1200ms)
      })

      await act(async () => {
        // Flush the async persistence path.
        await Promise.resolve()
      })

      expect(scheduleEventMock).toHaveBeenCalledTimes(1)

      const scheduledSuggestion = scheduleEventMock.mock.calls[0]?.[0] as
        | { content?: string; duration?: number }
        | undefined
      expect(scheduledSuggestion?.content?.toLowerCase()).toContain("cooking chicken noodle soup")
      expect(scheduledSuggestion?.duration).toBe(30)

      const confirmation = result.current[0].messages.find((m) => m.role === "assistant" && /scheduled/i.test(m.content))
      expect(confirmation?.content.toLowerCase()).toContain("cooking chicken noodle soup")
    } finally {
      vi.useRealTimers()
    }
  })

  it("auto-schedules long spoken durations in fallback mode", async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date("2026-01-09T20:00:00Z"))

      const { result } = renderHook(() => useCheckIn())

      act(() => {
        geminiCallbacks?.onModelTranscript?.("Hi", true) // Unblock user input ("AI speaks first")
        result.current[1].sendTextMessage(
          "Please schedule an activity for watching the Super Bowl with my dad today at 9:07 PM for five hours."
        )
      })

      await act(async () => {
        // Let effects run so the fallback timer is registered.
        await Promise.resolve()
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500) // Wait past the fallback window (1200ms)
      })

      await act(async () => {
        // Flush the async persistence path.
        await Promise.resolve()
      })

      expect(scheduleEventMock).toHaveBeenCalledTimes(1)

      const scheduledSuggestion = scheduleEventMock.mock.calls[0]?.[0] as
        | { content?: string; duration?: number; scheduledFor?: string }
        | undefined
      expect(scheduledSuggestion?.content?.toLowerCase()).toContain("super bowl")
      expect(scheduledSuggestion?.duration).toBe(300)

      const scheduledAt = Temporal.Instant.from(scheduledSuggestion!.scheduledFor!).toZonedDateTimeISO("UTC")
      expect(scheduledAt.hour).toBe(21)
      expect(scheduledAt.minute).toBe(7)
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

  it("allows different activities at the same scheduled time", async () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onWidget?.({
        widget: "schedule_activity",
        args: {
          title: "Study session",
          category: "rest",
          date: "2026-02-10",
          time: "20:00",
          duration: 45,
        },
      })
    })

    act(() => {
      geminiCallbacks?.onWidget?.({
        widget: "schedule_activity",
        args: {
          title: "Workout",
          category: "exercise",
          date: "2026-02-10",
          time: "20:00",
          duration: 30,
        },
      })
    })

    await waitFor(() => {
      expect(scheduleEventMock).toHaveBeenCalledTimes(2)
    })

    expect(addSuggestionMock).toHaveBeenCalledTimes(2)
    expect(result.current[0].widgets.filter((w) => w.type === "schedule_activity")).toHaveLength(2)
  })

  it("schedules recurring plans as multiple events and posts an aggregate message", async () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onWidget?.({
        widget: "schedule_recurring_activity",
        args: {
          title: "Study session",
          category: "rest",
          startDate: "2026-02-09",
          time: "20:00",
          duration: 45,
          frequency: "weekdays",
          count: 3,
        },
      })
    })

    await waitFor(() => {
      expect(scheduleEventMock).toHaveBeenCalledTimes(3)
    })

    await waitFor(() => {
      const summary = result.current[0].messages.find(
        (m) => m.role === "assistant" && /Scheduled 3 blocks/i.test(m.content)
      )
      expect(summary?.content).toContain("Study session")
    })

    expect(addSuggestionMock).toHaveBeenCalledTimes(3)
    expect(result.current[0].widgets.filter((w) => w.type === "schedule_activity")).toHaveLength(3)
  })

  it("caps recurring schedules at the safety limit", async () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onWidget?.({
        widget: "schedule_recurring_activity",
        args: {
          title: "Daily check-in",
          category: "rest",
          startDate: "2026-02-01",
          time: "09:00",
          duration: 10,
          frequency: "daily",
          count: 100,
        },
      })
    })

    await waitFor(() => {
      expect(scheduleEventMock).toHaveBeenCalledTimes(30)
    })

    await waitFor(() => {
      const summary = result.current[0].messages.find(
        (m) => m.role === "assistant" && /Capped at 30 occurrences/i.test(m.content)
      )
      expect(summary).toBeTruthy()
    })
  })

  it("reports partial failures for recurring schedules", async () => {
    let callCount = 0
    scheduleEventMock.mockImplementation(async (suggestion: { id: string; scheduledFor?: string; duration: number }) => {
      callCount += 1
      if (callCount === 2) return null
      return {
        id: `rb_test_${callCount}`,
        suggestionId: suggestion.id,
        calendarEventId: `evt_test_${callCount}`,
        scheduledAt: suggestion.scheduledFor ?? new Date().toISOString(),
        duration: suggestion.duration,
        completed: false,
      }
    })

    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onWidget?.({
        widget: "schedule_recurring_activity",
        args: {
          title: "Wind-down routine",
          category: "mindfulness",
          startDate: "2026-02-09",
          time: "21:00",
          duration: 15,
          frequency: "daily",
          count: 3,
        },
      })
    })

    await waitFor(() => {
      expect(scheduleEventMock).toHaveBeenCalledTimes(3)
    })

    await waitFor(() => {
      const summary = result.current[0].messages.find(
        (m) => m.role === "assistant" && /Scheduled 2 blocks/i.test(m.content)
      )
      expect(summary?.content).toMatch(/1 failed/i)
    })

    expect(putRecoveryBlockMock).toHaveBeenCalledTimes(2)
    expect(result.current[0].widgets.some((w) => w.type === "schedule_activity" && w.status === "failed")).toBe(true)
  })

  it("edits recurring series occurrences with future scope", async () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onWidget?.({
        widget: "schedule_recurring_activity",
        args: {
          title: "Study session",
          category: "rest",
          startDate: "2026-02-09",
          time: "20:00",
          duration: 45,
          frequency: "weekdays",
          count: 3,
        },
      })
    })

    await waitFor(() => {
      expect(scheduleEventMock).toHaveBeenCalledTimes(3)
    })

    act(() => {
      geminiCallbacks?.onWidget?.({
        widget: "edit_recurring_activity",
        args: {
          title: "Study session",
          scope: "future",
          fromDate: "2026-02-10",
          newTime: "9:00 PM",
        },
      })
    })

    await waitFor(() => {
      const summary = result.current[0].messages.find(
        (m) => m.role === "assistant" && /Updated 2 occurrences/i.test(m.content)
      )
      expect(summary).toBeTruthy()
    })

    const normalizeToDate = (value: unknown): Date => {
      if (value instanceof Date) return value
      return new Date(String(value))
    }

    const editedOccurrences = Array.from(suggestionsStore.values())
      .filter((suggestion) => {
        return suggestion.seriesId && suggestion.occurrenceDate !== "2026-02-09"
      })
      .map((suggestion) => normalizeToDate(suggestion.scheduledFor))

    expect(editedOccurrences).toHaveLength(2)
    expect(editedOccurrences.every((date) => date.getUTCHours() === 21)).toBe(true)
  })

  it("cancels recurring series occurrences with all scope", async () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onWidget?.({
        widget: "schedule_recurring_activity",
        args: {
          title: "Night walk",
          category: "exercise",
          startDate: "2026-02-09",
          time: "19:30",
          duration: 30,
          frequency: "daily",
          count: 3,
        },
      })
    })

    await waitFor(() => {
      expect(scheduleEventMock).toHaveBeenCalledTimes(3)
    })

    act(() => {
      geminiCallbacks?.onWidget?.({
        widget: "cancel_recurring_activity",
        args: {
          title: "Night walk",
          scope: "all",
        },
      })
    })

    await waitFor(() => {
      const summary = result.current[0].messages.find(
        (m) => m.role === "assistant" && /Cancelled 3 occurrences/i.test(m.content)
      )
      expect(summary).toBeTruthy()
    })

    const statuses = Array.from(suggestionsStore.values()).map((suggestion) => suggestion.status)
    expect(statuses).toHaveLength(3)
    expect(statuses.every((status) => status === "dismissed")).toBe(true)
  })
})
