// @vitest-environment jsdom

import { renderHook, act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

// --- Mocks (declare before importing hook) --------------------------------

let geminiCallbacks: any = null
const connectMock = vi.fn(async () => {})
const disconnectMock = vi.fn()

vi.mock("../use-gemini-live", () => ({
  useGeminiLive: (options: any) => {
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

const playbackInitialize = vi.fn(async () => {})
const playbackCleanup = vi.fn()

vi.mock("../use-audio-playback", () => ({
  useAudioPlayback: () => [
    {
      state: "ready",
      isReady: true,
      isPlaying: false,
      audioLevel: 0,
      queuedChunks: 0,
      bufferedSamples: 0,
      error: null,
    },
    {
      initialize: playbackInitialize,
      queueAudio: vi.fn(),
      clearQueue: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      cleanup: playbackCleanup,
    },
  ],
}))

vi.mock("@/lib/gemini/check-in-context", () => ({
  fetchCheckInContext: vi.fn(async () => ({ contextSummary: "stub" })),
  formatContextForAPI: vi.fn((data: any) => data),
}))

import { useCheckIn } from "../use-check-in"

// --- Test helpers -------------------------------------------------------

let stopMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  geminiCallbacks = null
  connectMock.mockClear()
  disconnectMock.mockClear()
  playbackInitialize.mockClear()
  playbackCleanup.mockClear()

  stopMock = vi.fn(() => {
    // Simulate browser setting readyState to ended after stop()
    track.readyState = "ended"
  })

  const track = { stop: stopMock, readyState: "live", kind: "audio", enabled: true }
  const stream = {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  }

  const getUserMedia = vi.fn().mockResolvedValue(stream)

  Object.defineProperty(global.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
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
    port = { onmessage: null as any, postMessage: vi.fn() }
    constructor(public context: any, public name: string) {}
    connect = vi.fn()
    disconnect = vi.fn()
  }

  // @ts-expect-error - assign test doubles
  global.AudioContext = MockAudioContext
  // @ts-expect-error - assign test doubles
  global.AudioWorkletNode = MockAudioWorkletNode
})

// --- Tests --------------------------------------------------------------

describe("useCheckIn microphone lifecycle", () => {
  it("stops microphone tracks when Gemini disconnects unexpectedly", async () => {
    const { result } = renderHook(() => useCheckIn())

    await act(async () => {
      await result.current[1].startSession()
    })

    // Ensure we only count stops triggered by the disconnect callback
    stopMock.mockReset()

    act(() => {
      geminiCallbacks?.onDisconnected?.("network lost")
    })

    expect(stopMock).toHaveBeenCalled()
  })
})
