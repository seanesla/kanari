/**
 * Gemini Live API Client
 *
 * Browser-first Gemini Live client for real-time voice conversations.
 *
 * Architecture:
 * - Browser connects directly to Gemini Live via WebSocket (no server session state)
 * - Audio/text/tool responses are sent over the same socket
 * - Fixes Vercel serverless instance sharding (in-memory sessions are not shared)
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
  CommitmentArgsSchema,
  GetJournalEntriesArgsSchema,
  JournalPromptArgsSchema,
  QuickActionsArgsSchema,
  ScheduleActivityArgsSchema,
  StressGaugeArgsSchema,
  validateServerMessage,
} from "./schemas"
import { getGeminiApiKey } from "@/lib/utils"
import { logDebug, logWarn, logError } from "@/lib/logger"
import type {
  AccountabilityMode,
  BreathingExerciseToolArgs,
  CommitmentToolArgs,
  JournalPromptToolArgs,
  QuickActionsToolArgs,
  ScheduleActivityToolArgs,
  StressGaugeToolArgs,
} from "@/lib/types"
import type {
  SystemContextSummary,
  SystemTimeContext,
} from "./live-prompts"
import type { Session } from "@google/genai"

// Gemini Live model (Dec 2025 native audio preview)
const LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"

// Context for AI-initiated conversations
export interface SessionContext {
  contextSummary?: SystemContextSummary
  timeContext?: SystemTimeContext
  voiceName?: string // Gemini TTS voice name (e.g., "Aoede", "Sulafat")
  accountabilityMode?: AccountabilityMode
  userName?: string
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

  // Feature fallbacks
  onAffectiveDialogFallback: (reason: string) => void

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
  onCommitment: (commitment: CommitmentToolArgs) => void

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

/**
 * Gemini Live API Client
 *
 * Connects directly from the browser via `@google/genai` Live WebSocket sessions.
 */
export class GeminiLiveClient {
  private config: LiveClientConfig
  private state: LiveClientState = "disconnected"
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3

  // Prevent duplicate onConnected firing (ready event + setupComplete message)
  private hasAnnouncedConnected = false
  private connectedSource: "ws-open" | "setupComplete" | null = null
  // Prevent duplicate onDisconnected firing
  private hasAnnouncedDisconnected = false

  // Live WebSocket session (browser direct)
  private session: Session | null = null
  private sessionId: string | null = null
  private disconnectRequestedDuringConnect = false
  private pendingMessages: Array<Record<string, unknown>> = []
  private isSessionInitialized = false

  // Audio failure tracking
  private consecutiveAudioFailures = 0
  private readonly MAX_AUDIO_FAILURES = 3

  // Connection timeout tracking
  private connectionTimeoutId: ReturnType<typeof setTimeout> | null = null

  // Silence mode - when model calls mute_audio_response, suppress all audio for current turn
  private silenceMode = false

  // Track whether we've received ordered text output this turn.
  // When available, prefer this over outputAudioTranscription which can be out-of-order.
  private hasTextOutputThisTurn = false

  // Event deduplication - prevents HMR replay issues
  // Use persistent storage to survive HMR rebuilds
  private readonly DEDUP_STORAGE_KEY = "gemini_live_dedup_hashes"
  private processedEventHashes: Set<string>

  /**
   * Mark connection as ready and emit onConnected only once per session.
   * This protects against duplicate signals (e.g., websocket open +
   * subsequent setupComplete message) which previously re-fired onConnected,
   * causing duplicate greetings and UI flicker.
   * Pattern doc: docs/error-patterns/gemini-double-greeting.md
   */
  private markConnected(source: "ws-open" | "setupComplete"): void {
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
    return this.state === "ready" && this.session !== null
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
   * Connect to Gemini Live API directly from the browser.
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
    this.disconnectRequestedDuringConnect = false
    this.pendingMessages = []
    this.isSessionInitialized = false
    this.hasTextOutputThisTurn = false

    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId)
      this.connectionTimeoutId = null
    }

    if (this.session) {
      this.disconnect()
    }

    this.state = "connecting"
    this.config.events.onConnecting?.()

    let connectPromise: Promise<Session> | null = null
    let createdSession: Session | null = null

    try {
      const apiKey = await getGeminiApiKey()
      // Demo mode can seed a placeholder key ("DEMO_MODE") to avoid forcing judges through Settings.
      // Treat it as "not configured" so we don't attempt a real Live connection with an invalid key.
      if (!apiKey || apiKey === "DEMO_MODE") {
        throw new Error("Gemini API key not configured. Please add your Gemini API key in Settings.")
      }

      const [{ GoogleGenAI, Modality }, { buildCheckInSystemInstruction, GEMINI_TOOLS }] = await Promise.all(
        [import("@google/genai"), import("./live-prompts")]
      )

      const systemInstruction = buildCheckInSystemInstruction(
        context?.contextSummary,
        context?.timeContext,
        context?.accountabilityMode,
        context?.userName
      )

      // Affective dialog is currently gated behind the Live API v1alpha.
      // Source: Context7 - /websites/ai_google_dev_gemini-api docs - "Enable Affective Dialog in Gemini Live API"
      // Pattern doc: docs/error-patterns/gemini-live-affective-dialog-version-drift.md
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          apiVersion: "v1alpha",
        },
      })

      // Build speechConfig if voice is specified
      // Source: Context7 - /googleapis/js-genai docs - "SpeechConfig Interface"
      const speechConfig = context?.voiceName
        ? {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: context.voiceName },
            },
          }
        : undefined

      const callbacks = {
        onopen: () => {
          logDebug("GeminiLive", "WebSocket opened")
        },
        onmessage: (msg: unknown) => {
          this.handleLiveServerMessage(msg)
        },
        onerror: (e: ErrorEvent) => {
          const message = e.message || "WebSocket error"
          logError("GeminiLive", "WebSocket error:", message)
          this.state = "error"
          this.config.events.onError?.(new Error(message))
          this.notifyDisconnected(message)
        },
        onclose: (e: CloseEvent) => {
          const reason = e.reason || "Session closed"
          logDebug("GeminiLive", "WebSocket closed:", reason)

          // Drop session state; user can reconnect to start a new session.
          this.session = null
          this.isSessionInitialized = false
          this.pendingMessages = []
          this.sessionId = null

          if (this.state !== "error") {
            this.state = "disconnected"
          }

          this.notifyDisconnected(reason)
        },
      }

      const baseLiveConfig = {
        responseModalities: [Modality.AUDIO],
        outputAudioTranscription: {},
        inputAudioTranscription: {},
        proactivity: { proactiveAudio: true },
        systemInstruction,
        tools: GEMINI_TOOLS,
        ...(speechConfig && { speechConfig }),
      }

      const isAffectiveDialogUnsupported = (error: unknown): boolean => {
        const message = error instanceof Error ? error.message : String(error)
        return message.includes("enableAffectiveDialog") && message.toLowerCase().includes("unknown name")
      }

      const clearConnectionTimeout = () => {
        if (!this.connectionTimeoutId) return
        clearTimeout(this.connectionTimeoutId)
        this.connectionTimeoutId = null
      }

      try {
        // Attempt #1: connect with affective dialog.
        clearConnectionTimeout()
        const timeoutMs = 30000
        const timeoutPromise = new Promise<never>((_, reject) => {
          this.connectionTimeoutId = setTimeout(() => {
            reject(new Error("Connection timeout"))
          }, timeoutMs)
        })

        connectPromise = ai.live.connect({
          model: LIVE_MODEL,
          config: {
            ...baseLiveConfig,
            enableAffectiveDialog: true,
          },
          callbacks,
        })

        createdSession = await Promise.race([connectPromise, timeoutPromise])
      } catch (error) {
        if (!isAffectiveDialogUnsupported(error)) {
          throw error
        }

        const message = error instanceof Error ? error.message : "Affective dialog unavailable"
        logWarn("GeminiLive", "Affective dialog unavailable; retrying without:", message)
        this.config.events.onAffectiveDialogFallback?.(message)

        // Attempt #2: connect without the unsupported field.
        clearConnectionTimeout()
        const timeoutMs = 30000
        const timeoutPromise = new Promise<never>((_, reject) => {
          this.connectionTimeoutId = setTimeout(() => {
            reject(new Error("Connection timeout"))
          }, timeoutMs)
        })

        connectPromise = ai.live.connect({
          model: LIVE_MODEL,
          config: baseLiveConfig,
          callbacks,
        })

        createdSession = await Promise.race([connectPromise, timeoutPromise])
      } finally {
        clearConnectionTimeout()
      }

      if (this.disconnectRequestedDuringConnect) {
        try {
          createdSession.close()
        } catch (closeError) {
          logWarn("GeminiLive", "Error closing session after canceled connect:", closeError)
        }
        this.state = "disconnected"
        this.notifyDisconnected("Manual disconnect")
        return
      }

      this.session = createdSession
      this.isSessionInitialized = true

      // We can safely announce readiness only after we have a Session instance.
      this.markConnected("ws-open")

      // Flush any early messages delivered before the Session resolved.
      if (this.pendingMessages.length > 0) {
        const queued = this.pendingMessages
        this.pendingMessages = []
        for (const msg of queued) {
          this.handleMessage(msg)
        }
      }
    } catch (error) {
      logError("GeminiLive", "Connection failed:", error)
      this.state = "error"
      const err = error instanceof Error ? error : new Error("Connection failed")
      this.config.events.onError?.(err)

      // Ensure we don't leak a socket if it opens after a timeout/error.
      this.disconnectRequestedDuringConnect = true
      if (createdSession) {
        try {
          createdSession.close()
        } catch {
          // best-effort
        }
      } else if (connectPromise) {
        void connectPromise.then((lateSession) => {
          try {
            lateSession.close()
          } catch {
            // best-effort
          }
        })
      }

      if (this.connectionTimeoutId) {
        clearTimeout(this.connectionTimeoutId)
        this.connectionTimeoutId = null
      }
      throw err
    }
  }

  /**
   * Handle an incoming LiveServerMessage from the SDK.
   * The SDK may deliver some messages before the `connect()` promise resolves,
   * so we buffer until `this.session` is set.
   */
  private handleLiveServerMessage(msg: unknown): void {
    if (!msg || typeof msg !== "object") return
    const message = msg as Record<string, unknown>

    if (this.disconnectRequestedDuringConnect) {
      return
    }

    if (!this.isSessionInitialized) {
      // Buffer until connect() resolves and `this.session` is available.
      this.pendingMessages.push(message)
      return
    }

    this.handleMessage(message)
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

      // SDK provides an object with sessionId; legacy SSE proxy emits boolean true.
      if (typeof validatedMessage.setupComplete === "object" && validatedMessage.setupComplete) {
        const maybeSessionId = (validatedMessage.setupComplete as Record<string, unknown>).sessionId
        if (typeof maybeSessionId === "string") {
          this.sessionId = maybeSessionId
        }
      }

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

      if (fc.name === "record_commitment") {
        const parsed = CommitmentArgsSchema.safeParse(fc.args ?? {})
        if (!parsed.success) {
          logWarn("LiveClient", "Invalid record_commitment args:", parsed.error.issues)
          if (fc.id) {
            this.sendToolResponse([{
              id: fc.id,
              name: fc.name,
              response: { acknowledged: false, error: "invalid_args" },
            }])
          }
          continue
        }

        this.config.events.onCommitment?.(parsed.data)

        if (fc.id) {
          this.sendToolResponse([{
            id: fc.id,
            name: fc.name,
            response: { acknowledged: true, recorded: true },
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

      if (fc.name === "get_journal_entries") {
        const parsed = GetJournalEntriesArgsSchema.safeParse(fc.args ?? {})
        if (!parsed.success) {
          logWarn("LiveClient", "Invalid get_journal_entries args:", parsed.error.issues)
          if (fc.id) {
            this.sendToolResponse([{
              id: fc.id,
              name: fc.name,
              response: { acknowledged: false, error: "invalid_args" }
            }])
          }
          continue
        }

        // Tool calls are async (IndexedDB read), so respond in the background.
        if (fc.id) {
          const limit = Math.max(1, Math.min(25, parsed.data.limit ?? 10))
          const offset = Math.max(0, Math.min(10_000, parsed.data.offset ?? 0))
          void (async () => {
            try {
              if (typeof indexedDB === "undefined") {
                this.sendToolResponse([{
                  id: fc.id!,
                  name: fc.name,
                  response: { acknowledged: false, error: "indexeddb_unavailable" }
                }])
                return
              }

              const { db, toJournalEntry } = await import("@/lib/storage/db")
              const settings = await db.settings.get("default")
              const allowed = settings?.shareJournalWithAi ?? false

              if (!allowed) {
                this.sendToolResponse([{
                  id: fc.id!,
                  name: fc.name,
                  response: { acknowledged: false, error: "sharing_disabled" }
                }])
                return
              }

              const truncateText = (text: string, maxChars: number) => {
                const cleaned = (text ?? "").trim()
                if (cleaned.length <= maxChars) return cleaned
                if (maxChars <= 3) return cleaned.slice(0, maxChars)
                return `${cleaned.slice(0, maxChars - 3)}...`
              }

              const total = await db.journalEntries.count()
              const rows = await db.journalEntries
                .orderBy("createdAt")
                .reverse()
                .offset(offset)
                .limit(limit)
                .toArray()
              const entries = rows.map(toJournalEntry).map((e) => ({
                ...e,
                prompt: truncateText(e.prompt, 180),
                content: truncateText(e.content, 800),
              }))

              const nextOffset = offset + entries.length
              const hasMore = nextOffset < total

              this.sendToolResponse([{
                id: fc.id!,
                name: fc.name,
                response: {
                  acknowledged: true,
                  entries,
                  totalEntries: total,
                  returned: entries.length,
                  offset,
                  nextOffset,
                  hasMore,
                  truncated: hasMore,
                }
              }])
            } catch (error) {
              const message = error instanceof Error ? error.message : "Failed to read journal"
              this.sendToolResponse([{
                id: fc.id!,
                name: fc.name,
                response: { acknowledged: false, error: "read_failed", message }
              }])
            }
          })()
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

    // Check for interruption (barge-in)
    if (content.interrupted) {
      logDebug("GeminiLive", "Interrupted by user")
      this.hasTextOutputThisTurn = false
      this.config.events.onInterrupted?.()
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
            // BUG FIX: Suppress ALL output when in silence mode (audio + text).
            // Pattern doc: docs/error-patterns/mute-audio-response-text-leak.md
            if (this.silenceMode) {
              logDebug("LiveClient", "Suppressing audio chunk in silence mode")
              continue // Skip this audio chunk
            }
            this.config.events.onAudioChunk?.(inlineData.data)
          }
        }

        if (part.text) {
          // If the model chose silence for this turn, ignore any text output (transcript or thoughts).
          // This prevents UI "leaks" like "Let me check" showing up while a message is marked skipped.
          // Pattern doc: docs/error-patterns/mute-audio-response-text-leak.md
          if (this.silenceMode) {
            logDebug("LiveClient", "Suppressing text chunk in silence mode")
            continue
          }
          // BUG FIX 2: Sanitize control characters from text output
          const sanitizedText = (part.text as string).replace(/<ctrl\d+>/g, "")
          if (sanitizedText.trim()) {
            const isThought = Boolean((part as { thought?: unknown }).thought)
            if (isThought) {
              this.config.events.onModelThinking?.(sanitizedText)
            } else {
              this.hasTextOutputThisTurn = true
              this.config.events.onModelTranscript?.(sanitizedText, false)
            }
          }
        }
      }
    }

    // Handle output transcription (usually derived from output audio).
    // Prefer ordered text parts when available.
    // Source: Context7 - /googleapis/js-genai docs - "outputAudioTranscription"
    // Note: outputTranscription.finished indicates when transcription is complete.
    // This is INDEPENDENT of turnComplete - they can arrive in any order.
    const outputTranscription = content.outputTranscription as { text?: string; finished?: boolean } | undefined
    if (outputTranscription?.text && !this.hasTextOutputThisTurn && !this.silenceMode) {
      this.config.events.onModelTranscript?.(
        outputTranscription.text ?? "",
        outputTranscription.finished ?? false
      )
    }

    // Check for turn complete - reset silence mode
    if (content.turnComplete) {
      logDebug("GeminiLive", "Turn complete")

      // Reset silence mode for next turn
      if (this.silenceMode) {
        logDebug("LiveClient", "Resetting silence mode")
        this.silenceMode = false
      }

      this.hasTextOutputThisTurn = false
      this.config.events.onTurnComplete?.()
      this.config.events.onAudioEnd?.()
      return
    }
  }

  /**
   * Send audio data to Gemini
   *
   * @param base64Audio - Base64 encoded PCM audio (16kHz, 16-bit, mono)
   */
  sendAudio(base64Audio: string): void {
    if (!this.isReady() || !this.session) {
      return
    }

    try {
      // SDK expects plain object with data + mimeType (NOT native Blob).
      this.session.sendRealtimeInput({
        audio: {
          data: base64Audio,
          mimeType: "audio/pcm;rate=16000",
        },
      })
      this.consecutiveAudioFailures = 0
    } catch (error) {
      this.handleAudioFailure(error instanceof Error ? error : new Error(String(error)))
    }
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
    if (!this.isReady() || !this.session) {
      logWarn("GeminiLive", "Not ready to send text")
      return
    }

    try {
      this.session.sendClientContent({
        turns: [{ role: "user", parts: [{ text }] }],
      })
    } catch (error) {
      logError("GeminiLive", "Failed to send text:", error)
      this.config.events.onSendError?.(
        error instanceof Error ? error : new Error(String(error)),
        "text"
      )
    }
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
    if (!this.isReady() || !this.session) {
      logWarn("GeminiLive", "Not ready to send tool response")
      return
    }

    try {
      this.session.sendToolResponse({ functionResponses })
    } catch (error) {
      logError("GeminiLive", "Failed to send tool response:", error)
    }
  }

  /**
   * Signal end of audio stream (user stopped speaking)
   */
  sendAudioEnd(): void {
    if (!this.isReady() || !this.session) return

    try {
      this.session.sendRealtimeInput({ audioStreamEnd: true })
    } catch (error) {
      logError("GeminiLive", "Failed to send audio end:", error)
      this.config.events.onSendError?.(
        error instanceof Error ? error : new Error(String(error)),
        "audioEnd"
      )
    }
  }

  /**
   * Disconnect from Gemini Live API
   */
  disconnect(): void {
    this.disconnectRequestedDuringConnect = true

    // Close active WebSocket session (if present)
    if (this.session) {
      try {
        this.session.close()
      } catch (error) {
        logWarn("GeminiLive", "Error closing session:", error)
      }
      this.session = null
    }

    this.isSessionInitialized = false
    this.pendingMessages = []

    // Reset connection signal guard for next session
    this.hasAnnouncedConnected = false
    this.connectedSource = null

    // Clear connection timeout if it exists
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId)
      this.connectionTimeoutId = null
    }

    // Clear deduplication hashes from sessionStorage
    try {
      sessionStorage.removeItem(this.DEDUP_STORAGE_KEY)
    } catch (error) {
      logWarn("LiveClient", "Failed to clear dedup hashes:", error)
    }

    this.sessionId = null

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
