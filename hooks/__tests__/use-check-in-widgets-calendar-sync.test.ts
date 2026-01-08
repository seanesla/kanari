// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"

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

  vi.doMock("@/hooks/use-calendar", () => ({
    useCalendar: () => ({
      isConnected: true,
      isLoading: false,
      error: null,
      connect: vi.fn(async () => {}),
      disconnect: vi.fn(async () => {}),
      scheduleEvent: scheduleEventMock,
      deleteEvent: vi.fn(async () => {}),
      clearError: vi.fn(),
      refreshTokens: vi.fn(async () => true),
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
  it("syncs AI-scheduled activities to Google Calendar when connected", async () => {
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
})

