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

import {
  BreathingExerciseArgsSchema,
  JournalPromptArgsSchema,
  QuickActionsArgsSchema,
  ScheduleActivityArgsSchema,
  StressGaugeArgsSchema,
  validateServerMessage,
} from "./schemas"
import { getGeminiApiKey } from "@/lib/utils"
import { logDebug, logWarn, logError } from "@/lib/logger"
import type {
  BreathingExerciseToolArgs,
  JournalPromptToolArgs,
  QuickActionsToolArgs,
  ScheduleActivityToolArgs,
  StressGaugeToolArgs,
} from "@/lib/types"
import type {
  SystemContextSummary,
  SystemTimeContext,
} from "./live-prompts"

// Context for AI-initiated conversations
export interface SessionContext {
  contextSummary?: SystemContextSummary
  timeContext?: SystemTimeContext
}

export type GeminiWidgetEvent =
  | { widget: "schedule_activity"; args: ScheduleActivityToolArgs }
  | { widget: "breathing_exercise"; args: BreathingExerciseToolArgs }
  | { widget: "stress_gauge"; args: StressGaugeToolArgs }
  | { widget: "quick_actions"; args: QuickActionsToolArgs }
  | { widget: "journal_prompt"; args: JournalPromptToolArgs }

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
  onUserTranscript: (text: string, finished: boolean) => void // Per SDK Transcription type
  onModelTranscript: (text: string, finished: boolean) => void // Per SDK Transcription type
  onModelThinking: (text: string) => void

  // Turn events
  onTurnComplete: () => void
  onInterrupted: () => void
  onUserSpeechStart: () => void
  onUserSpeechEnd: () => void

  // Tool/function calling
  onSilenceChosen: (reason: string) => void
  onWidget: (event: GeminiWidgetEvent) => void

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

  // Prevent duplicate onConnected firing (ready event + setupComplete message)
  private hasAnnouncedConnected = false
  private connectedSource: "ready-event" | "setupComplete" | null = null
  // Prevent duplicate onDisconnected firing
  private hasAnnouncedDisconnected = false

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

  // Silence mode - when model calls mute_audio_response, suppress all audio for current turn
  private silenceMode = false

  // Event deduplication - prevents HMR replay issues
  // Use persistent storage to survive HMR rebuilds
  private readonly DEDUP_STORAGE_KEY = "gemini_live_dedup_hashes"
  private processedEventHashes: Set<string>

  /**
   * Mark connection as ready and emit onConnected only once per session.
   * This protects against duplicate signals (e.g., initial SSE "ready" +
   * subsequent setupComplete message) which previously re-fired onConnected,
   * causing duplicate greetings and UI flicker.
   * Pattern doc: docs/error-patterns/gemini-double-greeting.md
   */
  private markConnected(source: "ready-event" | "setupComplete"): void {
    if (this.hasAnnouncedConnected) {
      logDebug(
        "GeminiLive",
        `Connected already signaled via ${this.connectedSource}, ignoring ${source}`
      )
      return
    }

    this.hasAnnouncedConnected = true
    this.connectedSource = source
    this.state = "ready"
    this.reconnectAttempts = 0
    this.consecutiveAudioFailures = 0
    this.hasAnnouncedDisconnected = false

    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId)
      this.connectionTimeoutId = null
    }

    this.config.events.onConnected?.()
  }

  /**
   * Announce disconnection once per session to avoid duplicate UI flips.
   */
  private notifyDisconnected(reason: string): void {
    if (this.hasAnnouncedDisconnected) return
    this.hasAnnouncedDisconnected = true
    this.config.events.onDisconnected?.(reason)
  }

  constructor(config: LiveClientConfig) {
    this.config = config

    // Load processed hashes from sessionStorage (survives HMR)
    try {
      const stored = sessionStorage.getItem(this.DEDUP_STORAGE_KEY)
      this.processedEventHashes = stored ? new Set(JSON.parse(stored)) : new Set()
    } catch (error) {
      logWarn("LiveClient", "Failed to load dedup hashes:", error)
      this.processedEventHashes = new Set()
    }
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
      logError("GeminiLive", "Max reconnection attempts reached")
      this.state = "error"
      this.config.events.onError?.(
        new Error(`Connection failed after ${this.maxReconnectAttempts} attempts`)
      )
      return
    }

    this.reconnectAttempts++
    const delay = this.getReconnectDelay()
    logDebug("GeminiLive", `Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    await new Promise((resolve) => setTimeout(resolve, delay))

    if (this.state === "error" || this.state === "disconnected") {
      try {
        await this.connect()
      } catch (error) {
        logError("GeminiLive", "Reconnection attempt failed:", error)
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
   * Check if connection is healthy for session preservation.
   * Returns true if connected and event source is active.
   */
  isConnectionHealthy(): boolean {
    return this.state === "ready" && this.eventSource !== null
  }

  /**
   * Detach event handlers without closing connection.
   * Used when preserving a session - keeps Gemini connection alive
   * but stops React component from receiving events.
   */
  detachEventHandlers(): void {
    this.config.events = {}
    logDebug("GeminiLive", "Event handlers detached for preservation")
  }

  /**
   * Reattach event handlers to an existing connection.
   * Used when resuming a preserved session.
   */
  reattachEventHandlers(events: Partial<LiveClientEvents>): void {
    this.config.events = events
    logDebug("GeminiLive", "Event handlers reattached")
  }

  /**
   * Get current session ID (for debugging/logging)
   */
  getSessionId(): string | null {
    return this.sessionId
  }

  /**
   * Connect to Gemini Live API via server
   *
   * @param context - Optional context for AI-initiated conversations
   *                  Includes contextSummary (from Gemini 3 analysis) and timeContext
   */
  async connect(context?: SessionContext): Promise<void> {
    if (this.state === "connecting" || this.state === "ready") {
      logWarn("GeminiLive", "Connect called while already connecting/ready - ignoring")
      return
    }

    // Reset connection flags for this attempt
    this.hasAnnouncedConnected = false
    this.hasAnnouncedDisconnected = false

    if (this.eventSource) {
      this.disconnect()
    }

    this.state = "connecting"
    this.config.events.onConnecting?.()

    try {
      // 1. Create session on server (include API key from settings if available)
      logDebug("GeminiLive", "Creating session...")
      const apiKey = await getGeminiApiKey()
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (apiKey) {
        headers["X-Gemini-Api-Key"] = apiKey
      }

      // Build request body with optional context for AI-initiated conversations
      const body: Record<string, unknown> = {}
      if (context?.contextSummary) {
        body.contextSummary = context.contextSummary
      }
      if (context?.timeContext) {
        body.timeContext = context.timeContext
      }

      const response = await fetch("/api/gemini/session", {
        method: "POST",
        headers,
        // Only include body if we have context to send
        ...(Object.keys(body).length > 0 ? { body: JSON.stringify(body) } : {}),
      })

      if (!response.ok) {
        let errorMessage = "Failed to create session"
        try {
          const error = await response.json()
          errorMessage = error.error || errorMessage
        } catch (parseError) {
          logError("GeminiLive", "Failed to parse error response:", parseError)
        }
        throw new Error(errorMessage)
      }

      const session: SessionInfo = await response.json()
      // SECURITY: never log the per-session secret (even in dev logs, it gets copy/pasted).
      logDebug("GeminiLive", "Received session metadata:", {
        sessionId: session.sessionId,
        streamUrl: session.streamUrl,
        hasSecret: Boolean(session.secret),
      })

      // Validate session response has required fields
      if (!session.sessionId || !session.streamUrl || !session.secret) {
        const missing = []
        if (!session.sessionId) missing.push('sessionId')
        if (!session.streamUrl) missing.push('streamUrl')
        if (!session.secret) missing.push('secret')
        throw new Error(`Invalid session response: missing ${missing.join(', ')}`)
      }

      this.sessionId = session.sessionId
      this.streamUrl = session.streamUrl
      this.audioUrl = session.audioUrl
      this.sessionSecret = session.secret

      logDebug("GeminiLive", "Session created:", this.sessionId)

      // 2. Connect to SSE stream
      await this.connectSSE()
    } catch (error) {
      logError("GeminiLive", "Connection failed:", error)
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
        logError("GeminiLive", "SSE stream error:", error)
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
      dispatchEvent: (event: MessageEvent) => {
        dispatch(event.type, typeof event.data === "string" ? event.data : JSON.stringify(event.data))
        return true
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

      logDebug("GeminiLive", "Connecting to SSE stream...")

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
            logDebug("GeminiLive", "Session ready (ready event)")
            this.markConnected("ready-event")
            resolve()
          })

          // Handle connected event (initial connection)
          this.eventSource.addEventListener("connected", (event) => {
            try {
              const data = JSON.parse(event.data)
              logDebug("GeminiLive", "Connected to session:", data.sessionId)
            } catch (error) {
              logError("GeminiLive", "Failed to parse connected event:", error)
            }
          })

          // Handle Gemini messages
          this.eventSource.addEventListener("message", (event) => {
            try {
              this.handleMessage(JSON.parse(event.data))
            } catch (error) {
              logError("GeminiLive", "Failed to parse message event:", error)
              this.config.events.onError?.(
                error instanceof Error ? error : new Error("Failed to parse message event")
              )
            }
          })

          // Handle errors from server
          this.eventSource.addEventListener("error", (event) => {
            // Verify it's a MessageEvent with data (server-sent error)
            if (!(event instanceof MessageEvent) || !event.data) {
              logError("GeminiLive", "SSE error event without data")
              this.state = "error"
              this.config.events.onError?.(new Error("Unknown SSE error"))
              this.notifyDisconnected("Unknown SSE error")
              return
            }
            try {
              const data = JSON.parse(event.data)
              const message =
                (data.message as string | undefined) ||
                (data.error?.message as string | undefined) ||
                "SSE error"
              this.state = "error"
              this.config.events.onError?.(new Error(message))
              this.notifyDisconnected(message)
            } catch {
              this.state = "error"
              this.config.events.onError?.(new Error("Invalid SSE error format"))
              this.notifyDisconnected("Invalid SSE error format")
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
            logDebug("GeminiLive", "Session closed:", reason)
            this.state = "disconnected"
            this.notifyDisconnected(reason)
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
          logError("GeminiLive", "SSE connection error:", error)
          this.state = "error"
          this.config.events.onError?.(error instanceof Error ? error : new Error("SSE connection failed"))
          this.notifyDisconnected("SSE connection failed")
          reject(error instanceof Error ? error : new Error("SSE connection failed"))
        })
    })
  }

  /**
   * Generate a hash for message deduplication
   * Prevents HMR event replay from processing same message multiple times
   */
  private hashMessage(message: Record<string, unknown>): string {
    // Hash based on message content to detect duplicates
    // Use JSON.stringify with sorted keys for consistent hashing
    return JSON.stringify(message, Object.keys(message).sort())
  }

  /**
   * Check if a message can be deduplicated
   * ONLY setupComplete should be deduplicated - it happens once per session
   * turnComplete MUST NOT be deduplicated - each turn is a new event!
   */
  private shouldDeduplicateMessage(message: Record<string, unknown>): boolean {
    // ONLY setupComplete is safe to deduplicate (once per session)
    // turnComplete MUST always be processed - each turn is unique!
    return !!message.setupComplete
  }

  /**
   * Handle incoming SSE messages
   */
  private handleMessage(message: Record<string, unknown>): void {
    // ONLY deduplicate pure turn signals (turnComplete/setupComplete with no content)
    // Everything else (audio, transcripts, tool calls) must always be processed
    if (this.shouldDeduplicateMessage(message)) {
      const hash = this.hashMessage(message)
      if (this.processedEventHashes.has(hash)) {
        logDebug("LiveClient", "Skipping duplicate event (HMR replay)")
        return
      }
      this.processedEventHashes.add(hash)

      // Persist to sessionStorage to survive HMR rebuilds
      try {
        sessionStorage.setItem(
          this.DEDUP_STORAGE_KEY,
          JSON.stringify(Array.from(this.processedEventHashes))
        )
      } catch (error) {
        logWarn("LiveClient", "Failed to persist dedup hashes:", error)
      }

      // Clear old hashes periodically to prevent memory leak (keep last 100)
      if (this.processedEventHashes.size > 100) {
        const hashes = Array.from(this.processedEventHashes)
        this.processedEventHashes = new Set(hashes.slice(-100))
        // Update sessionStorage with trimmed set
        try {
          sessionStorage.setItem(this.DEDUP_STORAGE_KEY, JSON.stringify(hashes.slice(-100)))
        } catch (error) {
          logWarn("LiveClient", "Failed to persist trimmed dedup hashes:", error)
        }
      }
    }

    // Validate message with Zod schema
    const validatedMessage = validateServerMessage(message)
    if (!validatedMessage) {
      logWarn("GeminiLive", "Invalid message received, skipping")
      return
    }

    // Setup complete
    if (validatedMessage.setupComplete) {
      logDebug("GeminiLive", "Setup complete")
      this.state = "ready"
      this.markConnected("setupComplete")
      return
    }

    // Server content (audio, text, turn signals)
    if (validatedMessage.serverContent) {
      this.handleServerContent(validatedMessage.serverContent as Record<string, unknown>)
      return
    }

    // Input transcription (at root level - legacy check)
    if (validatedMessage.inputTranscription) {
      const transcription = validatedMessage.inputTranscription
      if (transcription.text) {
        logDebug("LiveClient", "User transcript (root):", transcription.text, "finished:", transcription.finished)
        this.config.events.onUserTranscript?.(transcription.text, transcription.finished ?? false)
      }
      return
    }

    // Voice activity detection signal (user speech start/end)
    // Source: Context7 - /googleapis/js-genai docs - "VoiceActivityDetectionSignal"
    if (validatedMessage.voiceActivityDetectionSignal) {
      const vadType = validatedMessage.voiceActivityDetectionSignal.vadSignalType
      logDebug("LiveClient", "VAD signal:", vadType)
      if (vadType === "VAD_SIGNAL_TYPE_SOS") {
        this.config.events.onUserSpeechStart?.()
      } else if (vadType === "VAD_SIGNAL_TYPE_EOS") {
        this.config.events.onUserSpeechEnd?.()
      }
      return
    }

    // Tool call (function calling)
    // Source: Context7 - /googleapis/js-genai docs - "LiveServerToolCall"
    if (validatedMessage.toolCall) {
      this.handleToolCall(validatedMessage.toolCall as Record<string, unknown>)
      return
    }

    // Unknown message type
    logDebug("GeminiLive", "Unknown message:", validatedMessage)
  }

  /**
   * Handle tool call messages (function calling)
   * Source: Context7 - /googleapis/js-genai docs - "LiveServerToolCall"
   */
  private handleToolCall(toolCall: Record<string, unknown>): void {
    const functionCalls = toolCall.functionCalls as Array<{
      id: string
      name: string
      args?: Record<string, unknown>
    }> | undefined

    if (!functionCalls || functionCalls.length === 0) {
      logWarn("LiveClient", "Empty tool call received")
      return
    }

    for (const fc of functionCalls) {
      logDebug("LiveClient", "Function call:", fc.name, "args:", fc.args)

      if (fc.name === "mute_audio_response") {
        // Model chose silence - activate silence mode to suppress audio
        const reason = (fc.args?.reason as string) || "no reason provided"
        logDebug("LiveClient", "Model chose silence:", reason)

        // CRITICAL: Set silence mode to suppress all audio for this turn
        this.silenceMode = true

        this.config.events.onSilenceChosen?.(reason)

        // Send tool response to complete the turn
        this.sendToolResponse([{
          id: fc.id,
          name: fc.name,
          response: { acknowledged: true }
        }])
        continue
      }

      if (fc.name === "schedule_activity") {
        const parsed = ScheduleActivityArgsSchema.safeParse(fc.args ?? {})
        if (!parsed.success) {
          logWarn("LiveClient", "Invalid schedule_activity args:", parsed.error.issues)
          if (fc.id) {
            this.sendToolResponse([{
              id: fc.id,
              name: fc.name,
              response: { acknowledged: false, error: "invalid_args" }
            }])
          }
          continue
        }

        this.config.events.onWidget?.({ widget: "schedule_activity", args: parsed.data })

        if (fc.id) {
          this.sendToolResponse([{
            id: fc.id,
            name: fc.name,
            response: { acknowledged: true, shown: true }
          }])
        }
        continue
      }

      if (fc.name === "show_breathing_exercise") {
        const parsed = BreathingExerciseArgsSchema.safeParse(fc.args ?? {})
        if (!parsed.success) {
          logWarn("LiveClient", "Invalid show_breathing_exercise args:", parsed.error.issues)
          if (fc.id) {
            this.sendToolResponse([{
              id: fc.id,
              name: fc.name,
              response: { acknowledged: false, error: "invalid_args" }
            }])
          }
          continue
        }

        this.config.events.onWidget?.({ widget: "breathing_exercise", args: parsed.data })

        if (fc.id) {
          this.sendToolResponse([{
            id: fc.id,
            name: fc.name,
            response: { acknowledged: true, shown: true }
          }])
        }
        continue
      }

      if (fc.name === "show_stress_gauge") {
        const parsed = StressGaugeArgsSchema.safeParse(fc.args ?? {})
        if (!parsed.success) {
          logWarn("LiveClient", "Invalid show_stress_gauge args:", parsed.error.issues)
          if (fc.id) {
            this.sendToolResponse([{
              id: fc.id,
              name: fc.name,
              response: { acknowledged: false, error: "invalid_args" }
            }])
          }
          continue
        }

        this.config.events.onWidget?.({ widget: "stress_gauge", args: parsed.data })

        if (fc.id) {
          this.sendToolResponse([{
            id: fc.id,
            name: fc.name,
            response: { acknowledged: true, shown: true }
          }])
        }
        continue
      }

      if (fc.name === "show_quick_actions") {
        const parsed = QuickActionsArgsSchema.safeParse(fc.args ?? {})
        if (!parsed.success) {
          logWarn("LiveClient", "Invalid show_quick_actions args:", parsed.error.issues)
          if (fc.id) {
            this.sendToolResponse([{
              id: fc.id,
              name: fc.name,
              response: { acknowledged: false, error: "invalid_args" }
            }])
          }
          continue
        }

        this.config.events.onWidget?.({ widget: "quick_actions", args: parsed.data })

        if (fc.id) {
          this.sendToolResponse([{
            id: fc.id,
            name: fc.name,
            response: { acknowledged: true, shown: true }
          }])
        }
        continue
      }

      if (fc.name === "show_journal_prompt") {
        const parsed = JournalPromptArgsSchema.safeParse(fc.args ?? {})
        if (!parsed.success) {
          logWarn("LiveClient", "Invalid show_journal_prompt args:", parsed.error.issues)
          if (fc.id) {
            this.sendToolResponse([{
              id: fc.id,
              name: fc.name,
              response: { acknowledged: false, error: "invalid_args" }
            }])
          }
          continue
        }

        this.config.events.onWidget?.({ widget: "journal_prompt", args: parsed.data })

        if (fc.id) {
          this.sendToolResponse([{
            id: fc.id,
            name: fc.name,
            response: { acknowledged: true, shown: true }
          }])
        }
        continue
      } else {
        logWarn("LiveClient", "Unknown function call:", fc.name)
      }
    }
  }

  /**
   * Handle server content messages
   */
  private handleServerContent(content: Record<string, unknown>): void {
    // Handle input transcription (user's speech) - may come in serverContent
    const inputTranscription = content.inputTranscription as { text?: string; finished?: boolean } | undefined
    if (inputTranscription?.text) {
      this.config.events.onUserTranscript?.(inputTranscription.text, inputTranscription.finished ?? false)
    }

    // Handle output transcription (what model is ACTUALLY saying)
    // Source: Context7 - /googleapis/js-genai docs - "outputAudioTranscription"
    // Note: outputTranscription.finished indicates when transcription is complete
    // This is INDEPENDENT of turnComplete - they can arrive in any order
    const outputTranscription = content.outputTranscription as { text?: string; finished?: boolean } | undefined
    if (outputTranscription?.text) {
      this.config.events.onModelTranscript?.(
        outputTranscription.text ?? "",
        outputTranscription.finished ?? false
      )
    }

    // Check for interruption (barge-in)
    if (content.interrupted) {
      logDebug("GeminiLive", "Interrupted by user")
      this.config.events.onInterrupted?.()
      return
    }

    // Check for turn complete - reset silence mode
    if (content.turnComplete) {
      logDebug("GeminiLive", "Turn complete")

      // Reset silence mode for next turn
      if (this.silenceMode) {
        logDebug("LiveClient", "Resetting silence mode")
        this.silenceMode = false
      }

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
            // BUG FIX 3: Suppress audio when in silence mode
            if (this.silenceMode) {
              logDebug("LiveClient", "Suppressing audio chunk in silence mode")
              continue // Skip this audio chunk
            }
            this.config.events.onAudioChunk?.(inlineData.data)
          }
        }

        // Text response (chain-of-thought reasoning)
        // Note: This is NOT the actual speech - use outputTranscription for that
        if (part.text) {
          // BUG FIX 2: Sanitize control characters from text output
          const sanitizedText = (part.text as string).replace(/<ctrl\d+>/g, "")
          if (sanitizedText.trim()) {
            this.config.events.onModelThinking?.(sanitizedText)
          }
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
    logError(
      "GeminiLive",
      `Audio send failed (${this.consecutiveAudioFailures}/${this.MAX_AUDIO_FAILURES}):`,
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
      logWarn("GeminiLive", "Not ready to send text")
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
      logError("GeminiLive", "Failed to send text:", error)
      this.config.events.onSendError?.(
        error instanceof Error ? error : new Error(String(error)),
        "text"
      )
    })
  }

  /**
   * Send tool response back to Gemini
   * Used when model calls a function (e.g., stay_silent)
   * Source: Context7 - /googleapis/js-genai docs - "sendToolResponse"
   *
   * @param functionResponses - Array of function responses
   */
  private sendToolResponse(
    functionResponses: Array<{ id: string; name: string; response: Record<string, unknown> }>
  ): void {
    if (!this.isReady() || !this.sessionId || !this.sessionSecret) {
      logWarn("GeminiLive", "Not ready to send tool response")
      return
    }

    fetch("/api/gemini/live/tool-response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: this.sessionId,
        secret: this.sessionSecret,
        functionResponses,
      }),
    }).catch((error) => {
      logError("GeminiLive", "Failed to send tool response:", error)
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
      logError("GeminiLive", "Failed to send audio end:", error)
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

    // Reset connection signal guard for next session
    this.hasAnnouncedConnected = false
    this.connectedSource = null

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
        logError("GeminiLive", "Failed to close session:", error)
      })
    }

    // Clear deduplication hashes from sessionStorage
    try {
      sessionStorage.removeItem(this.DEDUP_STORAGE_KEY)
    } catch (error) {
      logWarn("LiveClient", "Failed to clear dedup hashes:", error)
    }

    this.sessionId = null
    this.streamUrl = null
    this.audioUrl = null
    this.sessionSecret = null

    // Only set to disconnected if not already in error state
    if (this.state !== "error") {
      this.state = "disconnected"
    }

    this.notifyDisconnected("Manual disconnect")
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
