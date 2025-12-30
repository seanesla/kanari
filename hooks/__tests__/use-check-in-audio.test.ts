// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// --- Test state ----------------------------------------------------------

let useCheckIn: typeof import("../use-check-in").useCheckIn
type GeminiLiveCallbacks = {
  onDisconnected?: (reason: string) => void
}

let geminiCallbacks: GeminiLiveCallbacks | null = null
let stopMock: ReturnType<typeof vi.fn>
let getUserMediaMock: ReturnType<typeof vi.fn>

const connectMock = vi.fn(async () => {})
const disconnectMock = vi.fn()

const playbackInitialize = vi.fn(async () => {})
const playbackCleanup = vi.fn()

// --- Setup ---------------------------------------------------------------

beforeEach(async () => {
  geminiCallbacks = null
  connectMock.mockClear()
  disconnectMock.mockClear()
  playbackInitialize.mockClear()
  playbackCleanup.mockClear()

  stopMock = vi.fn()

  const track: {
    stop: () => void
    readyState: "live" | "ended"
    kind: "audio"
    enabled: boolean
  } = {
    stop: () => {},
    readyState: "live",
    kind: "audio",
    enabled: true,
  }

  stopMock = vi.fn(() => {
    track.readyState = "ended"
  })
  track.stop = stopMock

  const stream = {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  }

  getUserMediaMock = vi.fn().mockResolvedValue(stream)
  Object.defineProperty(global.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: getUserMediaMock },
  })

  class MockAudioContext {
    state = "running" as const
    audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) }
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

  // Ensure a clean module graph for per-test mocking.
  vi.resetModules()

  // Override global setup mocks for this suite.
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
          sendText: vi.fn(),
          injectContext: vi.fn(),
          endAudioStream: vi.fn(),
        },
      ] as const
    },
  }))

  // Note: we intentionally rely on the global `@/hooks/use-audio-playback` mock from `vitest.setup.ts`.

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
          suggestedOpener: "stub",
          contextNotes: "stub",
        },
      }),
    }))
  )

  ;({ useCheckIn } = await import("../use-check-in"))
})

// --- Tests ---------------------------------------------------------------

describe("useCheckIn microphone lifecycle", () => {
  it("stops microphone tracks when Gemini disconnects unexpectedly", async () => {
    const { result } = renderHook(() => useCheckIn())

    await act(async () => {
      await result.current[1].startSession()
    })

    expect(result.current[0].state).not.toBe("error")
    expect(result.current[0].error).toBeNull()

    // Ensure the hook passed callbacks to the Gemini layer.
    expect(geminiCallbacks?.onDisconnected).toEqual(expect.any(Function))
    expect(getUserMediaMock).toHaveBeenCalled()

    // Ensure we only count stops triggered by the disconnect callback.
    stopMock.mockClear()

    act(() => {
      geminiCallbacks.onDisconnected("network lost")
    })

    expect(stopMock).toHaveBeenCalled()
  })
})
