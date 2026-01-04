// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi, afterEach } from "vitest"

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe("useCheckIn startSession Gemini timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("surfaces a user-facing error instead of staying stuck when Gemini connect never resolves", async () => {
    const playbackInitialize = vi.fn(async () => {})
    const playbackCleanup = vi.fn()

    const connectNeverResolves = vi.fn(async () => {
      await new Promise<void>(() => {})
    })

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
    track.stop = vi.fn(() => {
      track.readyState = "ended"
    })

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
      constructor(public context: unknown, public name: string) {}
      connect = vi.fn()
      disconnect = vi.fn()
    }

    // @ts-expect-error - test doubles
    global.AudioContext = MockAudioContext
    // @ts-expect-error - test doubles
    global.AudioWorkletNode = MockAudioWorkletNode

    vi.resetModules()
    vi.unmock("@/hooks/use-check-in")

    vi.doMock("@/hooks/use-audio-playback", () => ({
      useAudioPlayback: vi.fn(() => [
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
      ]),
    }))

    vi.doMock("@/hooks/use-gemini-live", () => ({
      useGeminiLive: vi.fn(() => [
        {
          state: "connecting",
          isReady: false,
          isModelSpeaking: false,
          isUserSpeaking: false,
          userTranscript: "",
          modelTranscript: "",
          error: null,
        },
        {
          connect: connectNeverResolves,
          disconnect: vi.fn(),
          sendAudio: vi.fn(),
          sendText: vi.fn(),
          injectContext: vi.fn(),
          endAudioStream: vi.fn(),
          getClient: vi.fn(() => null),
          reattachToClient: vi.fn(),
        },
      ]),
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

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: "missing key" }),
      }))
    )

    const { useCheckIn } = await import("@/hooks/use-check-in")
    const { result } = renderHook(() => useCheckIn())

    let startPromise!: Promise<void>
    act(() => {
      startPromise = result.current[1].startSession()
    })

    // Gemini connect timeout is 45s (see hooks/use-check-in-session.ts).
    await act(async () => {
      // Let startSession progress through preflight steps before jumping time.
      await flushMicrotasks()
      await vi.advanceTimersByTimeAsync(45_000)
      await startPromise
    })

    expect(result.current[0].state).toBe("error")
    expect(result.current[0].error).toContain("Gemini connection timed out")
    expect(playbackCleanup).toHaveBeenCalled()
    expect(track.stop).toHaveBeenCalled()
  })
})
