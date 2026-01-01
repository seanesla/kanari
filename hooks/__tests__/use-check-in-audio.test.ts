// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// --- Test state ----------------------------------------------------------

let useCheckIn: typeof import("../use-check-in").useCheckIn
type GeminiLiveCallbacks = {
  onConnected?: () => void
  onDisconnected?: (reason: string) => void
  onTurnComplete?: () => void
  onUserSpeechStart?: () => void
  onUserSpeechEnd?: () => void
  onUserTranscript?: (text: string, isFinal: boolean) => void
}

let geminiCallbacks: GeminiLiveCallbacks | null = null
let stopMock: ReturnType<typeof vi.fn>
let getUserMediaMock: ReturnType<typeof vi.fn>
let sendAudioMock: ReturnType<typeof vi.fn>
let audioTrack: { stop: () => void; readyState: "live" | "ended"; kind: "audio"; enabled: boolean } | null = null
let lastWorklet: { port: { onmessage: ((event: { data: unknown }) => void) | null } } | null = null
let audioWorkletAddModuleMock: ReturnType<typeof vi.fn>

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
  sendAudioMock = vi.fn()
  audioTrack = null
  lastWorklet = null
  audioWorkletAddModuleMock = vi.fn().mockResolvedValue(undefined)

  stopMock = vi.fn()

  const track = {
    stop: () => {},
    readyState: "live",
    kind: "audio",
    enabled: true,
  } satisfies { stop: () => void; readyState: "live" | "ended"; kind: "audio"; enabled: boolean }
  audioTrack = track

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
    audioWorklet = { addModule: audioWorkletAddModuleMock }
    destination = {}
    resume = vi.fn().mockResolvedValue(undefined)
    close = vi.fn().mockResolvedValue(undefined)
    createMediaStreamSource = vi.fn(() => ({ connect: vi.fn() }))
  }

  class MockAudioWorkletNode {
    port = { onmessage: null as ((event: { data: unknown }) => void) | null, postMessage: vi.fn() }
    constructor(public context: unknown, public name: string) {
      // Expose the most recently created instance for tests to drive onmessage.
      lastWorklet = { port: this.port }
    }
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
          sendAudio: sendAudioMock,
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

  it("starts a new user message after an assistant reply even without VAD speech-start", async () => {
    const { result } = renderHook(() => useCheckIn())

    await act(async () => {
      await result.current[1].startSession()
    })

    expect(geminiCallbacks?.onUserTranscript).toEqual(expect.any(Function))
    expect(geminiCallbacks?.onTurnComplete).toEqual(expect.any(Function))

    act(() => {
      geminiCallbacks?.onUserTranscript?.("What do you mean as the year winds down?", false)
    })

    act(() => {
      geminiCallbacks?.onTurnComplete?.()
    })

    act(() => {
      geminiCallbacks?.onUserTranscript?.("Pretty normal, I guess.", false)
    })

    const userMessages = result.current[0].messages.filter((msg) => msg.role === "user")
    expect(userMessages).toHaveLength(2)
    expect(userMessages[0]?.content).toContain("What do you mean")
    expect(userMessages[1]?.content).toContain("Pretty normal")
  })
})

describe("useCheckIn audio capture", () => {
  it("toggles mute by disabling and re-enabling the audio track", async () => {
    const { result } = renderHook(() => useCheckIn())

    await act(async () => {
      await result.current[1].startSession()
    })

    expect(audioTrack).not.toBeNull()
    expect(audioTrack?.enabled).toBe(true)
    expect(result.current[0].isMuted).toBe(false)

    act(() => {
      result.current[1].toggleMute()
    })

    expect(audioTrack?.enabled).toBe(false)
    expect(result.current[0].isMuted).toBe(true)

    act(() => {
      result.current[1].toggleMute()
    })

    expect(audioTrack?.enabled).toBe(true)
    expect(result.current[0].isMuted).toBe(false)
  })

  it("cleans up microphone tracks on unmount", async () => {
    const { result, unmount } = renderHook(() => useCheckIn())

    await act(async () => {
      await result.current[1].startSession()
    })

    stopMock.mockClear()
    unmount()
    expect(stopMock).toHaveBeenCalled()
  })

  it("streams audio chunks from the capture worklet to Gemini", async () => {
    const { result } = renderHook(() => useCheckIn())

    await act(async () => {
      await result.current[1].startSession()
    })

    expect(lastWorklet?.port.onmessage).toEqual(expect.any(Function))

    const pcm = new Int16Array([0, 1000, -1000, 0])
    act(() => {
      lastWorklet?.port.onmessage?.({ data: { type: "audio", pcm: pcm.buffer } })
    })

    expect(sendAudioMock).toHaveBeenCalledWith("base64audiodata==")
  })

  it("updates input audio levels from capture worklet audio", async () => {
    const { result } = renderHook(() => useCheckIn())

    await act(async () => {
      await result.current[1].startSession()
    })

    expect(result.current[0].audioLevels.input).toBe(0)

    const pcm = new Int16Array([0, 2000, -2000, 0])
    act(() => {
      lastWorklet?.port.onmessage?.({ data: { type: "audio", pcm: pcm.buffer } })
    })

    expect(result.current[0].audioLevels.input).toBeGreaterThan(0)
  })

  it("handles microphone permission denied errors gracefully", async () => {
    getUserMediaMock.mockRejectedValueOnce(new Error("NotAllowedError"))

    const { result } = renderHook(() => useCheckIn())

    await act(async () => {
      await result.current[1].startSession()
    })

    expect(result.current[0].state).toBe("error")
    expect(result.current[0].error).toContain("Failed to initialize audio capture")
  })

  it("handles audio worklet module load errors gracefully", async () => {
    audioWorkletAddModuleMock.mockRejectedValueOnce(new Error("module load failed"))

    const { result } = renderHook(() => useCheckIn())

    await act(async () => {
      await result.current[1].startSession()
    })

    expect(result.current[0].state).toBe("error")
    expect(result.current[0].error).toContain("Failed to initialize audio capture")
    expect(result.current[0].error).toContain("module load failed")
  })
})
