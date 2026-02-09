// @vitest-environment jsdom

import "@testing-library/jest-dom"
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

type AudioPlaybackOptions = Parameters<typeof import("../use-audio-playback").useAudioPlayback>[0]
type GeminiHandlers = Parameters<typeof import("../use-gemini-live").useGeminiLive>[0]
type CheckInAudioOptions = Parameters<typeof import("../use-check-in-audio").useCheckInAudio>[0]

let playbackOptions: AudioPlaybackOptions | null = null
let geminiHandlers: GeminiHandlers | null = null
let checkInAudioOptions: CheckInAudioOptions | null = null

const clearQueueMock = vi.fn()

beforeEach(async () => {
  playbackOptions = null
  geminiHandlers = null
  checkInAudioOptions = null
  clearQueueMock.mockReset()

  vi.resetModules()
  vi.unmock("@/hooks/use-gemini-live")
  vi.unmock("@/hooks/use-audio-playback")
  vi.unmock("../use-check-in-audio")

  vi.doMock("@/hooks/use-audio-playback", () => ({
    useAudioPlayback: (options: AudioPlaybackOptions) => {
      playbackOptions = options
      return [
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
          initialize: vi.fn(async () => {}),
          queueAudio: vi.fn(),
          clearQueue: clearQueueMock,
          pause: vi.fn(),
          resume: vi.fn(),
          cleanup: vi.fn(),
        },
      ] as const
    },
  }))

  vi.doMock("../use-check-in-audio", () => ({
    useCheckInAudio: (options: CheckInAudioOptions) => {
      checkInAudioOptions = options
      return {
        initializeAudioCapture: vi.fn(async () => {}),
        cleanupAudioCapture: vi.fn(),
        toggleMute: vi.fn(),
        resetAudioChunks: vi.fn(),
        drainAudioChunks: vi.fn(() => []),
        resetCleanupRequestedFlag: vi.fn(),
        getSessionAudio: vi.fn(() => null),
      } as const
    },
  }))

  vi.doMock("@/hooks/use-gemini-live", () => ({
    useGeminiLive: (handlers: GeminiHandlers) => {
      geminiHandlers = handlers
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
})

describe("useCheckIn greeting interruption", () => {
  it("ignores noise-triggered barge-in while waiting for the first greeting audio", async () => {
    const { useCheckIn } = await import("../use-check-in")
    const { result } = renderHook(() => useCheckIn())

    expect(geminiHandlers).not.toBeNull()
    expect(checkInAudioOptions?.onUserBargeIn).toEqual(expect.any(Function))

    act(() => {
      geminiHandlers?.onConnected?.()
    })

    expect(result.current[0].state).toBe("ai_greeting")

    act(() => {
      checkInAudioOptions?.onUserBargeIn?.()
    })

    expect(clearQueueMock).not.toHaveBeenCalled()
    expect(result.current[0].state).toBe("ai_greeting")
  })

  it("does not clear greeting audio when interruptAssistant is called during ai_greeting", async () => {
    const { useCheckIn } = await import("../use-check-in")
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiHandlers?.onConnected?.()
    })

    expect(result.current[0].state).toBe("ai_greeting")

    act(() => {
      result.current[1].interruptAssistant()
    })

    expect(clearQueueMock).not.toHaveBeenCalled()
    expect(result.current[0].state).toBe("ai_greeting")
  })

  it("still interrupts normally when assistant audio is already playing", async () => {
    const { useCheckIn } = await import("../use-check-in")
    const { result } = renderHook(() => useCheckIn())

    expect(playbackOptions).not.toBeNull()
    expect(checkInAudioOptions?.onUserBargeIn).toEqual(expect.any(Function))

    act(() => {
      playbackOptions?.onPlaybackStart?.()
    })

    expect(result.current[0].state).toBe("assistant_speaking")

    act(() => {
      checkInAudioOptions?.onUserBargeIn?.()
    })

    expect(clearQueueMock).toHaveBeenCalledTimes(1)
    expect(result.current[0].state).toBe("user_speaking")
  })
})
