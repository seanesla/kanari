/**
 * Tests for GeminiLiveClient
 *
 * Tests the fixes for:
 * - Audio failure tracking and disconnect
 * - Connection timeout cleanup
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest"
import { GeminiLiveClient, type LiveClientConfig } from "../live-client"

// Mock global fetch
global.fetch = vi.fn()

// Mock EventSource
class MockEventSource {
  url: string
  listeners: Map<string, Function[]>
  onopen: (() => void) | null = null
  onerror: ((event: Event) => void) | null = null
  readyState: number = 0

  static CLOSED = 2

  constructor(url: string) {
    this.url = url
    this.listeners = new Map()
  }

  addEventListener(event: string, handler: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(handler)
  }

  dispatchEvent(event: MessageEvent) {
    const handlers = this.listeners.get(event.type) || []
    handlers.forEach((handler) => handler(event))
  }

  close() {
    this.readyState = MockEventSource.CLOSED
  }
}

global.EventSource = MockEventSource as any

describe("GeminiLiveClient", () => {
  let client: GeminiLiveClient
  let mockConfig: LiveClientConfig
  let mockEventSource: MockEventSource

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Mock fetch for session creation
    ;(global.fetch as any).mockImplementation((url: string) => {
      if (url === "/api/gemini/session") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              sessionId: "test-session",
              streamUrl: "http://localhost/stream?sessionId=test-session",
              audioUrl: "http://localhost/audio",
              secret: "test-secret-abc123",
            }),
        })
      }
      // Default to success for other fetches
      return Promise.resolve({ ok: true })
    })

    mockConfig = {
      events: {
        onConnecting: vi.fn(),
        onConnected: vi.fn(),
        onDisconnected: vi.fn(),
        onError: vi.fn(),
        onAudioChunk: vi.fn(),
        onAudioEnd: vi.fn(),
        onUserTranscript: vi.fn(),
        onModelTranscript: vi.fn(),
        onModelThinking: vi.fn(),
        onTurnComplete: vi.fn(),
        onInterrupted: vi.fn(),
        onUserSpeechStart: vi.fn(),
        onUserSpeechEnd: vi.fn(),
      },
    }

    client = new GeminiLiveClient(mockConfig)
  })

  afterEach(() => {
    client.disconnect()
  })

  describe("audio failure tracking", () => {
    beforeEach(async () => {
      // Connect the client and simulate ready state
      const connectPromise = client.connect()

      // Wait a tick for EventSource to be created
      await new Promise((resolve) => setTimeout(resolve, 0))

      // Get the created EventSource
      mockEventSource = (client as any).eventSource

      // Simulate ready event
      mockEventSource.dispatchEvent(
        new MessageEvent("ready", { data: JSON.stringify({ status: "connected" }) })
      )

      await connectPromise
    })

    test("resets failure counter on successful send", async () => {
      // Send audio successfully
      client.sendAudio("base64audio")

      await new Promise((resolve) => setTimeout(resolve, 10))

      expect((client as any).consecutiveAudioFailures).toBe(0)
    })

    test("increments counter on failed send", async () => {
      // Mock fetch to fail
      ;(global.fetch as any).mockImplementation(() => Promise.resolve({ ok: false, status: 500 }))

      // Send audio (should fail)
      client.sendAudio("base64audio")

      await new Promise((resolve) => setTimeout(resolve, 10))

      expect((client as any).consecutiveAudioFailures).toBe(1)
    })

    test("disconnects after 3 consecutive failures", async () => {
      // Mock fetch to fail
      ;(global.fetch as any).mockImplementation(() => Promise.resolve({ ok: false, status: 500 }))

      // Send 3 audio chunks
      client.sendAudio("audio1")
      client.sendAudio("audio2")
      client.sendAudio("audio3")

      await new Promise((resolve) => setTimeout(resolve, 50))

      // Should have triggered error and disconnect
      expect(mockConfig.events.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Audio streaming failed after 3 attempts"),
        })
      )
      expect(client.getState()).toBe("error")
    })

    test("resets counter on successful send after failures", async () => {
      // Fail once
      ;(global.fetch as any).mockImplementationOnce(() =>
        Promise.resolve({ ok: false, status: 500 })
      )
      client.sendAudio("audio1")
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect((client as any).consecutiveAudioFailures).toBe(1)

      // Succeed
      ;(global.fetch as any).mockImplementationOnce(() => Promise.resolve({ ok: true }))
      client.sendAudio("audio2")
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect((client as any).consecutiveAudioFailures).toBe(0)
    })
  })

  describe("connection timeout", () => {
    test("clears timeout on successful connection", async () => {
      const connectPromise = client.connect()

      await new Promise((resolve) => setTimeout(resolve, 0))

      mockEventSource = (client as any).eventSource

      // Simulate ready event
      mockEventSource.dispatchEvent(
        new MessageEvent("ready", { data: JSON.stringify({ status: "connected" }) })
      )

      await connectPromise

      // Timeout should be cleared
      expect((client as any).connectionTimeoutId).toBeNull()
    })

    test("clears timeout on disconnect", async () => {
      const connectPromise = client.connect()

      await new Promise((resolve) => setTimeout(resolve, 0))

      mockEventSource = (client as any).eventSource
      mockEventSource.dispatchEvent(
        new MessageEvent("ready", { data: JSON.stringify({ status: "connected" }) })
      )

      await connectPromise

      client.disconnect()

      expect((client as any).connectionTimeoutId).toBeNull()
    })
  })

  describe("integration: connection lifecycle", () => {
    test("full connect flow - session creation to ready state", async () => {
      // Start connection
      const connectPromise = client.connect()

      // Should call onConnecting
      expect(mockConfig.events.onConnecting).toHaveBeenCalled()

      // Should transition to connecting state
      expect(client.getState()).toBe("connecting")

      await new Promise((resolve) => setTimeout(resolve, 0))

      // Should have created session
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/gemini/session",
        expect.objectContaining({
          method: "POST",
        })
      )

      // Get EventSource and simulate ready
      mockEventSource = (client as any).eventSource
      mockEventSource.dispatchEvent(
        new MessageEvent("ready", { data: JSON.stringify({ status: "connected" }) })
      )

      await connectPromise

      // Should call onConnected
      expect(mockConfig.events.onConnected).toHaveBeenCalled()

      // Should be in ready state
      expect(client.getState()).toBe("ready")
      expect(client.isReady()).toBe(true)
    })

    test("disconnect flow - cleanup and state transition", async () => {
      // Connect first
      const connectPromise = client.connect()
      await new Promise((resolve) => setTimeout(resolve, 0))

      mockEventSource = (client as any).eventSource
      mockEventSource.dispatchEvent(
        new MessageEvent("ready", { data: JSON.stringify({ status: "connected" }) })
      )

      await connectPromise

      expect(client.isReady()).toBe(true)

      // Disconnect
      client.disconnect()

      // Should transition to disconnected
      expect(client.getState()).toBe("disconnected")
      expect(client.isReady()).toBe(false)

      // Should call onDisconnected
      expect(mockConfig.events.onDisconnected).toHaveBeenCalledWith("Manual disconnect")
    })

    test("error during session creation", async () => {
      // Mock fetch to fail session creation
      ;(global.fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: "Server error" }),
        })
      )

      await expect(client.connect()).rejects.toThrow()

      expect(client.getState()).toBe("disconnected")
      expect(mockConfig.events.onError).toHaveBeenCalled()
    })

    test("prevents concurrent connections", async () => {
      const connect1 = client.connect()
      const connect2 = client.connect()

      await new Promise((resolve) => setTimeout(resolve, 0))

      mockEventSource = (client as any).eventSource
      mockEventSource.dispatchEvent(
        new MessageEvent("ready", { data: JSON.stringify({ status: "connected" }) })
      )

      await connect1
      await connect2

      // Should only create one session
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe("integration: SSE message handling", () => {
    beforeEach(async () => {
      const connectPromise = client.connect()
      await new Promise((resolve) => setTimeout(resolve, 0))

      mockEventSource = (client as any).eventSource
      mockEventSource.dispatchEvent(
        new MessageEvent("ready", { data: JSON.stringify({ status: "connected" }) })
      )

      await connectPromise
    })

    test("handles audio chunk message", () => {
      const audioData = "base64audiodata=="
      mockEventSource.dispatchEvent(
        new MessageEvent("audio", {
          data: JSON.stringify({
            serverContent: {
              modelTurn: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "audio/pcm",
                      data: audioData,
                    },
                  },
                ],
              },
            },
          }),
        })
      )

      expect(mockConfig.events.onAudioChunk).toHaveBeenCalledWith(audioData)
    })

    test("handles model transcript message", () => {
      const transcriptText = "I understand how you're feeling."
      mockEventSource.dispatchEvent(
        new MessageEvent("transcript", {
          data: JSON.stringify({
            serverContent: {
              outputTranscription: {
                text: transcriptText,
                finished: false,
              },
            },
          }),
        })
      )

      expect(mockConfig.events.onModelTranscript).toHaveBeenCalledWith(transcriptText)
    })

    test("handles user speech recognition", () => {
      const userText = "I'm feeling stressed"
      mockEventSource.dispatchEvent(
        new MessageEvent("transcript", {
          data: JSON.stringify({
            inputTranscription: {
              text: userText,
              isFinal: false,
            },
          }),
        })
      )

      expect(mockConfig.events.onUserTranscript).toHaveBeenCalledWith(userText, false)
    })

    test("handles final user transcript", () => {
      const userText = "I'm feeling stressed"
      mockEventSource.dispatchEvent(
        new MessageEvent("transcript", {
          data: JSON.stringify({
            inputTranscription: {
              text: userText,
              isFinal: true,
            },
          }),
        })
      )

      expect(mockConfig.events.onUserTranscript).toHaveBeenCalledWith(userText, true)
    })

    test("handles turnComplete signal", () => {
      mockEventSource.dispatchEvent(
        new MessageEvent("turnComplete", {
          data: JSON.stringify({
            serverContent: {
              turnComplete: true,
            },
          }),
        })
      )

      expect(mockConfig.events.onTurnComplete).toHaveBeenCalled()
      expect(mockConfig.events.onAudioEnd).toHaveBeenCalled()
    })

    test("handles interrupted signal", () => {
      mockEventSource.dispatchEvent(
        new MessageEvent("interrupted", {
          data: JSON.stringify({
            serverContent: {
              interrupted: true,
            },
          }),
        })
      )

      expect(mockConfig.events.onInterrupted).toHaveBeenCalled()
      expect(mockConfig.events.onAudioEnd).toHaveBeenCalled()
    })

    test("handles error message from server", () => {
      mockEventSource.dispatchEvent(
        new MessageEvent("error", {
          data: JSON.stringify({
            error: {
              code: 429,
              message: "Rate limit exceeded",
            },
          }),
        })
      )

      expect(mockConfig.events.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Rate limit exceeded"),
        })
      )
      expect(client.getState()).toBe("error")
    })

    test("handles malformed JSON gracefully", () => {
      mockEventSource.dispatchEvent(
        new MessageEvent("audio", {
          data: "not valid json",
        })
      )

      // Should log error but not crash
      expect(mockConfig.events.onError).toHaveBeenCalled()
    })
  })

  describe("integration: audio streaming", () => {
    beforeEach(async () => {
      const connectPromise = client.connect()
      await new Promise((resolve) => setTimeout(resolve, 0))

      mockEventSource = (client as any).eventSource
      mockEventSource.dispatchEvent(
        new MessageEvent("ready", { data: JSON.stringify({ status: "connected" }) })
      )

      await connectPromise
    })

    test("sends audio chunk successfully", async () => {
      const audioData = "base64pcmdata=="

      client.sendAudio(audioData)

      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost/audio",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining(audioData),
        })
      )
    })

    test("sends multiple audio chunks in sequence", async () => {
      client.sendAudio("chunk1")
      client.sendAudio("chunk2")
      client.sendAudio("chunk3")

      await new Promise((resolve) => setTimeout(resolve, 30))

      // Should have sent all 3 chunks
      const audioFetches = (global.fetch as any).mock.calls.filter(
        ([url]: [string]) => url === "http://localhost/audio"
      )
      expect(audioFetches.length).toBe(3)
    })

    test("sends audio end signal", async () => {
      client.sendAudioEnd()

      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost/audio",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"audioEnd":true'),
        })
      )
    })

    test("cannot send audio when disconnected", () => {
      client.disconnect()

      client.sendAudio("base64data")

      // Should not have sent any audio request
      const audioFetches = (global.fetch as any).mock.calls.filter(
        ([url]: [string]) => url === "http://localhost/audio"
      )
      expect(audioFetches.length).toBe(0)
    })
  })

  describe("integration: text injection", () => {
    beforeEach(async () => {
      const connectPromise = client.connect()
      await new Promise((resolve) => setTimeout(resolve, 0))

      mockEventSource = (client as any).eventSource
      mockEventSource.dispatchEvent(
        new MessageEvent("ready", { data: JSON.stringify({ status: "connected" }) })
      )

      await connectPromise
    })

    test("sends text message for context injection", async () => {
      const contextText = "User showed signs of stress during recording"

      client.sendText(contextText)

      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost/audio",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining(contextText),
        })
      )
    })

    test("injects mismatch context", async () => {
      const mismatchContext = "Detected mismatch: user says fine but sounds stressed"

      client.injectContext(mismatchContext)

      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost/audio",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining(mismatchContext),
        })
      )
    })
  })

  describe("integration: state management", () => {
    test("initial state is disconnected", () => {
      expect(client.getState()).toBe("disconnected")
      expect(client.isReady()).toBe(false)
    })

    test("state transitions: disconnected -> connecting -> ready", async () => {
      expect(client.getState()).toBe("disconnected")

      const connectPromise = client.connect()

      expect(client.getState()).toBe("connecting")

      await new Promise((resolve) => setTimeout(resolve, 0))

      mockEventSource = (client as any).eventSource
      mockEventSource.dispatchEvent(
        new MessageEvent("ready", { data: JSON.stringify({ status: "connected" }) })
      )

      await connectPromise

      expect(client.getState()).toBe("ready")
    })

    test("state transitions: ready -> disconnected on manual disconnect", async () => {
      const connectPromise = client.connect()
      await new Promise((resolve) => setTimeout(resolve, 0))

      mockEventSource = (client as any).eventSource
      mockEventSource.dispatchEvent(
        new MessageEvent("ready", { data: JSON.stringify({ status: "connected" }) })
      )

      await connectPromise

      expect(client.getState()).toBe("ready")

      client.disconnect()

      expect(client.getState()).toBe("disconnected")
    })

    test("state transitions: ready -> error on server error", async () => {
      const connectPromise = client.connect()
      await new Promise((resolve) => setTimeout(resolve, 0))

      mockEventSource = (client as any).eventSource
      mockEventSource.dispatchEvent(
        new MessageEvent("ready", { data: JSON.stringify({ status: "connected" }) })
      )

      await connectPromise

      expect(client.getState()).toBe("ready")

      // Simulate error from server
      mockEventSource.dispatchEvent(
        new MessageEvent("error", {
          data: JSON.stringify({
            error: {
              message: "Internal server error",
            },
          }),
        })
      )

      expect(client.getState()).toBe("error")
    })

    test("isReady() reflects connection state accurately", async () => {
      expect(client.isReady()).toBe(false)

      const connectPromise = client.connect()
      expect(client.isReady()).toBe(false)

      await new Promise((resolve) => setTimeout(resolve, 0))

      mockEventSource = (client as any).eventSource
      mockEventSource.dispatchEvent(
        new MessageEvent("ready", { data: JSON.stringify({ status: "connected" }) })
      )

      await connectPromise

      expect(client.isReady()).toBe(true)

      client.disconnect()

      expect(client.isReady()).toBe(false)
    })
  })

  describe("integration: error scenarios", () => {
    test("handles network error during session creation", async () => {
      ;(global.fetch as any).mockImplementationOnce(() => Promise.reject(new Error("Network error")))

      await expect(client.connect()).rejects.toThrow("Network error")

      expect(client.getState()).toBe("disconnected")
      expect(mockConfig.events.onError).toHaveBeenCalled()
    })

    test("handles server error response (5xx)", async () => {
      ;(global.fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 503,
          json: () => Promise.resolve({ error: "Server busy" }),
        })
      )

      await expect(client.connect()).rejects.toThrow()

      expect(mockConfig.events.onError).toHaveBeenCalled()
    })

    test("handles rate limiting (429)", async () => {
      ;(global.fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 429,
          json: () => Promise.resolve({ error: "Rate limit exceeded" }),
        })
      )

      await expect(client.connect()).rejects.toThrow()

      expect(mockConfig.events.onError).toHaveBeenCalled()
    })

    test("handles unauthorized error (401)", async () => {
      ;(global.fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: "Invalid API key" }),
        })
      )

      await expect(client.connect()).rejects.toThrow()

      expect(mockConfig.events.onError).toHaveBeenCalled()
    })
  })
})
