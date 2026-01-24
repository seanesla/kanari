
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react"

import { beforeEach, describe, expect, it, vi } from "vitest"

import type { AudioFeatures } from "@/lib/types"

let useCheckIn: typeof import("../use-check-in").useCheckIn

type GeminiLiveCallbacks = {
  onConnected?: () => void
}

let geminiCallbacks: GeminiLiveCallbacks | null = null
let lastWorklet: { port: { onmessage: ((event: { data: unknown }) => void) | null } } | null = null

let connectMock: ReturnType<typeof vi.fn>
let disconnectMock: ReturnType<typeof vi.fn>

beforeEach(async () => {
  geminiCallbacks = null
  lastWorklet = null
  connectMock = vi.fn(async () => {
    geminiCallbacks?.onConnected?.()
  })
  disconnectMock = vi.fn()

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

  vi.doMock("@/lib/audio/processor", () => ({
    validateAudioData: vi.fn(() => true),
    processAudio: vi.fn(async () => ({
      features: {
        mfcc: Array(13).fill(0),
        spectralCentroid: 0,
        spectralFlux: 0,
        spectralRolloff: 0,
        rms: 0.001,
        zcr: 0,
        speechRate: 0,
        pauseRatio: 1,
        pauseCount: 0,
        avgPauseDuration: 0,
        pitchMean: 0,
        pitchStdDev: 0,
        pitchRange: 0,
      } as unknown as AudioFeatures,
      segments: [],
      metadata: { duration: 0.2, speechDuration: 0, processingTime: 1, vadEnabled: true },
    })),
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

  const preserved = await import("@/lib/gemini/preserved-session")
  preserved.clearPreservedSession()
})

describe("useCheckIn endSession (no speech)", () => {
  it("does not compute voice biomarkers if the user never speaks", async () => {
    const onSessionEnd = vi.fn()
    const { result } = renderHook(() => useCheckIn({ onSessionEnd }))

    await act(async () => {
      await result.current[1].startSession()
    })

    // Simulate mic capture with silence/noise (no transcript, no speech events).
    const pcm = new Int16Array(2048)
    act(() => {
      lastWorklet?.port.onmessage?.({ data: { type: "audio", pcm: pcm.buffer } })
    })

    await act(async () => {
      await result.current[1].endSession()
    })

    expect(disconnectMock).toHaveBeenCalled()
    expect(onSessionEnd).toHaveBeenCalledTimes(1)

    const ended = onSessionEnd.mock.calls[0]?.[0]
    expect(ended?.acousticMetrics).toBeUndefined()
  })
})
