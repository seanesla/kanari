// @vitest-environment jsdom

import "@testing-library/jest-dom"
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

type AudioPlaybackOptions = Parameters<typeof import("../use-audio-playback").useAudioPlayback>[0]
type GeminiHandlers = Parameters<typeof import("../use-gemini-live").useGeminiLive>[0]

let playbackOptions: AudioPlaybackOptions | null = null
let geminiHandlers: GeminiHandlers | null = null

const queueAudioMock = vi.fn()
const clearQueueMock = vi.fn()

beforeEach(async () => {
  playbackOptions = null
  geminiHandlers = null
  queueAudioMock.mockReset()
  clearQueueMock.mockReset()

  vi.resetModules()
  vi.unmock("@/hooks/use-gemini-live")
  vi.unmock("@/hooks/use-audio-playback")

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
          queueAudio: queueAudioMock,
          clearQueue: clearQueueMock,
          pause: vi.fn(),
          resume: vi.fn(),
          cleanup: vi.fn(),
        },
      ] as const
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

describe("useCheckIn interrupt", () => {
  it("interrupts assistant playback and suppresses further audio chunks until the next turn", async () => {
    const { useCheckIn } = await import("../use-check-in")
    const { result } = renderHook(() => useCheckIn())

    expect(playbackOptions).not.toBeNull()
    expect(geminiHandlers).not.toBeNull()

    act(() => {
      playbackOptions?.onPlaybackStart?.()
    })
    expect(result.current[0].state).toBe("assistant_speaking")

    act(() => {
      geminiHandlers?.onAudioChunk?.("base64-chunk-1")
    })
    expect(queueAudioMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      // @ts-expect-error - added in this change
      await result.current[1].interruptAssistant()
    })

    expect(clearQueueMock).toHaveBeenCalledTimes(1)
    expect(result.current[0].state).toBe("listening")

    act(() => {
      geminiHandlers?.onAudioChunk?.("base64-chunk-2")
    })
    expect(queueAudioMock).toHaveBeenCalledTimes(1)
  })
})

