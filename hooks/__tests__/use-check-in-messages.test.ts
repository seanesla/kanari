// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { AudioFeatures } from "@/lib/types"

let useCheckIn: typeof import("../use-check-in").useCheckIn

type GeminiLiveCallbacks = {
  onUserTranscript?: (text: string, isFinal: boolean) => void
  onUserSpeechEnd?: () => void
  onModelTranscript?: (text: string, isFinal: boolean) => void
  onTurnComplete?: () => void
  onSilenceChosen?: (reason: string) => void
}

let geminiCallbacks: GeminiLiveCallbacks | null = null
let lastWorklet: { port: { onmessage: ((event: { data: unknown }) => void) | null } } | null = null
let sendAudioMock: ReturnType<typeof vi.fn>
let injectContextMock: ReturnType<typeof vi.fn>
let detectMismatchMock: ReturnType<typeof vi.fn>
let shouldRunMismatchDetectionMock: ReturnType<typeof vi.fn>

beforeEach(async () => {
  geminiCallbacks = null
  lastWorklet = null
  sendAudioMock = vi.fn()
  injectContextMock = vi.fn()
  detectMismatchMock = vi.fn(() => ({ detected: true, confidence: 0.9 }))
  shouldRunMismatchDetectionMock = vi.fn(() => true)

  const track: { stop: () => void; readyState: "live" | "ended"; kind: "audio"; enabled: boolean } = {
    stop: () => {},
    readyState: "live",
    kind: "audio",
    enabled: true,
  }

  track.stop = () => {
    track.readyState = "ended"
  }

  const stream = {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  }

  Object.defineProperty(global.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
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
    constructor(public context: unknown, public name: string) {
      lastWorklet = { port: this.port }
    }
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
  vi.unmock("@/lib/audio/processor")
  vi.unmock("@/lib/gemini/mismatch-detector")

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
          sendAudio: sendAudioMock,
          sendText: vi.fn(),
          injectContext: injectContextMock,
          endAudioStream: vi.fn(),
          getClient: vi.fn(() => null),
          reattachToClient: vi.fn(),
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
    })),
    formatContextForAPI: vi.fn((data: unknown) => data),
  }))

  vi.doMock("@/lib/gemini/context-fingerprint", () => ({
    computeContextFingerprint: vi.fn(async () => "stub-fingerprint"),
  }))

  vi.doMock("@/lib/utils", () => ({
    createGeminiHeaders: vi.fn(async (existing?: HeadersInit) => existing ?? {}),
  }))

  vi.doMock("@/lib/audio/processor", () => ({
    processAudio: vi.fn(async () => ({
      features: { mfcc: [1, 2, 3] } as unknown as AudioFeatures,
      metadata: { duration: 0.2, speechDuration: 0.2, processingTime: 1, vadEnabled: false },
    })),
  }))

  vi.doMock("@/lib/gemini/mismatch-detector", () => ({
    detectMismatch: detectMismatchMock,
    shouldRunMismatchDetection: shouldRunMismatchDetectionMock,
    featuresToPatterns: vi.fn(() => ({ speechRate: 150, pauseRatio: 0.2 })),
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

describe("useCheckIn message handling", () => {
  it("adds a user message from transcript updates", () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onUserTranscript?.("Hello", false)
    })

    expect(result.current[0].messages).toHaveLength(1)
    expect(result.current[0].messages[0]?.role).toBe("user")
  })

  it("ignores empty text messages", () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      result.current[1].sendTextMessage("   ")
    })

    expect(result.current[0].messages).toHaveLength(0)
  })

  it("adds an assistant message from model transcript", () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onModelTranscript?.("Hi", false)
    })

    expect(result.current[0].messages).toHaveLength(1)
    expect(result.current[0].messages[0]?.role).toBe("assistant")
    expect(result.current[0].messages[0]?.isStreaming).toBe(true)
  })

  it("updates the streaming assistant transcript without duplication", () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onModelTranscript?.("Hello", false)
      geminiCallbacks?.onModelTranscript?.("Hello there", false)
    })

    expect(result.current[0].messages).toHaveLength(1)
    expect(result.current[0].messages[0]?.content).toBe("Hello there")
  })

  it("replaces the streaming assistant transcript when cumulative snapshots diverge", () => {
    const { result } = renderHook(() => useCheckIn())

    const first =
      "Hey, happy New Years Eve! It was good to see your mood improve after yesterday morning. How are you"
    const second =
      "Hey, happy New Year's Eve! It was good to see your mood improve after yesterday morning. How are you feeling as we head into the new year?"

    act(() => {
      geminiCallbacks?.onModelTranscript?.(first, false)
      geminiCallbacks?.onModelTranscript?.(second, false)
    })

    expect(result.current[0].messages).toHaveLength(1)
    expect(result.current[0].messages[0]?.content).toBe(second)
  })

  it("replaces the streaming assistant transcript when corrected snapshots revise earlier words", () => {
    const { result } = renderHook(() => useCheckIn())

    const first =
      "Hey, happy New Year's Eve! It was good to see your mood improve after yesterday morning. How are you feeling tonight?"
    const second =
      "Hey, happy New Year's Eve! It was great to see your mood improve after yesterday morning. How are you feeling tonight?"

    act(() => {
      geminiCallbacks?.onModelTranscript?.(first, false)
      geminiCallbacks?.onModelTranscript?.(second, false)
    })

    expect(result.current[0].messages).toHaveLength(1)
    expect(result.current[0].messages[0]?.content).toBe(second)
  })

  it("finalizes the streaming assistant message on turn completion", () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onModelTranscript?.("Hello", false)
    })

    expect(result.current[0].messages[0]?.isStreaming).toBe(true)

    act(() => {
      geminiCallbacks?.onTurnComplete?.()
    })

    expect(result.current[0].messages[0]?.isStreaming).toBe(false)
    expect(result.current[0].state).toBe("listening")
  })

  it("removes any assistant transcript and marks the user message when silence is chosen", () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onUserTranscript?.("just listen", false)
      geminiCallbacks?.onModelTranscript?.("Let me check", false)
    })

    expect(result.current[0].messages.some((m) => m.role === "assistant")).toBe(true)

    act(() => {
      geminiCallbacks?.onSilenceChosen?.("user requested silence")
    })

    expect(result.current[0].messages.some((m) => m.role === "assistant")).toBe(false)
    const userMessage = result.current[0].messages.find((m) => m.role === "user")
    expect(userMessage?.silenceTriggered).toBe(true)
  })

  it("merges user transcript updates into a single message", () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onUserTranscript?.("hello", false)
      geminiCallbacks?.onUserTranscript?.("hello world", false)
    })

    expect(result.current[0].messages).toHaveLength(1)
    expect(result.current[0].messages[0]?.content).toBe("hello world")
  })

  it("avoids duplicated words when user transcript updates overlap", () => {
    const { result } = renderHook(() => useCheckIn())

    act(() => {
      geminiCallbacks?.onUserTranscript?.("pretty okay", false)
      geminiCallbacks?.onUserTranscript?.("okay but normal", false)
    })

    expect(result.current[0].messages).toHaveLength(1)
    expect(result.current[0].messages[0]?.content).toBe("pretty okay but normal")
  })

  it("runs mismatch detection after user speech ends when audio is available", async () => {
    const { result } = renderHook(() => useCheckIn())

    await act(async () => {
      await result.current[1].startSession()
    })

    const pcm = new Int16Array([0, 1000, -1000, 0])
    act(() => {
      lastWorklet?.port.onmessage?.({ data: { type: "audio", pcm: pcm.buffer } })
    })

    act(() => {
      geminiCallbacks?.onUserTranscript?.("I'm fine.", false)
    })

    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      geminiCallbacks?.onUserSpeechEnd?.()
    })

    await waitFor(() => {
      expect(detectMismatchMock).toHaveBeenCalled()
      expect(result.current[0].latestMismatch).not.toBeNull()
    })
  })

  it("keeps assistant message streaming until onTurnComplete (prevents premature placeholder removal)", async () => {
    const { result } = renderHook(() => useCheckIn())

    await act(async () => {
      await result.current[1].startSession()
    })

    // Simulate multiple transcript chunks with finished: true
    // (Gemini Live API can send multiple finished chunks before turnComplete)
    act(() => {
      geminiCallbacks?.onModelTranscript?.("Hello ", true)
    })

    expect(result.current[0].messages[0]?.isStreaming).toBe(true)
    expect(result.current[0].messages[0]?.content).toBe("Hello ")

    // Second chunk with finished: true - should keep isStreaming: true
    act(() => {
      geminiCallbacks?.onModelTranscript?.("there", true)
    })

    expect(result.current[0].messages[0]?.isStreaming).toBe(true)
    expect(result.current[0].messages[0]?.content).toBe("Hello there")

    // Only turnComplete should finalize
    act(() => {
      geminiCallbacks?.onTurnComplete?.()
    })

    expect(result.current[0].messages[0]?.isStreaming).toBe(false)
  })

  it("injects mismatch context into Gemini when a mismatch is detected", async () => {
    const { result } = renderHook(() => useCheckIn())

    await act(async () => {
      await result.current[1].startSession()
    })

    const pcm = new Int16Array([0, 1000, -1000, 0])
    act(() => {
      lastWorklet?.port.onmessage?.({ data: { type: "audio", pcm: pcm.buffer } })
    })

    act(() => {
      geminiCallbacks?.onUserTranscript?.("I'm fine.", false)
    })

    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      geminiCallbacks?.onUserSpeechEnd?.()
    })

    await waitFor(() => {
      expect(injectContextMock).toHaveBeenCalledWith("Mismatch context")
    })
  })
})
