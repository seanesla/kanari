// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("useCheckIn startSession abort behavior", () => {
  it("does not initialize playback/capture after unmount during preflight", async () => {
    const fingerprint = createDeferred<string>()
    const playbackInitialize = vi.fn(async () => {})
    const playbackCleanup = vi.fn()
    const connectMock = vi.fn(async () => {})

    const track = {
      stop: vi.fn(),
      readyState: "live",
      kind: "audio",
      enabled: true,
    } satisfies { stop: () => void; readyState: "live" | "ended"; kind: "audio"; enabled: boolean }

    const stream = {
      getTracks: () => [track],
      getAudioTracks: () => [track],
    }

    const getUserMediaMock = vi.fn().mockResolvedValue(stream)
    Object.defineProperty(global.navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: getUserMediaMock },
    })

    vi.resetModules()
    vi.unmock("@/hooks/use-check-in")
    vi.unmock("@/hooks/use-gemini-live")
    vi.unmock("@/hooks/use-audio-playback")
    vi.unmock("@/lib/gemini/check-in-context")
    vi.unmock("@/lib/gemini/context-fingerprint")
    vi.unmock("@/lib/utils")

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
    }))

    vi.doMock("@/lib/gemini/context-fingerprint", () => ({
      computeContextFingerprint: vi.fn(async () => fingerprint.promise),
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

    const { useCheckIn } = await import("@/hooks/use-check-in")
    const { result, unmount } = renderHook(() => useCheckIn())

    let startPromise: Promise<void> | undefined
    act(() => {
      startPromise = result.current[1].startSession()
    })

    act(() => {
      unmount()
    })

    fingerprint.resolve("stub-fingerprint")

    await act(async () => {
      await startPromise
    })

    expect(playbackInitialize).not.toHaveBeenCalled()
    expect(getUserMediaMock).not.toHaveBeenCalled()
    expect(connectMock).not.toHaveBeenCalled()
    expect(playbackCleanup).not.toHaveBeenCalled()
  })
})

