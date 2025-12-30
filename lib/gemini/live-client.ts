/**
 * Gemini Live API WebSocket Client
 *
 * Manages bidirectional WebSocket connection to Gemini Live API
 * for real-time voice conversations.
 *
 * Features:
 * - Ephemeral token authentication
 * - Audio streaming (16kHz PCM input, 24kHz PCM output)
 * - Real-time transcription
 * - Turn management (user speaking, model speaking)
 * - Barge-in support (user can interrupt model)
 * - Automatic activity detection (VAD)
 *
 * Source: Context7 - /websites/ai_google_dev_api docs - "Live API"
 * https://ai.google.dev/gemini-api/docs/live
 */

import type {
  LiveAPISetupMessage,
  LiveAPIAudioMessage,
  LiveAPIServerContent,
} from "@/lib/types"

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

  // Turn events
  onTurnComplete: () => void
  onInterrupted: () => void
  onUserSpeechStart: () => void
  onUserSpeechEnd: () => void
}

export interface LiveClientConfig {
  // Ephemeral token for authentication
  token: string
  // WebSocket URL
  wsUrl: string
  // Model identifier
  model: string
  // System instruction for the conversation
  systemInstruction: string
  // Event handlers
  events: Partial<LiveClientEvents>
}

export type LiveClientState =
  | "disconnected"
  | "connecting"
  | "setup_sent"
  | "ready"
  | "error"

/**
 * Gemini Live API WebSocket Client
 */
export class GeminiLiveClient {
  private ws: WebSocket | null = null
  private config: LiveClientConfig
  private state: LiveClientState = "disconnected"
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private setupTimeoutId: ReturnType<typeof setTimeout> | null = null
  private static readonly SETUP_TIMEOUT_MS = 10000 // 10 seconds

  constructor(config: LiveClientConfig) {
    this.config = config
  }

  /**
   * Clear any pending setup timeout
   */
  private clearSetupTimeout(): void {
    if (this.setupTimeoutId) {
      clearTimeout(this.setupTimeoutId)
      this.setupTimeoutId = null
    }
  }

  /**
   * Calculate reconnection delay with exponential backoff and jitter
   */
  private getReconnectDelay(): number {
    // Base delay: 1s, doubles each attempt up to 30s max
    const baseDelay = 1000
    const maxDelay = 30000
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts), maxDelay)
    // Add jitter: ±25% to prevent thundering herd
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

    // Only reconnect if we're still in a reconnectable state
    if (this.state === "error" || this.state === "disconnected") {
      try {
        await this.connect()
      } catch (error) {
        // Connection failed, will trigger another reconnect attempt via onerror
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
   * Connect to Gemini Live API
   */
  async connect(): Promise<void> {
    if (this.ws) {
      this.disconnect()
    }

    this.state = "connecting"
    this.config.events.onConnecting?.()

    return new Promise((resolve, reject) => {
      try {
        // Connect with ephemeral token as query parameter
        // Source: https://ai.google.dev/gemini-api/docs/ephemeral-tokens
        const wsUrl = `${this.config.wsUrl}?access_token=${encodeURIComponent(this.config.token)}`
        this.ws = new WebSocket(wsUrl)

        this.ws.onopen = () => {
          console.log("[GeminiLive] WebSocket connected")
          this.sendSetupMessage()
          resolve()
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }

        this.ws.onerror = (event) => {
          console.error("[GeminiLive] WebSocket error:", event)
          this.state = "error"
          const error = new Error("WebSocket connection error")
          this.config.events.onError?.(error)
          reject(error)
          // Attempt reconnection
          this.attemptReconnect()
        }

        this.ws.onclose = (event) => {
          console.log("[GeminiLive] WebSocket closed:", event.code, event.reason)
          const wasReady = this.state === "ready"
          this.state = "disconnected"
          this.config.events.onDisconnected?.(event.reason || "Connection closed")

          // Attempt reconnection for unexpected closures (not normal close code 1000)
          // Only if we were previously ready (not during initial connection)
          if (wasReady && event.code !== 1000) {
            this.attemptReconnect()
          }
        }
      } catch (error) {
        this.state = "error"
        reject(error)
      }
    })
  }

  /**
   * Send setup message to configure the session
   */
  private sendSetupMessage(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error("[GeminiLive] Cannot send setup - WebSocket not open")
      return
    }

    this.state = "setup_sent"

    // Set up timeout for setup completion
    this.clearSetupTimeout()
    this.setupTimeoutId = setTimeout(() => {
      if (this.state === "setup_sent") {
        console.error("[GeminiLive] Setup timeout - no response from server")
        this.state = "error"
        const error = new Error("Connection setup timed out. Please try again.")
        this.config.events.onError?.(error)
        this.disconnect()
      }
    }, GeminiLiveClient.SETUP_TIMEOUT_MS)

    // Setup message structure per Gemini Live API spec
    const setupMessage: LiveAPISetupMessage = {
      setup: {
        model: `models/${this.config.model}`,
        systemInstruction: {
          parts: [{ text: this.config.systemInstruction }],
        },
        generationConfig: {
          responseModalities: ["AUDIO", "TEXT"],
        },
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false, // Enable server-side VAD
          },
        },
      },
    }

    this.ws.send(JSON.stringify(setupMessage))
    console.log("[GeminiLive] Setup message sent")
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data)

      // Setup complete
      if (message.setupComplete) {
        console.log("[GeminiLive] Setup complete")
        this.clearSetupTimeout()
        this.state = "ready"
        this.reconnectAttempts = 0 // Reset reconnect counter on successful connection
        this.config.events.onConnected?.()
        return
      }

      // Server content (audio, text, turn signals)
      if (message.serverContent) {
        this.handleServerContent(message as LiveAPIServerContent)
        return
      }

      // User activity detection
      if (message.realtimeInput?.activityStart) {
        this.config.events.onUserSpeechStart?.()
        return
      }

      if (message.realtimeInput?.activityEnd) {
        this.config.events.onUserSpeechEnd?.()
        return
      }

      // Transcription
      if (message.inputTranscription) {
        const { text, isFinal } = message.inputTranscription
        this.config.events.onUserTranscript?.(text, isFinal ?? false)
        return
      }

      // Unknown message type
      console.log("[GeminiLive] Unknown message:", message)
    } catch (error) {
      console.error("[GeminiLive] Failed to parse message:", error)
    }
  }

  /**
   * Handle server content messages
   */
  private handleServerContent(message: LiveAPIServerContent): void {
    const { serverContent } = message

    // Check for interruption (barge-in)
    if (serverContent.interrupted) {
      console.log("[GeminiLive] Interrupted by user")
      this.config.events.onInterrupted?.()
      return
    }

    // Check for turn complete
    if (serverContent.turnComplete) {
      console.log("[GeminiLive] Turn complete")
      this.config.events.onTurnComplete?.()
      this.config.events.onAudioEnd?.()
      return
    }

    // Process model turn content
    if (serverContent.modelTurn?.parts) {
      for (const part of serverContent.modelTurn.parts) {
        // Audio response
        if (part.inlineData) {
          const { mimeType, data } = part.inlineData
          if (mimeType.startsWith("audio/")) {
            this.config.events.onAudioChunk?.(data)
          }
        }

        // Text response (transcript of what model is saying)
        if (part.text) {
          this.config.events.onModelTranscript?.(part.text)
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
    if (!this.isReady()) {
      console.warn("[GeminiLive] Not ready to send audio")
      return
    }

    const audioMessage: LiveAPIAudioMessage = {
      realtimeInput: {
        audio: {
          mimeType: "audio/pcm;rate=16000",
          data: base64Audio,
        },
      },
    }

    this.ws?.send(JSON.stringify(audioMessage))
  }

  /**
   * Send text message to Gemini
   * Useful for injecting context (like mismatch detection results)
   *
   * @param text - Text message to send
   */
  sendText(text: string): void {
    if (!this.isReady()) {
      console.warn("[GeminiLive] Not ready to send text")
      return
    }

    const textMessage = {
      realtimeInput: {
        text,
      },
    }

    this.ws?.send(JSON.stringify(textMessage))
  }

  /**
   * Signal end of audio stream (user stopped speaking)
   */
  sendAudioEnd(): void {
    if (!this.isReady()) return

    const endMessage = {
      realtimeInput: {
        audioStreamEnd: true,
      },
    }

    this.ws?.send(JSON.stringify(endMessage))
  }

  /**
   * Disconnect from Gemini Live API
   */
  disconnect(): void {
    this.clearSetupTimeout()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.state = "disconnected"
  }

  /**
   * Update system instruction mid-session
   * Useful for injecting mismatch detection context
   */
  injectContext(contextText: string): void {
    // Send as a system-like text input that Gemini will consider
    // This is how we inject mismatch detection results
    this.sendText(`[CONTEXT UPDATE]\n${contextText}\n[END CONTEXT]`)
  }
}

/**
 * Create a new Gemini Live client instance
 */
export function createLiveClient(config: LiveClientConfig): GeminiLiveClient {
  return new GeminiLiveClient(config)
}
