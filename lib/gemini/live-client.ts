/**
 * Gemini Live API Client
 *
 * Manages connection to server-side Gemini Live session for real-time
 * voice conversations. Uses SSE for receiving and POST for sending.
 *
 * Architecture:
 * - Server manages the actual Gemini session (API key stays server-side)
 * - Client receives audio/transcripts via Server-Sent Events (SSE)
 * - Client sends audio via POST requests
 *
 * Features:
 * - Audio streaming (16kHz PCM input, 24kHz PCM output)
 * - Real-time transcription
 * - Turn management (user speaking, model speaking)
 * - Barge-in support (user can interrupt model)
 * - Automatic reconnection with exponential backoff
 *
 * Source: Context7 - /googleapis/js-genai docs - "Live.connect"
 */

import { validateServerMessage } from "./schemas"

// Event types emitted by the client
export interface LiveClientEvents {
  // Connection state
  onConnecting: () => void
  onConnected: () => void
  onDisconnected: (reason: string) => void
  onError: (error: Error) => void

  // Audio events
  onAudioChunk: (base64Audio: string) => void
  onAudioEnd: () => void

  // Transcription events
  onUserTranscript: (text: string, isFinal: boolean) => void
  onModelTranscript: (text: string) => void
  onModelThinking: (text: string) => void

  // Turn events
  onTurnComplete: () => void
  onInterrupted: () => void
  onUserSpeechStart: () => void
  onUserSpeechEnd: () => void

  // Send failures
  onSendError: (error: Error, type: "audio" | "text" | "audioEnd") => void
}

export interface LiveClientConfig {
  // Event handlers
  events: Partial<LiveClientEvents>
}

export type LiveClientState =
  | "disconnected"
  | "connecting"
  | "ready"
  | "error"

// Session info returned from /api/gemini/session
interface SessionInfo {
  sessionId: string
  streamUrl: string
  audioUrl: string
  secret: string
}

/**
 * Gemini Live API Client
 *
 * Connects to server-managed Gemini session via SSE + POST.
 */
export class GeminiLiveClient {
  private eventSource: EventSource | null = null
  private config: LiveClientConfig
  private state: LiveClientState = "disconnected"
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3

  // Session info from server
  private sessionId: string | null = null
  private streamUrl: string | null = null
  private audioUrl: string | null = null
  private sessionSecret: string | null = null

  // Audio failure tracking
  private consecutiveAudioFailures = 0
  private readonly MAX_AUDIO_FAILURES = 3

  // Connection timeout tracking
  private connectionTimeoutId: ReturnType<typeof setTimeout> | null = null

  constructor(config: LiveClientConfig) {
    this.config = config
  }

  /**
   * Calculate reconnection delay with exponential backoff and jitter
   */
  private getReconnectDelay(): number {
    const baseDelay = 1000
    const maxDelay = 30000
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts), maxDelay)
    const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1)
    return exponentialDelay + jitter
  }

  /**
   * Attempt to reconnect after a connection failure
   */
  private async attemptReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[GeminiLive] Max reconnection attempts reached")
      this.state = "error"
      this.config.events.onError?.(
        new Error(`Connection failed after ${this.maxReconnectAttempts} attempts`)
      )
      return
    }

    this.reconnectAttempts++
    const delay = this.getReconnectDelay()
    console.log(`[GeminiLive] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    await new Promise((resolve) => setTimeout(resolve, delay))

    if (this.state === "error" || this.state === "disconnected") {
      try {
        await this.connect()
      } catch (error) {
        console.error("[GeminiLive] Reconnection attempt failed:", error)
      }
    }
  }

  /**
   * Get current connection state
   */
  getState(): LiveClientState {
    return this.state
  }

  /**
   * Check if client is ready to send/receive
   */
  isReady(): boolean {
    return this.state === "ready"
  }

  /**
   * Connect to Gemini Live API via server
   */
  async connect(): Promise<void> {
    if (this.eventSource) {
      this.disconnect()
    }

    this.state = "connecting"
    this.config.events.onConnecting?.()

    try {
      // 1. Create session on server
      console.log("[GeminiLive] Creating session...")
      const response = await fetch("/api/gemini/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        let errorMessage = "Failed to create session"
        try {
          const error = await response.json()
          errorMessage = error.error || errorMessage
        } catch (parseError) {
          console.error("[GeminiLive] Failed to parse error response:", parseError)
        }
        throw new Error(errorMessage)
      }

      const session: SessionInfo = await response.json()
      this.sessionId = session.sessionId
      this.streamUrl = session.streamUrl
      this.audioUrl = session.audioUrl
      this.sessionSecret = session.secret

      console.log("[GeminiLive] Session created:", this.sessionId)

      // 2. Connect to SSE stream
      await this.connectSSE()
    } catch (error) {
      console.error("[GeminiLive] Connection failed:", error)
      this.state = "error"
      const err = error instanceof Error ? error : new Error("Connection failed")
      this.config.events.onError?.(err)
      throw err
    }
  }

  /**
   * Create an SSE reader from a ReadableStream
   * Implements EventSource-like API for compatibility
   */
  private createSSEReader(
    body: ReadableStream<Uint8Array>,
    resolve: () => void,
    reject: (error: Error) => void
  ): EventSource {
    const decoder = new TextDecoder()
    const reader = body.getReader()
    let buffer = ""
    const eventListeners: Map<string, Array<(event: MessageEvent) => void>> = new Map()
    let isOpen = true

    const dispatch = (eventType: string, data: string) => {
      const listeners = eventListeners.get(eventType)
      if (listeners) {
        const event = new MessageEvent(eventType, { data })
        listeners.forEach((listener) => listener(event))
      }
    }

    const processLine = (line: string, currentEvent: { type: string; data: string }) => {
      if (line.startsWith("event:")) {
        currentEvent.type = line.slice(6).trim()
      } else if (line.startsWith("data:")) {
        currentEvent.data += line.slice(5).trim()
      }
    }

    const readStream = async () => {
      const currentEvent = { type: "message", data: "" }

      try {
        while (isOpen) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            if (line.trim() === "") {
              if (currentEvent.data) {
                dispatch(currentEvent.type, currentEvent.data)
                currentEvent.type = "message"
                currentEvent.data = ""
              }
            } else {
              processLine(line, currentEvent)
            }
          }
        }
      } catch (error) {
        console.error("[GeminiLive] SSE stream error:", error)
        reject(error instanceof Error ? error : new Error("Stream read error"))
      }
    }

    readStream()

    // Return EventSource-like object
    return {
      addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
        const fn = typeof listener === "function" ? listener : listener.handleEvent
        if (!eventListeners.has(type)) {
          eventListeners.set(type, [])
        }
        eventListeners.get(type)!.push(fn as (event: MessageEvent) => void)
      },
      removeEventListener: () => {},
      close: () => {
        isOpen = false
        reader.cancel()
      },
      onopen: null,
      onerror: null,
      onmessage: null,
      readyState: 1,
      url: "",
      withCredentials: false,
      CONNECTING: 0,
      OPEN: 1,
      CLOSED: 2,
      dispatchEvent: () => false,
    } as EventSource
  }

  /**
   * Connect to the SSE stream for receiving messages
   * Uses fetch with custom headers instead of EventSource for security
   */
  private connectSSE(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.streamUrl || !this.sessionSecret) {
        reject(new Error("No stream URL or session secret"))
        return
      }

      console.log("[GeminiLive] Connecting to SSE stream...")

      // Use fetch with custom headers for better security
      fetch(this.streamUrl, {
        method: "GET",
        headers: {
          "x-session-secret": this.sessionSecret,
          Accept: "text/event-stream",
        },
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`SSE connection failed: ${response.statusText}`)
          }

          if (!response.body) {
            throw new Error("SSE response has no body")
          }

          // Create a custom EventSource-like object for compatibility
          this.eventSource = this.createSSEReader(response.body, resolve, reject)

          // Handle ready event (session is ready)
          this.eventSource.addEventListener("ready", () => {
            console.log("[GeminiLive] Session ready")
            this.state = "ready"
            this.reconnectAttempts = 0
            this.consecutiveAudioFailures = 0 // Reset audio failure counter

            // Clear connection timeout
            if (this.connectionTimeoutId) {
              clearTimeout(this.connectionTimeoutId)
              this.connectionTimeoutId = null
            }

            this.config.events.onConnected?.()
            resolve()
          })

          // Handle connected event (initial connection)
          this.eventSource.addEventListener("connected", (event) => {
            try {
              const data = JSON.parse(event.data)
              console.log("[GeminiLive] Connected to session:", data.sessionId)
            } catch (error) {
              console.error("[GeminiLive] Failed to parse connected event:", error)
            }
          })

          // Handle Gemini messages
          this.eventSource.addEventListener("message", (event) => {
            try {
              this.handleMessage(JSON.parse(event.data))
            } catch (error) {
              console.error("[GeminiLive] Failed to parse message event:", error)
            }
          })

          // Handle errors from server
          this.eventSource.addEventListener("error", (event) => {
            // Verify it's a MessageEvent with data (server-sent error)
            if (!(event instanceof MessageEvent) || !event.data) {
              console.error("[GeminiLive] SSE error event without data")
              this.config.events.onError?.(new Error("Unknown SSE error"))
              return
            }
            try {
              const data = JSON.parse(event.data)
              this.config.events.onError?.(new Error(data.message || "SSE error"))
            } catch {
              this.config.events.onError?.(new Error("Invalid SSE error format"))
            }
          })

          // Handle close
          this.eventSource.addEventListener("close", (event) => {
            let reason = "Session closed"
            if (event instanceof MessageEvent && event.data) {
              try {
                const data = JSON.parse(event.data)
                reason = data.reason || reason
              } catch {
                // Use default reason if parsing fails
              }
            }
            console.log("[GeminiLive] Session closed:", reason)
            this.state = "disconnected"
            this.config.events.onDisconnected?.(reason)
          })

          // Set a timeout for initial connection
          this.connectionTimeoutId = setTimeout(() => {
            if (this.state === "connecting") {
              reject(new Error("Connection timeout"))
              this.disconnect()
            }
          }, 30000)
        })
        .catch((error) => {
          console.error("[GeminiLive] SSE connection error:", error)
          this.state = "error"
          this.config.events.onError?.(error instanceof Error ? error : new Error("SSE connection failed"))
          reject(error instanceof Error ? error : new Error("SSE connection failed"))
        })
    })
  }

  /**
   * Handle incoming SSE messages
   */
  private handleMessage(message: Record<string, unknown>): void {
    // Validate message with Zod schema
    const validatedMessage = validateServerMessage(message)
    if (!validatedMessage) {
      console.warn("[GeminiLive] Invalid message received, skipping")
      return
    }

    // Setup complete
    if (validatedMessage.setupComplete) {
      console.log("[GeminiLive] Setup complete")
      this.state = "ready"
      this.config.events.onConnected?.()
      return
    }

    // Server content (audio, text, turn signals)
    if (validatedMessage.serverContent) {
      this.handleServerContent(validatedMessage.serverContent as Record<string, unknown>)
      return
    }

    // Input transcription
    if (validatedMessage.inputTranscription) {
      const transcription = validatedMessage.inputTranscription
      if (transcription.text) {
        this.config.events.onUserTranscript?.(transcription.text, transcription.isFinal ?? false)
      }
      return
    }

    // Unknown message type
    console.log("[GeminiLive] Unknown message:", validatedMessage)
  }

  /**
   * Handle server content messages
   */
  private handleServerContent(content: Record<string, unknown>): void {
    // Handle output transcription (what model is ACTUALLY saying)
    // Source: Context7 - /googleapis/js-genai docs - "outputAudioTranscription"
    const outputTranscription = content.outputTranscription as { text?: string; finished?: boolean } | undefined
    if (outputTranscription?.text) {
      this.config.events.onModelTranscript?.(outputTranscription.text)
    }

    // Check for interruption (barge-in)
    if (content.interrupted) {
      console.log("[GeminiLive] Interrupted by user")
      this.config.events.onInterrupted?.()
      return
    }

    // Check for turn complete
    if (content.turnComplete) {
      console.log("[GeminiLive] Turn complete")
      this.config.events.onTurnComplete?.()
      this.config.events.onAudioEnd?.()
      return
    }

    // Process model turn content
    const modelTurn = content.modelTurn as { parts?: Array<Record<string, unknown>> } | undefined
    if (modelTurn?.parts) {
      for (const part of modelTurn.parts) {
        // Audio response
        const inlineData = part.inlineData as { mimeType?: string; data?: string } | undefined
        if (inlineData?.data) {
          if (inlineData.mimeType?.startsWith("audio/")) {
            this.config.events.onAudioChunk?.(inlineData.data)
          }
        }

        // Text response (chain-of-thought reasoning)
        // Note: This is NOT the actual speech - use outputTranscription for that
        if (part.text) {
          this.config.events.onModelThinking?.(part.text as string)
        }
      }
    }
  }

  /**
   * Send audio data to Gemini
   *
   * @param base64Audio - Base64 encoded PCM audio (16kHz, 16-bit, mono)
   */
  sendAudio(base64Audio: string): void {
    if (!this.isReady() || !this.sessionId || !this.audioUrl || !this.sessionSecret) {
      return
    }

    // Fire and forget - don't await to avoid blocking audio stream
    // But track failures to detect session death
    fetch(this.audioUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: this.sessionId,
        secret: this.sessionSecret,
        audio: base64Audio,
      }),
    })
      .then((response) => {
        if (response.ok) {
          this.consecutiveAudioFailures = 0
        } else {
          this.handleAudioFailure(new Error(`HTTP ${response.status}`))
        }
      })
      .catch((error) => {
        this.handleAudioFailure(error)
      })
  }

  /**
   * Handle audio send failure
   * Tracks consecutive failures and disconnects if threshold exceeded
   */
  private handleAudioFailure(error: Error): void {
    this.consecutiveAudioFailures++
    console.error(
      `[GeminiLive] Audio send failed (${this.consecutiveAudioFailures}/${this.MAX_AUDIO_FAILURES}):`,
      error
    )

    // Check if we've exceeded threshold and haven't already started disconnecting
    // This prevents race condition where multiple concurrent failures trigger disconnect multiple times
    if (
      this.consecutiveAudioFailures >= this.MAX_AUDIO_FAILURES &&
      this.state !== "error" &&
      this.state !== "disconnected"
    ) {
      this.state = "error"
      this.config.events.onError?.(
        new Error(`Audio streaming failed after ${this.MAX_AUDIO_FAILURES} attempts`)
      )
      this.disconnect()
    }
  }

  /**
   * Send text message to Gemini
   * Useful for injecting context (like mismatch detection results)
   *
   * @param text - Text message to send
   */
  sendText(text: string): void {
    if (!this.isReady() || !this.sessionId || !this.audioUrl || !this.sessionSecret) {
      console.warn("[GeminiLive] Not ready to send text")
      return
    }

    fetch(this.audioUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: this.sessionId,
        secret: this.sessionSecret,
        text,
      }),
    }).catch((error) => {
      console.error("[GeminiLive] Failed to send text:", error)
      this.config.events.onSendError?.(
        error instanceof Error ? error : new Error(String(error)),
        "text"
      )
    })
  }

  /**
   * Signal end of audio stream (user stopped speaking)
   */
  sendAudioEnd(): void {
    if (!this.isReady() || !this.sessionId || !this.audioUrl || !this.sessionSecret) return

    fetch(this.audioUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: this.sessionId,
        secret: this.sessionSecret,
        audioEnd: true,
      }),
    }).catch((error) => {
      console.error("[GeminiLive] Failed to send audio end:", error)
      this.config.events.onSendError?.(
        error instanceof Error ? error : new Error(String(error)),
        "audioEnd"
      )
    })
  }

  /**
   * Disconnect from Gemini Live API
   */
  disconnect(): void {
    // Close SSE connection
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }

    // Clear connection timeout if it exists
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId)
      this.connectionTimeoutId = null
    }

    // Close server session
    if (this.sessionId && this.sessionSecret) {
      fetch("/api/gemini/session", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.sessionId,
          secret: this.sessionSecret
        }),
      }).catch((error) => {
        console.error("[GeminiLive] Failed to close session:", error)
      })
    }

    this.sessionId = null
    this.streamUrl = null
    this.audioUrl = null
    this.sessionSecret = null

    // Only set to disconnected if not already in error state
    if (this.state !== "error") {
      this.state = "disconnected"
    }
  }

  /**
   * Update system instruction mid-session
   * Useful for injecting mismatch detection context
   */
  injectContext(contextText: string): void {
    this.sendText(`[CONTEXT UPDATE]\n${contextText}\n[END CONTEXT]`)
  }
}

/**
 * Create a new Gemini Live client instance
 */
export function createLiveClient(config: LiveClientConfig): GeminiLiveClient {
  return new GeminiLiveClient(config)
}
