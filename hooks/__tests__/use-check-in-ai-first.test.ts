// @vitest-environment jsdom

import "@testing-library/jest-dom"
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

type AudioPlaybackOptions = Parameters<typeof import("../use-audio-playback").useAudioPlayback>[0]
type GeminiHandlers = Parameters<typeof import("../use-gemini-live").useGeminiLive>[0]
type CheckInAudioOptions = Parameters<typeof import("../use-check-in-audio").useCheckInAudio>[0]

let playbackOptions: AudioPlaybackOptions | null = null
let geminiHandlers: GeminiHandlers | null = null
let captureSendAudio: ((base64Audio: string) => void) | null = null

const geminiSendAudioMock = vi.fn()

beforeEach(async () => {
  playbackOptions = null
  geminiHandlers = null
  captureSendAudio = null
  geminiSendAudioMock.mockReset()

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
          clearQueue: vi.fn(),
          pause: vi.fn(),
          resume: vi.fn(),
          cleanup: vi.fn(),
        },
      ] as const
    },
  }))

  vi.doMock("../use-check-in-audio", () => ({
    useCheckInAudio: (options: CheckInAudioOptions) => {
      captureSendAudio = options.sendAudio
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
          sendAudio: geminiSendAudioMock,
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

describe("useCheckIn AI-first", () => {
  it("blocks user audio until the assistant starts speaking", async () => {
    const { useCheckIn } = await import("../use-check-in")

    renderHook(() => useCheckIn())

    expect(playbackOptions).not.toBeNull()
    expect(geminiHandlers).not.toBeNull()
    expect(captureSendAudio).toEqual(expect.any(Function))

    act(() => {
      captureSendAudio?.("user-audio-1")
    })
    expect(geminiSendAudioMock).toHaveBeenCalledTimes(0)

    act(() => {
      playbackOptions?.onPlaybackStart?.()
    })

    act(() => {
      captureSendAudio?.("user-audio-2")
    })
    expect(geminiSendAudioMock).toHaveBeenCalledTimes(1)
  })
})
