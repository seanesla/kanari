// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

type WorkletQueueStatusMessage = {
  type: "queueStatus"
  queueLength: number
  bufferedSamples: number
}

type WorkletMessage =
  | WorkletQueueStatusMessage
  | { type: "bufferEmpty" }
  | { type: "cleared" }

type WorkletMessageEvent = { data: WorkletMessage }

let lastWorklet: {
  port: {
    onmessage: ((event: WorkletMessageEvent) => void) | null
    postMessage: ReturnType<typeof vi.fn>
  }
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
} | null = null

let audioWorkletAddModuleMock: ReturnType<typeof vi.fn>
let audioContextCloseMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  lastWorklet = null
  audioWorkletAddModuleMock = vi.fn().mockResolvedValue(undefined)
  audioContextCloseMock = vi.fn().mockResolvedValue(undefined)

  class MockAudioContext {
    state: string = "running"
    audioWorklet = { addModule: audioWorkletAddModuleMock }
    destination = {}
    resume = vi.fn(async () => {})
    close = vi.fn(async () => {
      this.state = "closed"
      await audioContextCloseMock()
    })
  }

  class MockAudioWorkletNode {
    port = {
      onmessage: null as ((event: WorkletMessageEvent) => void) | null,
      postMessage: vi.fn(),
    }
    connect = vi.fn()
    disconnect = vi.fn()
    constructor(public context: unknown, public name: string) {
      lastWorklet = { port: this.port, connect: this.connect, disconnect: this.disconnect }
    }
  }

  // @ts-expect-error - test doubles
  global.AudioContext = MockAudioContext
  // @ts-expect-error - test doubles
  global.AudioWorkletNode = MockAudioWorkletNode
})

describe("useAudioPlayback", () => {
  it("falls back to buffered playback when AudioWorklet is unavailable", async () => {
    let lastSource: {
      start: ReturnType<typeof vi.fn>
      stop: ReturnType<typeof vi.fn>
      connect: ReturnType<typeof vi.fn>
      onended: (() => void) | null
      buffer: unknown
    } | null = null

    class NoWorkletAudioContext {
      state: string = "running"
      destination = {}
      currentTime = 0
      resume = vi.fn(async () => {})
      suspend = vi.fn(async () => {})
      close = vi.fn(async () => {
        this.state = "closed"
      })
      createGain = vi.fn(() => ({
        gain: { value: 1 },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }))
      createBuffer = vi.fn((_channels: number, _length: number, _sampleRate: number) => ({
        copyToChannel: vi.fn(),
      }))
      createBufferSource = vi.fn(() => {
        const source = {
          start: vi.fn(),
          stop: vi.fn(),
          connect: vi.fn(),
          onended: null as (() => void) | null,
          buffer: null as unknown,
        }
        lastSource = source
        return source
      })
    }

    // @ts-expect-error - override globals for this test
    global.AudioContext = NoWorkletAudioContext
    // @ts-expect-error - simulate missing AudioWorkletNode
    global.AudioWorkletNode = undefined

    vi.resetModules()
    vi.unmock("@/hooks/use-audio-playback")
    const { useAudioPlayback } = await import("@/hooks/use-audio-playback")

    const onPlaybackStart = vi.fn()
    const onPlaybackEnd = vi.fn()

    const { result } = renderHook(() =>
      useAudioPlayback({ onPlaybackStart, onPlaybackEnd })
    )

    await act(async () => {
      await result.current[1].initialize()
    })

    expect(result.current[0].state).toBe("ready")
    expect(result.current[0].isReady).toBe(true)

    act(() => {
      result.current[1].queueAudio("AAA=")
    })

    expect(onPlaybackStart).toHaveBeenCalledTimes(1)
    expect(lastSource?.start).toHaveBeenCalled()
    expect(result.current[0].isPlaying).toBe(true)

    act(() => {
      lastSource?.onended?.()
    })

    expect(onPlaybackEnd).toHaveBeenCalledTimes(1)
    expect(result.current[0].isPlaying).toBe(false)
  })

  it("initializes and reacts to worklet queue status + buffer empty messages", async () => {
    vi.resetModules()
    vi.unmock("@/hooks/use-audio-playback")
    const { useAudioPlayback } = await import("@/hooks/use-audio-playback")

    const onPlaybackStart = vi.fn()
    const onPlaybackEnd = vi.fn()
    const onAudioLevel = vi.fn()

    const { result } = renderHook(() =>
      useAudioPlayback({ onPlaybackStart, onPlaybackEnd, onAudioLevel })
    )

    await act(async () => {
      await result.current[1].initialize()
    })

    expect(result.current[0].state).toBe("ready")
    expect(result.current[0].isReady).toBe(true)
    expect(audioWorkletAddModuleMock).toHaveBeenCalledWith("/playback.worklet.js")
    expect(typeof lastWorklet?.port.onmessage).toBe("function")

    act(() => {
      lastWorklet?.port.onmessage?.({ data: { type: "queueStatus", queueLength: 1, bufferedSamples: 5000 } })
    })

    expect(result.current[0].state).toBe("playing")
    expect(result.current[0].isPlaying).toBe(true)
    expect(result.current[0].queuedChunks).toBe(1)
    expect(result.current[0].bufferedSamples).toBe(5000)
    expect(result.current[0].audioLevel).toBeCloseTo(0.5, 6)
    expect(onAudioLevel).toHaveBeenCalledWith(0.5)
    expect(onPlaybackStart).toHaveBeenCalledTimes(1)

    act(() => {
      lastWorklet?.port.onmessage?.({ data: { type: "bufferEmpty" } })
    })

    expect(result.current[0].queuedChunks).toBe(0)
    expect(result.current[0].bufferedSamples).toBe(0)
    expect(result.current[0].isPlaying).toBe(false)
    expect(onPlaybackEnd).toHaveBeenCalledTimes(1)
  })

  it("queues audio chunks and forwards control messages to the worklet", async () => {
    vi.resetModules()
    vi.unmock("@/hooks/use-audio-playback")
    const { useAudioPlayback } = await import("@/hooks/use-audio-playback")

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const { result } = renderHook(() => useAudioPlayback())

    act(() => {
      result.current[1].queueAudio("base64==")
    })
    expect(warnSpy).toHaveBeenCalledWith("[useAudioPlayback] Not initialized, cannot queue audio")

    await act(async () => {
      await result.current[1].initialize()
    })

    act(() => {
      result.current[1].queueAudio("base64==")
    })

    const [payload, transfers] = lastWorklet?.port.postMessage.mock.calls.at(-1) ?? []
    expect(payload).toEqual(expect.objectContaining({ type: "audio" }))
    expect(transfers).toHaveLength(1)

    act(() => {
      result.current[1].pause()
    })
    expect(lastWorklet?.port.postMessage).toHaveBeenCalledWith({ type: "stop" })
    expect(result.current[0].state).toBe("ready")

    act(() => {
      result.current[1].resume()
    })
    expect(lastWorklet?.port.postMessage).toHaveBeenCalledWith({ type: "start" })
    expect(result.current[0].state).toBe("playing")

    act(() => {
      result.current[1].clearQueue()
    })
    expect(lastWorklet?.port.postMessage).toHaveBeenCalledWith({ type: "clear" })

    act(() => {
      lastWorklet?.port.onmessage?.({ data: { type: "cleared" } })
    })

    expect(result.current[0].queuedChunks).toBe(0)
    expect(result.current[0].bufferedSamples).toBe(0)
    expect(result.current[0].audioLevel).toBe(0)
  })

  it("throws and transitions to error when AudioContext closes during initialization", async () => {
    class ClosingAudioContext {
      state: string = "suspended"
      audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) }
      destination = {}
      resume = vi.fn(async () => {
        this.state = "closed"
      })
      close = vi.fn(async () => {
        this.state = "closed"
      })
    }

    // @ts-expect-error - override for this test
    global.AudioContext = ClosingAudioContext

    vi.resetModules()
    vi.unmock("@/hooks/use-audio-playback")
    const { useAudioPlayback } = await import("@/hooks/use-audio-playback")

    const { result } = renderHook(() => useAudioPlayback())

    await act(async () => {
      await expect(result.current[1].initialize()).rejects.toThrow("INITIALIZATION_ABORTED")
    })

    expect(result.current[0].state).toBe("error")
    expect(result.current[0].isReady).toBe(false)
    expect(result.current[0].error).toBe("INITIALIZATION_ABORTED")
  })

  it("prevents multiple onPlaybackStart callbacks when audio queue receives updates rapidly", async () => {
    vi.resetModules()
    vi.unmock("@/hooks/use-audio-playback")
    const { useAudioPlayback } = await import("@/hooks/use-audio-playback")

    const onPlaybackStart = vi.fn()
    const onPlaybackEnd = vi.fn()

    const { result } = renderHook(() =>
      useAudioPlayback({ onPlaybackStart, onPlaybackEnd })
    )

    await act(async () => {
      await result.current[1].initialize()
    })

    // Simulate rapid queue status messages (simulating multiple audio chunks arriving)
    act(() => {
      lastWorklet?.port.onmessage?.({ data: { type: "queueStatus", queueLength: 1, bufferedSamples: 5000 } })
    })
    expect(onPlaybackStart).toHaveBeenCalledTimes(1)

    // More queue status messages shouldn't trigger another onPlaybackStart
    act(() => {
      lastWorklet?.port.onmessage?.({ data: { type: "queueStatus", queueLength: 2, bufferedSamples: 10000 } })
    })
    expect(onPlaybackStart).toHaveBeenCalledTimes(1)

    act(() => {
      lastWorklet?.port.onmessage?.({ data: { type: "queueStatus", queueLength: 3, bufferedSamples: 15000 } })
    })
    expect(onPlaybackStart).toHaveBeenCalledTimes(1)

    // Buffer empty should trigger onPlaybackEnd
    act(() => {
      lastWorklet?.port.onmessage?.({ data: { type: "bufferEmpty" } })
    })
    expect(onPlaybackEnd).toHaveBeenCalledTimes(1)
  })

  it("does not queue audio when AudioContext is closed", async () => {
    vi.resetModules()
    vi.unmock("@/hooks/use-audio-playback")
    const { useAudioPlayback } = await import("@/hooks/use-audio-playback")

    const _errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const _warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const { result } = renderHook(() => useAudioPlayback())

    await act(async () => {
      await result.current[1].initialize()
    })

    // Close the audio context
    await act(async () => {
      result.current[1].cleanup()
    })

    // Try to queue audio - should silently fail or warn
    act(() => {
      result.current[1].queueAudio("base64==")
    })

    // Should not post message to a null worklet
    expect(lastWorklet?.port.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "audio" }),
      expect.anything()
    )
  })

  it("clears all queued audio on barge-in and prevents overlap", async () => {
    vi.resetModules()
    vi.unmock("@/hooks/use-audio-playback")
    const { useAudioPlayback } = await import("@/hooks/use-audio-playback")

    const onPlaybackStart = vi.fn()
    const onPlaybackEnd = vi.fn()

    const { result } = renderHook(() =>
      useAudioPlayback({ onPlaybackStart, onPlaybackEnd })
    )

    await act(async () => {
      await result.current[1].initialize()
    })

    // Start playback with queued audio
    act(() => {
      lastWorklet?.port.onmessage?.({ data: { type: "queueStatus", queueLength: 1, bufferedSamples: 5000 } })
    })
    expect(onPlaybackStart).toHaveBeenCalledTimes(1)

    // Simulate barge-in - clear queue
    act(() => {
      result.current[1].clearQueue()
    })
    expect(lastWorklet?.port.postMessage).toHaveBeenCalledWith({ type: "clear" })

    // Worklet confirms cleared
    act(() => {
      lastWorklet?.port.onmessage?.({ data: { type: "cleared" } })
    })
    expect(result.current[0].isPlaying).toBe(false)

    // Now queue new audio for the user's response
    act(() => {
      result.current[1].queueAudio("newAudio==")
    })

    // This should eventually trigger onPlaybackStart again (for the new response)
    // But it should have happened cleanly without audio overlap
    expect(lastWorklet?.port.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "audio" }),
      expect.anything()
    )
  })
})
