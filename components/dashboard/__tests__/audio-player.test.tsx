// @vitest-environment jsdom

import React from "react"
import "@testing-library/jest-dom"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, fireEvent, screen, waitFor } from "@testing-library/react"

let lastAudioContext: MockAudioContext | null = null

function setLastAudioContext(ctx: MockAudioContext) {
  lastAudioContext = ctx
}

class MockAudioBuffer {
  copyToChannel = vi.fn()
}

class MockAudioBufferSourceNode {
  buffer: unknown = null
  onended: null | (() => void) = null
  connect = vi.fn()
  start = vi.fn()
  stop = vi.fn(() => {
    this.onended?.()
  })
}

class MockAudioContext {
  state: "running" | "suspended" | "closed" = "running"
  currentTime = 0
  destination = {}
  createdSources: MockAudioBufferSourceNode[] = []

  constructor() {
    setLastAudioContext(this)
  }

  createBuffer = vi.fn(() => new MockAudioBuffer() as unknown as AudioBuffer)

  createBufferSource = vi.fn(() => {
    const source = new MockAudioBufferSourceNode()
    this.createdSources.push(source)
    return source as unknown as AudioBufferSourceNode
  })

  resume = vi.fn(async () => {})

  close = vi.fn(async () => {
    this.state = "closed"
  })
}

describe("AudioPlayer", () => {
  beforeEach(() => {
    lastAudioContext = null

    // @ts-expect-error - test doubles
    global.AudioContext = MockAudioContext

    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1))
    vi.stubGlobal("cancelAnimationFrame", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("seeks while playing without resetting playback to 0", async () => {
    const { AudioPlayer } = await import("../audio-player")

    const audioData = new Float32Array(16000)

    const { container } = render(
      <AudioPlayer
        audioData={audioData}
        sampleRate={16000}
        duration={10}
      />
    )

    const buttons = screen.getAllByRole("button")
    const playButton = buttons[0]
    expect(playButton).toBeDefined()

    await waitFor(() => {
      expect(playButton).not.toBeDisabled()
    })

    fireEvent.click(playButton)

    await waitFor(() => {
      expect(lastAudioContext?.createdSources.length).toBe(1)
    })

    const progressBar = container.querySelector("div.cursor-pointer") as HTMLDivElement | null
    expect(progressBar).not.toBeNull()

    vi.spyOn(progressBar!, "getBoundingClientRect").mockReturnValue({
      left: 0,
      width: 100,
      top: 0,
      right: 100,
      bottom: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    })

    fireEvent.click(progressBar!, { clientX: 50 })

    await waitFor(() => {
      expect(lastAudioContext?.createdSources.length).toBe(2)
    })

    const secondSource = lastAudioContext!.createdSources[1]
    expect(secondSource.start).toHaveBeenCalledWith(0, 5)
  })
})
