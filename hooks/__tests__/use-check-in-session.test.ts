// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { GeminiLiveClient } from "@/lib/gemini/live-client"

let useCheckIn: typeof import("../use-check-in").useCheckIn
let initialState: typeof import("../use-check-in").initialState

type GeminiLiveCallbacks = {
  onConnected?: () => void
  onDisconnected?: (reason: string) => void
  onWidget?: (event: { widget: string; args: unknown }) => void
  onUserTranscript?: (text: string, isFinal: boolean) => void
  onModelTranscript?: (text: string, finished: boolean) => void
  onAudioChunk?: (base64Audio: string) => void
  onSilenceChosen?: (reason: string) => void
}

let geminiCallbacks: GeminiLiveCallbacks | null = null
let getUserMediaMock: ReturnType<typeof vi.fn>
let stopMock: ReturnType<typeof vi.fn>
let connectMock: ReturnType<typeof vi.fn>
let disconnectMock: ReturnType<typeof vi.fn>
let sendTextMock: ReturnType<typeof vi.fn>
let reattachToClientMock: ReturnType<typeof vi.fn>
let getClientMock: ReturnType<typeof vi.fn>
let fakeClient: {
  isConnectionHealthy: () => boolean
  detachEventHandlers: () => void
  disconnect: () => void
}

beforeEach(async () => {
  geminiCallbacks = null
  stopMock = vi.fn()
  connectMock = vi.fn(async () => {
    geminiCallbacks?.onConnected?.()
  })
  disconnectMock = vi.fn()
  sendTextMock = vi.fn()
  reattachToClientMock = vi.fn()

  fakeClient = {
    isConnectionHealthy: () => true,
    detachEventHandlers: () => {},
    disconnect: () => {},
  }

  getClientMock = vi.fn(() => fakeClient)

  type MockAudioTrack = {
    stop: () => void
    readyState: "live" | "ended"
    kind: "audio"
    enabled: boolean
  }

  const track: MockAudioTrack = {
    stop: () => {},
    readyState: "live",
    kind: "audio",
    enabled: true,
  }

  stopMock = vi.fn(() => {
    track.readyState = "ended"
  })
  track.stop = stopMock as unknown as () => void

  const stream = {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  }

  getUserMediaMock = vi.fn().mockResolvedValue(stream)
  Object.defineProperty(global.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: getUserMediaMock },
  })

  const audioWorkletAddModuleMock = vi.fn().mockResolvedValue(undefined)

  class MockAudioContext {
    state = "running" as const
    audioWorklet = { addModule: audioWorkletAddModuleMock }
    destination = {}
    resume = vi.fn().mockResolvedValue(undefined)
    close = vi.fn().mockResolvedValue(undefined)
    createMediaStreamSource = vi.fn(() => ({ connect: vi.fn() }))
  }

  class MockAudioWorkletNode {
    port = { onmessage: null as ((event: { data: unknown }) => void) | null, postMessage: vi.fn() }
    constructor(public context: unknown, public name: string) {}
    connect = vi.fn()
    disconnect = vi.fn()
  }

  // @ts-expect-error - assign test doubles
  global.AudioContext = MockAudioContext
  // @ts-expect-error - assign test doubles
  global.AudioWorkletNode = MockAudioWorkletNode

  vi.resetModules()
  vi.unmock("@/hooks/use-gemini-live")
  vi.unmock("@/lib/gemini/check-in-context")
  vi.unmock("@/lib/gemini/context-fingerprint")
  vi.unmock("@/lib/utils")

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
          connect: connectMock,
          disconnect: disconnectMock,
          sendAudio: vi.fn(),
          sendText: sendTextMock,
          injectContext: vi.fn(),
          endAudioStream: vi.fn(),
          getClient: getClientMock,
          reattachToClient: reattachToClientMock,
        },
      ] as const
    },
  }))

  vi.doMock("@/lib/gemini/check-in-context", () => ({
    fetchCheckInContext: vi.fn(async () => ({
      recentSessions: [],
      recentTrends: [],
      timeContext: {
        currentTime: "Monday, January 01, 2024 at 9:00 AM PST",
        dayOfWeek: "Monday",
        timeOfDay: "morning",
        daysSinceLastCheckIn: null,
        lastCheckInTimestamp: null,
      },
      voiceTrends: {
        stressTrend: null,
        fatigueTrend: null,
        averageStressLastWeek: null,
        averageFatigueLastWeek: null,
      },
      pendingCommitments: [],
      recentSuggestions: [],
    })),
    formatContextForAPI: vi.fn((data: unknown) => data),
  }))

  vi.doMock("@/lib/gemini/context-fingerprint", () => ({
    computeContextFingerprint: vi.fn(async () => "stub-fingerprint"),
  }))

  vi.doMock("@/lib/utils", () => ({
    createGeminiHeaders: vi.fn(async (existing?: HeadersInit) => existing ?? {}),
  }))

  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        summary: {
          patternSummary: "stub",
          keyObservations: [],
          contextNotes: "stub",
        },
      }),
    }))
  )

  ;({ useCheckIn, initialState } = await import("../use-check-in"))

  const preserved = await import("@/lib/gemini/preserved-session")
  preserved.clearPreservedSession()
})

describe("useCheckIn session lifecycle", () => {
  it("creates a new session on start", async () => {
    const onSessionStart = vi.fn()
    const { result } = renderHook(() => useCheckIn({ onSessionStart }))

    await act(async () => {
      await result.current[1].startSession()
    })

    expect(result.current[0].session?.id).toEqual(expect.any(String))
    expect(onSessionStart).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(String) }))
    expect(connectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        timeContext: expect.objectContaining({
          dayOfWeek: "Monday",
          timeOfDay: "morning",
        }),
      })
    )
  })

  it("ends a session and calls onSessionEnd", async () => {
    const onSessionEnd = vi.fn()
    const { result } = renderHook(() => useCheckIn({ onSessionEnd }))

    await act(async () => {
      await result.current[1].startSession()
    })

    // AI-first: unlock user input after the assistant starts.
    act(() => {
      geminiCallbacks?.onModelTranscript?.("hello", false)
    })

    act(() => {
      result.current[1].sendTextMessage("hello")
    })

    await act(async () => {
      await result.current[1].endSession()
    })

    expect(result.current[0].state).toBe("complete")
    expect(disconnectMock).toHaveBeenCalled()
    expect(onSessionEnd).toHaveBeenCalledWith(expect.objectContaining({ endedAt: expect.any(String) }))
  })

  it("attempts to reconnect when Gemini disconnects unexpectedly after user participation", async () => {
    const onSessionEnd = vi.fn()
    const { result } = renderHook(() => useCheckIn({ onSessionEnd }))

    await act(async () => {
      await result.current[1].startSession()
    })

    // AI-first: unlock user input after the assistant starts.
    act(() => {
      geminiCallbacks?.onModelTranscript?.("hello", false)
    })

    act(() => {
      result.current[1].sendTextMessage("hello")
    })

    await waitFor(() => {
      expect(result.current[0].messages.some((m) => m.role === "user")).toBe(true)
    })

    act(() => {
      geminiCallbacks?.onDisconnected?.("network lost")
    })

    expect(connectMock).toHaveBeenCalledTimes(2)

    await waitFor(() => {
      expect(
        sendTextMock.mock.calls.some(([text]) =>
          typeof text === "string" && text.includes("[RESUME_CONVERSATION]")
        )
      ).toBe(true)
    })
    expect(result.current[0].state).not.toBe("complete")
    expect(onSessionEnd).not.toHaveBeenCalled()
  })

  it("surfaces an error when Gemini disconnects before any user participation", async () => {
    const { result } = renderHook(() => useCheckIn())

    await act(async () => {
      await result.current[1].startSession()
    })

    act(() => {
      geminiCallbacks?.onDisconnected?.("network lost")
    })

    await waitFor(() => {
      expect(result.current[0].state).toBe("error")
    })

    expect(connectMock).toHaveBeenCalledTimes(1)
    expect(result.current[0].error).toBe("network lost")
  })

  it("ignores manual disconnect events", async () => {
    const { result } = renderHook(() => useCheckIn())

    await act(async () => {
      await result.current[1].startSession()
    })

    act(() => {
      geminiCallbacks?.onDisconnected?.("Manual disconnect")
    })

    expect(connectMock).toHaveBeenCalledTimes(1)
    expect(result.current[0].state).not.toBe("error")
    expect(result.current[0].error).toBe(null)
  })

  it("surfaces an error on invalid-argument disconnects even after user participation", async () => {
    const { result } = renderHook(() => useCheckIn())

    await act(async () => {
      await result.current[1].startSession()
    })

    // AI-first: unlock user input after the assistant starts.
    act(() => {
      geminiCallbacks?.onModelTranscript?.("hello", false)
    })

    act(() => {
      result.current[1].sendTextMessage("hello")
    })

    await waitFor(() => {
      expect(result.current[0].messages.some((m) => m.role === "user" && m.content === "hello")).toBe(true)
    })

    act(() => {
      geminiCallbacks?.onDisconnected?.("Invalid argument")
    })

    await waitFor(() => {
      expect(result.current[0].state).toBe("error")
    })

    expect(connectMock).toHaveBeenCalledTimes(1)
    expect(result.current[0].error).toBe("Invalid argument")
  })

  it("does not finalize the session when a disconnect happens right after scheduling (reconnects instead)", async () => {
    const onSessionEnd = vi.fn()
    const { result } = renderHook(() => useCheckIn({ onSessionEnd }))

    await act(async () => {
      await result.current[1].startSession()
    })

    // AI-first: unlock user input after the assistant starts.
    act(() => {
      geminiCallbacks?.onModelTranscript?.("hello", false)
    })

    act(() => {
      result.current[1].sendTextMessage("Schedule a check-in today at 10:00 PM.")
    })

    // Simulate Gemini calling the schedule tool (this is the action that currently
    // causes some sessions to drop and get auto-finalized).
    act(() => {
      geminiCallbacks?.onWidget?.({
        widget: "schedule_activity",
        args: {
          title: "Check-in",
          category: "rest",
          date: "2026-01-09",
          time: "22:00",
          duration: 20,
        },
      })
    })

    act(() => {
      geminiCallbacks?.onDisconnected?.("Session closed")
    })

    await waitFor(() => {
      expect(connectMock).toHaveBeenCalledTimes(2)
    })

    expect(result.current[0].state).not.toBe("complete")
    expect(onSessionEnd).not.toHaveBeenCalled()
  })

  it("does not auto-complete when a disconnect happens after scheduling (even if not immediate)", async () => {
    vi.useFakeTimers()
    try {
      const onSessionEnd = vi.fn()
      const { result } = renderHook(() => useCheckIn({ onSessionEnd }))

      await act(async () => {
        await result.current[1].startSession()
      })

      // AI-first: unlock user input after the assistant starts.
      act(() => {
        geminiCallbacks?.onModelTranscript?.("hello", false)
      })

      act(() => {
        result.current[1].sendTextMessage("Schedule an appointment tomorrow at 9:30 PM.")
      })

      act(() => {
        geminiCallbacks?.onWidget?.({
          widget: "schedule_activity",
          args: {
            title: "Appointment",
            category: "rest",
            date: "2026-01-10",
            time: "21:30",
            duration: 30,
          },
        })
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000)
      })

      act(() => {
        geminiCallbacks?.onDisconnected?.("network lost")
      })

      expect(connectMock).toHaveBeenCalledTimes(2)

      expect(result.current[0].state).not.toBe("complete")
      expect(onSessionEnd).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it("preserves an active session and resets local state", async () => {
    const { result } = renderHook(() => useCheckIn())

    await act(async () => {
      await result.current[1].startSession()
    })

    // AI-first: unlock user input after the assistant starts.
    act(() => {
      geminiCallbacks?.onModelTranscript?.("hello", false)
    })

    act(() => {
      result.current[1].sendTextMessage("hello")
    })

    act(() => {
      result.current[1].preserveSession()
    })

    expect(result.current[0]).toEqual(initialState)
    expect(result.current[1].hasPreservedSession()).toBe(true)
  })

  it("resumes a preserved session and restores messages/widgets", async () => {
    const { result } = renderHook(() => useCheckIn())

    await act(async () => {
      await result.current[1].startSession()
    })

    // AI-first: unlock user input after the assistant starts.
    act(() => {
      geminiCallbacks?.onModelTranscript?.("hello", false)
    })

    act(() => {
      result.current[1].sendTextMessage("hello")
      geminiCallbacks?.onWidget?.({ widget: "breathing_exercise", args: { type: "box", duration: 120 } })
    })

    act(() => {
      result.current[1].preserveSession()
    })

    expect(result.current[1].hasPreservedSession()).toBe(true)

    await act(async () => {
      await result.current[1].resumePreservedSession()
    })

    await waitFor(() => {
      expect(result.current[0].messages.length).toBeGreaterThan(0)
      expect(result.current[0].widgets.length).toBeGreaterThan(0)
    })

    expect(reattachToClientMock).toHaveBeenCalledWith(fakeClient)
    expect(result.current[1].hasPreservedSession()).toBe(false)
  })

  it("clears any preserved session when ending", async () => {
    const { preserveSession, hasPreservedSession } = await import("@/lib/gemini/preserved-session")

    preserveSession(fakeClient as unknown as GeminiLiveClient, initialState, "stub-fingerprint")
    expect(hasPreservedSession()).toBe(true)

    const { result } = renderHook(() => useCheckIn())
    await act(async () => {
      await result.current[1].endSession()
    })

    expect(hasPreservedSession()).toBe(false)
  })

  it("exposes a current context fingerprint", async () => {
    const { result } = renderHook(() => useCheckIn())

    const fp = await result.current[1].getContextFingerprint()
    expect(fp).toBe("stub-fingerprint")
  })

  it("throws when resuming a preserved session with an unhealthy client", async () => {
    const preserved = await import("@/lib/gemini/preserved-session")
    const unhealthyClient = {
      isConnectionHealthy: () => false,
      detachEventHandlers: () => {},
      disconnect: () => {},
    }

    preserved.preserveSession(unhealthyClient as unknown as GeminiLiveClient, initialState, "stub-fingerprint")

    const { result } = renderHook(() => useCheckIn())

    await act(async () => {
      try {
        await result.current[1].resumePreservedSession()
        throw new Error("Expected resumePreservedSession() to throw")
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain("Preserved connection lost")
      }
    })
  })

  it("cancels a session and resets state", async () => {
    const { result } = renderHook(() => useCheckIn())

    await act(async () => {
      await result.current[1].startSession()
    })

    act(() => {
      result.current[1].cancelSession()
    })

    expect(result.current[0]).toEqual(initialState)
    expect(disconnectMock).toHaveBeenCalled()
  })

  it("does not merge assistant transcripts across reconnects", async () => {
    const { result } = renderHook(() => useCheckIn())

    await act(async () => {
      await result.current[1].startSession()
    })

    // User participates so disconnect triggers reconnect.
    act(() => {
      geminiCallbacks?.onUserTranscript?.("Um I'm pretty tired.", false)
    })

    // Simulate an in-progress assistant response (streaming).
    act(() => {
      geminiCallbacks?.onModelTranscript?.("I can hear that in your voice. Is there anything that might", false)
    })

    expect(result.current[0].messages).toHaveLength(2)
    expect(result.current[0].messages[1]?.role).toBe("assistant")
    expect(result.current[0].messages[1]?.isStreaming).toBe(true)

    // Connection drops mid-turn; hook attempts to reconnect.
    act(() => {
      geminiCallbacks?.onDisconnected?.("network lost")
    })

    await waitFor(() => {
      expect(connectMock).toHaveBeenCalledTimes(2)
    })

    // After reconnect, a new assistant response should start a NEW bubble.
    act(() => {
      geminiCallbacks?.onModelTranscript?.("Hey Sean, it's Kanari.", false)
    })

    expect(result.current[0].messages).toHaveLength(3)
    expect(result.current[0].messages[1]?.content).toContain("Is there anything")
    expect(result.current[0].messages[2]?.content).toContain("Hey Sean")
  })
})
