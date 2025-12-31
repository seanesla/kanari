/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

import { AudioRecorder, isRecordingSupported, requestMicrophonePermission } from "../recorder"

let getUserMediaMock: ReturnType<typeof vi.fn>
let lastWorklet: { port: { onmessage: ((event: { data: unknown }) => void) | null; postMessage: ReturnType<typeof vi.fn> } } | null = null

beforeEach(() => {
  lastWorklet = null

  const track = {
    stop: vi.fn(),
    readyState: "live",
    kind: "audio",
  }

  const stream = {
    getTracks: () => [track],
  }

  getUserMediaMock = vi.fn().mockResolvedValue(stream)
  Object.defineProperty(global.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: getUserMediaMock },
  })

  class MockAudioContext {
    state = "running" as const
    audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) }
    destination = {}
    createMediaStreamSource = vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() }))
    close = vi.fn().mockResolvedValue(undefined)
  }

  class MockAudioWorkletNode {
    port = { onmessage: null as ((event: { data: unknown }) => void) | null, postMessage: vi.fn() }
    constructor(public context: unknown, public name: string) {
      lastWorklet = { port: this.port }
    }
    connect = vi.fn()
    disconnect = vi.fn()
  }

  // @ts-expect-error - test doubles
  global.AudioContext = MockAudioContext
  // @ts-expect-error - test doubles
  global.AudioWorkletNode = MockAudioWorkletNode
})

describe("AudioRecorder", () => {
  it("starts recording and forwards chunks from the worklet", async () => {
    const onDataAvailable = vi.fn()
    const recorder = new AudioRecorder({ onDataAvailable })

    await recorder.start()

    expect(recorder.currentState).toBe("recording")
    expect(typeof lastWorklet?.port.onmessage).toBe("function")

    const chunk = new Float32Array([0.1, -0.1, 0.2])
    lastWorklet?.port.onmessage?.({ data: chunk })

    expect(onDataAvailable).toHaveBeenCalledWith(chunk)
  })

  it("stops recording, concatenates chunks, and resets to idle", async () => {
    const recorder = new AudioRecorder()

    await recorder.start()

    lastWorklet?.port.onmessage?.({ data: new Float32Array([0.1, 0.2]) })
    lastWorklet?.port.onmessage?.({ data: new Float32Array([0.3]) })

    const result = await recorder.stop()

    expect(result).toHaveLength(3)
    expect(result[0]).toBeCloseTo(0.1, 6)
    expect(result[1]).toBeCloseTo(0.2, 6)
    expect(result[2]).toBeCloseTo(0.3, 6)
    expect(recorder.currentState).toBe("idle")
    expect(lastWorklet?.port.postMessage).toHaveBeenCalledWith("stop")
  })

  it("throws when starting from a non-idle state", async () => {
    const recorder = new AudioRecorder()
    await recorder.start()
    await expect(recorder.start()).rejects.toThrow("Cannot start recording")
  })

  it("throws when stopping from a non-recording state", async () => {
    const recorder = new AudioRecorder()
    await expect(recorder.stop()).rejects.toThrow("Cannot stop recording")
  })
})

describe("recorder helpers", () => {
  it("isRecordingSupported reflects required browser APIs", () => {
    expect(isRecordingSupported()).toBe(true)
  })

  it("requestMicrophonePermission uses Permissions API when available", async () => {
    const query = vi.fn().mockResolvedValue({ state: "granted" })
    Object.defineProperty(global.navigator, "permissions", {
      configurable: true,
      value: { query },
    })

    const result = await requestMicrophonePermission()
    expect(result).toBe("granted")
    expect(query).toHaveBeenCalled()
  })

  it("requestMicrophonePermission falls back to getUserMedia when Permissions API is unavailable", async () => {
    Object.defineProperty(global.navigator, "permissions", {
      configurable: true,
      value: undefined,
    })

    const result = await requestMicrophonePermission()
    expect(result).toBe("granted")
    expect(getUserMediaMock).toHaveBeenCalled()
  })
})
