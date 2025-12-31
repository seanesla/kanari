// @vitest-environment node

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"

// The worklet registers itself via global registerProcessor. Capture the ctor so we can
// instantiate it in tests.
type WorkletMessageEvent = {
  data: {
    type: string
    pcm?: ArrayBuffer
  }
}

type PlaybackProcessorPort = {
  postMessage: ReturnType<typeof vi.fn>
  onmessage: ((event: WorkletMessageEvent) => void) | null
}

type PlaybackProcessorLike = {
  port: PlaybackProcessorPort
  queue: unknown[]
  droppedChunks?: number
}

type PlaybackProcessorCtor = new () => PlaybackProcessorLike

let PlaybackProcessorCtor: PlaybackProcessorCtor | undefined

describe("playback worklet buffering", () => {
  beforeEach(async () => {
    // Reset module cache so the worklet re-registers on each test
    vi.resetModules()
    PlaybackProcessorCtor = undefined

    // Minimal AudioWorkletProcessor stub for Node
    // @ts-expect-error - not present in Node
    global.AudioWorkletProcessor = class {
      port: PlaybackProcessorPort = { postMessage: vi.fn(), onmessage: null }
    }

    // Capture the processor class that playback.worklet.js registers
    // @ts-expect-error - registerProcessor is provided by the worklet runtime
    global.registerProcessor = (_name: string, ctor: PlaybackProcessorCtor) => {
      PlaybackProcessorCtor = ctor
    }

    await import("../../../public/playback.worklet.js")
  })

  afterEach(() => {
    // @ts-expect-error cleanup globals set for tests
    delete global.AudioWorkletProcessor
    // @ts-expect-error cleanup globals set for tests
    delete global.registerProcessor
  })

  it("does not drop audio when Gemini streams a long burst", () => {
    if (!PlaybackProcessorCtor) {
      throw new Error("playback.worklet.js did not register a processor")
    }

    const processor = new PlaybackProcessorCtor()
    const portPostMessage = processor.port.postMessage

    // Simulate >8s of audio (200 x 1024 samples @24kHz ≈ 8.5s)
    const chunk = new Int16Array(1024).fill(1)
    for (let i = 0; i < 200; i++) {
      // Each message includes an ArrayBuffer like the real worklet receives
      const bufferCopy = chunk.buffer.slice(0)
      processor.port.onmessage?.({ data: { type: "audio", pcm: bufferCopy } })
    }

    // With no dropping we should retain every chunk
    expect(processor.queue.length).toBe(200)
    expect(processor.droppedChunks ?? 0).toBe(0)

    const hasQueueFullMessage = portPostMessage.mock.calls.some(([payload]) => {
      if (typeof payload !== "object" || payload === null) return false
      return (payload as { type?: unknown }).type === "queueFull"
    })

    expect(hasQueueFullMessage).toBe(false)
  })
})
