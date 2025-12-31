// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

let useCheckIn: typeof import("../use-check-in").useCheckIn

type GeminiWidgetEvent =
  | { widget: "breathing_exercise"; args: { type: string; duration: number } }
  | { widget: "journal_prompt"; args: { prompt: string; placeholder?: string; category?: string } }
  | { widget: "stress_gauge"; args: { stressLevel: number; fatigueLevel: number; message?: string } }
  | { widget: "quick_actions"; args: { actions: { label: string; action: string }[] } }
  | {
      widget: "schedule_activity"
      args: { title: string; category: "break" | "exercise" | "mindfulness" | "social" | "rest"; date: string; time: string; duration: number }
    }

type GeminiLiveCallbacks = {
  onWidget?: (event: GeminiWidgetEvent) => void
}

let geminiCallbacks: GeminiLiveCallbacks | null = null
let sendTextMock: ReturnType<typeof vi.fn>

beforeEach(async () => {
  geminiCallbacks = null
  sendTextMock = vi.fn()

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
          sendText: sendTextMock,
          injectContext: vi.fn(),
          endAudioStream: vi.fn(),
          getClient: vi.fn(() => null),
          reattachToClient: vi.fn(),
        },
      ] as const
    },
  }))

  ;({ useCheckIn } = await import("../use-check-in"))
})

describe("useCheckIn widgets", () => {
  it("adds widgets triggered by Gemini", () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onWidget?.({ widget: "breathing_exercise", args: { type: "box", duration: 120 } })
    })

    expect(result.current[0].widgets).toHaveLength(1)
    expect(result.current[0].widgets[0]?.type).toBe("breathing_exercise")
  })

  it("updates widget state when persistence fails (schedule_activity)", async () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onWidget?.({
        widget: "schedule_activity",
        args: {
          title: "Take a short walk",
          category: "exercise",
          date: "2024-01-01",
          time: "09:30",
          duration: 10,
        },
      })
    })

    expect(result.current[0].widgets[0]?.type).toBe("schedule_activity")
    expect(result.current[0].widgets[0]?.status).toBe("scheduled")

    await waitFor(() => {
      expect(result.current[0].widgets[0]?.status).toBe("failed")
    })
  })

  it("dismisses widgets", () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onWidget?.({ widget: "breathing_exercise", args: { type: "box", duration: 120 } })
    })

    const widgetId = result.current[0].widgets[0]?.id
    expect(widgetId).toEqual(expect.any(String))

    act(() => {
      result.current[1].dismissWidget(widgetId!)
    })

    expect(result.current[0].widgets).toHaveLength(0)
  })

  it("handles manual breathing exercise tool triggers", () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      result.current[1].triggerManualTool("show_breathing_exercise", { type: "478", duration: 90 })
    })

    expect(result.current[0].widgets).toHaveLength(1)
    expect(result.current[0].widgets[0]?.type).toBe("breathing_exercise")
    expect(result.current[0].widgets[0]?.args).toMatchObject({ type: "478", duration: 90 })
  })

  it("handles journal prompt widgets", () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onWidget?.({ widget: "journal_prompt", args: { prompt: "How are you feeling?" } })
    })

    expect(result.current[0].widgets).toHaveLength(1)
    expect(result.current[0].widgets[0]?.type).toBe("journal_prompt")
    expect(result.current[0].widgets[0]?.status).toBe("draft")
  })

  it("handles schedule activity widgets with invalid date/time", () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onWidget?.({
        widget: "schedule_activity",
        args: {
          title: "Break",
          category: "rest",
          date: "2024-02-31",
          time: "09:30",
          duration: 15,
        },
      })
    })

    expect(result.current[0].widgets).toHaveLength(1)
    expect(result.current[0].widgets[0]?.type).toBe("schedule_activity")
    expect(result.current[0].widgets[0]?.status).toBe("failed")
    expect(result.current[0].widgets[0]?.error).toBe("Invalid date/time")
  })

  it("handles stress gauge widgets", () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onWidget?.({
        widget: "stress_gauge",
        args: { stressLevel: 70, fatigueLevel: 40, message: "You seem stressed" },
      })
    })

    expect(result.current[0].widgets).toHaveLength(1)
    expect(result.current[0].widgets[0]?.type).toBe("stress_gauge")
  })

  it("handles quick actions widgets", () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onWidget?.({
        widget: "quick_actions",
        args: { actions: [{ label: "Breathe", action: "Take a breath" }] },
      })
    })

    expect(result.current[0].widgets).toHaveLength(1)
    expect(result.current[0].widgets[0]?.type).toBe("quick_actions")
  })
})

