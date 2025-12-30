// @vitest-environment node

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"

// The worklet registers itself via global registerProcessor. Capture the ctor so we can
// instantiate it in tests.
let PlaybackProcessorCtor: any

describe("playback worklet buffering", () => {
  beforeEach(async () => {
    // Reset module cache so the worklet re-registers on each test
    vi.resetModules()
    PlaybackProcessorCtor = undefined

    // Minimal AudioWorkletProcessor stub for Node
    // @ts-expect-error - not present in Node
    global.AudioWorkletProcessor = class {
      port = { postMessage: vi.fn(), onmessage: null as any }
    }

    // Capture the processor class that playback.worklet.js registers
    // @ts-expect-error - registerProcessor is provided by the worklet runtime
    global.registerProcessor = (_name: string, ctor: any) => {
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
    const processor = new PlaybackProcessorCtor()
    const portPostMessage = (processor as any).port.postMessage as ReturnType<typeof vi.fn>

    // Simulate >8s of audio (200 x 1024 samples @24kHz ≈ 8.5s)
    const chunk = new Int16Array(1024).fill(1)
    for (let i = 0; i < 200; i++) {
      // Each message includes an ArrayBuffer like the real worklet receives
      const bufferCopy = chunk.buffer.slice(0)
      ;(processor as any).port.onmessage?.({ data: { type: "audio", pcm: bufferCopy } })
    }

    // With no dropping we should retain every chunk
    expect((processor as any).queue.length).toBe(200)
    expect((processor as any).droppedChunks ?? 0).toBe(0)
    expect(
      portPostMessage.mock.calls.find(([payload]: [any]) => payload?.type === "queueFull")
    ).toBeUndefined()
  })
})
