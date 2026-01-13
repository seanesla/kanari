/**
 * Tests for GeminiLiveClient (browser WebSocket mode)
 *
 * Covers:
 * - connection lifecycle + readiness announcement
 * - buffering of early messages before connect() resolves
 * - audio send failure tracking/disconnect
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { GeminiLiveClient, type LiveClientConfig } from "../live-client"

// Mock IndexedDB-backed API key lookup (not available in Vitest environment)
vi.mock("@/lib/utils", () => ({
  getGeminiApiKey: vi.fn().mockResolvedValue("test-api-key"),
}))

type LiveConnectParams = {
  callbacks?: {
    onmessage?: (message: unknown) => void
  }
}

function getClientInternals(client: GeminiLiveClient): {
  consecutiveAudioFailures: number
  handleMessage: (message: unknown) => void
  handleServerContent: (content: unknown) => void
} {
  return client as unknown as {
    consecutiveAudioFailures: number
    handleMessage: (message: unknown) => void
    handleServerContent: (content: unknown) => void
  }
}

const mockSession = {
  sendRealtimeInput: vi.fn(),
  sendClientContent: vi.fn(),
  sendToolResponse: vi.fn(),
  close: vi.fn(),
}

let liveConnectMock: ReturnType<typeof vi.fn>

vi.mock("@google/genai", () => {
  liveConnectMock = vi.fn(async (params: LiveConnectParams) => {
    // Deliver a message before the connect() promise resolves to validate buffering.
    params?.callbacks?.onmessage?.({
      serverContent: {
        modelTurn: {
          parts: [{ inlineData: { mimeType: "audio/pcm", data: "early==" } }],
        },
      },
    })

    // Resolve on next tick.
    await Promise.resolve()
    return mockSession
  })

  class GoogleGenAI {
    live: { connect: typeof liveConnectMock }
    constructor(_opts: { apiKey: string }) {
      this.live = { connect: liveConnectMock }
    }
  }

  const Modality = { AUDIO: "AUDIO", TEXT: "TEXT" }
  const Type = { OBJECT: "OBJECT", STRING: "STRING", INTEGER: "INTEGER", ARRAY: "ARRAY" }

  return { GoogleGenAI, Modality, Type }
})

describe("GeminiLiveClient (browser WebSocket)", () => {
  let client: GeminiLiveClient
  let config: LiveClientConfig

  beforeEach(() => {
    vi.clearAllMocks()

    config = {
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
        onSilenceChosen: vi.fn(),
        onWidget: vi.fn(),
        onCommitment: vi.fn(),
        onSendError: vi.fn(),
      },
    }

    client = new GeminiLiveClient(config)
  })

  afterEach(() => {
    client.disconnect()
  })

  test("connects and announces readiness once", async () => {
    await client.connect()

    expect(config.events.onConnecting).toHaveBeenCalled()
    expect(config.events.onConnected).toHaveBeenCalledTimes(1)
    expect(client.getState()).toBe("ready")
    expect(client.isReady()).toBe(true)

    expect(liveConnectMock).toHaveBeenCalledTimes(1)
  })

  test("buffers messages delivered before connect() resolves", async () => {
    await client.connect()
    expect(config.events.onAudioChunk).toHaveBeenCalledWith("early==")
  })

  test("sendAudio uses Session.sendRealtimeInput and clears failure counter on success", async () => {
    await client.connect()

    client.sendAudio("base64pcm==")

    expect(mockSession.sendRealtimeInput).toHaveBeenCalledWith({
      audio: { data: "base64pcm==", mimeType: "audio/pcm;rate=16000" },
    })
    expect(getClientInternals(client).consecutiveAudioFailures).toBe(0)
  })

  test("disconnect closes the session and updates state", async () => {
    await client.connect()

    client.disconnect()

    expect(mockSession.close).toHaveBeenCalled()
    expect(client.getState()).toBe("disconnected")
    expect(config.events.onDisconnected).toHaveBeenCalledWith("Manual disconnect")
  })

  test("disconnect requested during connect closes the session after connect resolves", async () => {
    let resolveGate!: () => void
    const gate = new Promise<void>((resolve) => {
      resolveGate = resolve
    })

    liveConnectMock.mockImplementationOnce(async () => {
      await gate
      return mockSession
    })

    const connectPromise = client.connect()
    client.disconnect()

    resolveGate()
    await connectPromise

    expect(mockSession.close).toHaveBeenCalled()
    expect(client.getState()).toBe("disconnected")
  })

  test("audio send failures trigger onError after 3 throws and close the session", async () => {
    await client.connect()

    mockSession.sendRealtimeInput.mockImplementation(() => {
      throw new Error("ws send failed")
    })

    client.sendAudio("a1")
    client.sendAudio("a2")
    client.sendAudio("a3")

    expect(config.events.onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Audio streaming failed after"),
      })
    )
    expect(client.getState()).toBe("error")
    expect(mockSession.close).toHaveBeenCalled()
  })

  test("handles mute_audio_response tool call and suppresses all output for the turn", async () => {
    await client.connect()

    getClientInternals(client).handleMessage({
      toolCall: {
        functionCalls: [
          {
            id: "call_1",
            name: "mute_audio_response",
            args: { reason: "user requested silence" },
          },
        ],
      },
    })

    expect(config.events.onSilenceChosen).toHaveBeenCalledWith("user requested silence")
    expect(mockSession.sendToolResponse).toHaveBeenCalledWith({
      functionResponses: [
        {
          id: "call_1",
          name: "mute_audio_response",
          response: { acknowledged: true },
        },
      ],
    })

    ;(config.events.onModelTranscript as ReturnType<typeof vi.fn>).mockClear()
    ;(config.events.onModelThinking as ReturnType<typeof vi.fn>).mockClear()

    getClientInternals(client).handleServerContent({
      modelTurn: {
        parts: [
          { inlineData: { mimeType: "audio/pcm", data: "suppressed==" } },
          { text: "Let me check" },
          { text: "internal", thought: true },
        ],
      },
      outputTranscription: { text: "Let me check", finished: true },
    })

    expect(config.events.onAudioChunk).not.toHaveBeenCalledWith("suppressed==")
    expect(config.events.onModelTranscript).not.toHaveBeenCalled()
    expect(config.events.onModelThinking).not.toHaveBeenCalled()

    // After turnComplete, silence mode resets and output is allowed again.
    getClientInternals(client).handleServerContent({ turnComplete: true })
    getClientInternals(client).handleServerContent({
      modelTurn: { parts: [{ text: "Hello" }] },
    })
    expect(config.events.onModelTranscript).toHaveBeenCalledWith("Hello", false)
  })

  test("handles record_commitment tool call and acknowledges", async () => {
    await client.connect()

    getClientInternals(client).handleMessage({
      toolCall: {
        functionCalls: [
          {
            id: "call_2",
            name: "record_commitment",
            args: { content: "I'll take a walk tomorrow", category: "action", timeframe: "tomorrow" },
          },
        ],
      },
    })

    expect(config.events.onCommitment).toHaveBeenCalledWith({
      content: "I'll take a walk tomorrow",
      category: "action",
      timeframe: "tomorrow",
    })

    expect(mockSession.sendToolResponse).toHaveBeenCalledWith({
      functionResponses: [
        {
          id: "call_2",
          name: "record_commitment",
          response: { acknowledged: true, recorded: true },
        },
      ],
    })
  })

  test("streams model text parts as transcript and routes thought parts to thinking", async () => {
    await client.connect()

    getClientInternals(client).handleServerContent({
      modelTurn: {
        parts: [
          { text: "Hello " },
          { text: "internal", thought: true },
          { text: "world" },
        ],
      },
    })

    expect(config.events.onModelTranscript).toHaveBeenCalledWith("Hello ", false)
    expect(config.events.onModelThinking).toHaveBeenCalledWith("internal")
    expect(config.events.onModelTranscript).toHaveBeenCalledWith("world", false)
  })

  test("prefers model text output over outputTranscription (fallback after turnComplete)", async () => {
    await client.connect()

    getClientInternals(client).handleServerContent({
      modelTurn: { parts: [{ text: "Hi " }] },
      outputTranscription: { text: "gibberish", finished: false },
    })

    expect(config.events.onModelTranscript).toHaveBeenCalledWith("Hi ", false)
    expect(config.events.onModelTranscript).not.toHaveBeenCalledWith("gibberish", false)

    vi.clearAllMocks()

    getClientInternals(client).handleServerContent({ turnComplete: true })
    getClientInternals(client).handleServerContent({
      outputTranscription: { text: "audio transcript", finished: true },
    })

    expect(config.events.onModelTranscript).toHaveBeenCalledWith("audio transcript", true)
  })
})
