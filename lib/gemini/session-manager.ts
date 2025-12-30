/**
 * Gemini Live Session Manager
 *
 * Server-side singleton that manages Gemini Live API sessions.
 * Uses the SDK's ai.live.connect() for proper authentication.
 *
 * Architecture:
 * - Client calls /api/gemini/session to create a session
 * - Server creates Gemini session using SDK (API key stays server-side)
 * - Client receives audio via SSE, sends audio via POST
 * - Server proxies messages between client and Gemini
 *
 * NOTE: In-memory session state is not safe in serverless runtimes (e.g. Vercel) where
 * subsequent requests may land on different instances.
 * See: docs/error-patterns/serverless-in-memory-session-state.md
 *
 * Source: Context7 - /googleapis/js-genai docs - "Live.connect"
 */

import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai"
import { EventEmitter } from "events"
import { randomBytes, timingSafeEqual } from "crypto"
import { GEMINI_TOOLS } from "./live-prompts"
import { logDebug, logError } from "@/lib/logger"

// Session timeout: 30 minutes (matches Gemini session limit)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000

// Max concurrent sessions per server instance
const MAX_CONCURRENT_SESSIONS = 10

// Model for Live API (API key auth)
// Source: https://ai.google.dev/gemini-api/docs/models
// The only model that supports Live API (bidiGenerateContent) as of Dec 2025
const LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"

/**
 * Events emitted by a session
 */
export interface SessionEvents {
  message: (msg: LiveServerMessage) => void
  error: (error: Error) => void
  close: () => void
  ready: () => void
}

interface ManagedSession {
  session: Session
  emitter: EventEmitter
  createdAt: number
  timeoutId: ReturnType<typeof setTimeout>
  isReady: boolean
  secret: string
}

/**
 * Singleton manager for server-side Gemini Live sessions
 */
class GeminiSessionManager {
  private sessions = new Map<string, ManagedSession>()
  // Cache clients by API key to reuse connections
  private clients = new Map<string, GoogleGenAI>()

  /**
   * Get or create a Google GenAI client for the given API key
   */
  private getClient(apiKey: string): GoogleGenAI {
    // Check if we already have a client for this key
    let client = this.clients.get(apiKey)
    if (!client) {
      client = new GoogleGenAI({ apiKey })
      this.clients.set(apiKey, client)
    }
    return client
  }

  /**
   * Generate a secure session secret
   */
  private generateSessionSecret(): string {
    return randomBytes(32).toString("base64")
  }

  /**
   * Create a new Gemini Live session
   * Returns the session secret for client authentication
   * @param sessionId - Unique session identifier
   * @param systemInstruction - Optional system instruction for the session
   * @param apiKey - Gemini API key (from user settings or environment)
   */
  async createSession(
    sessionId: string,
    systemInstruction?: string,
    apiKey?: string
  ): Promise<{ sessionId: string; secret: string }> {
    // Check max sessions limit
    if (this.sessions.size >= MAX_CONCURRENT_SESSIONS) {
      // Try to clean up stale sessions first
      this.cleanupStaleSessions()

      if (this.sessions.size >= MAX_CONCURRENT_SESSIONS) {
        throw new Error("Maximum concurrent sessions reached")
      }
    }

    // Check if session already exists
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`)
    }

    // SECURITY: Require an explicit user-provided API key.
    // Avoid env fallbacks so public endpoints can't be used to burn shared quota.
    // See: docs/error-patterns/env-gemini-api-key-fallback.md
    if (!apiKey) {
      throw new Error("Gemini API key not configured. Please add your API key in Settings.")
    }

    const ai = this.getClient(apiKey)
    const emitter = new EventEmitter()
    const secret = this.generateSessionSecret()

    logDebug("SessionManager", `Creating session ${sessionId}`)

    // Track ready state before session is stored in map
    // Note: Race condition handled via local isReady variable
    // - If onopen fires BEFORE sessions.set(): isReady becomes true, sessions.set() captures it
    // - If onopen fires AFTER sessions.set(): onopen updates managed.isReady directly
    // Both cases ensure the ready state is correctly propagated
    let isReady = false

    try {
      // Create Gemini Live session using SDK
      // Source: Context7 - /googleapis/js-genai docs - "Live.connect"
      // Note: Native audio model requires specific config
      const session = await ai.live.connect({
        model: LIVE_MODEL,
        config: {
          // Native audio model outputs audio by default
          responseModalities: [Modality.AUDIO],
          // Enable output transcription to get actual spoken words
          // Source: Context7 - /googleapis/js-genai docs - "outputAudioTranscription"
          outputAudioTranscription: {},
          // Enable input transcription to get user speech with isFinal flag
          // Source: Context7 - /googleapis/js-genai docs - "inputAudioTranscription"
          inputAudioTranscription: {},
          // System instruction as simple string
          ...(systemInstruction ? { systemInstruction } : {}),
          // Tools for function calling (intelligent silence)
          // Source: Context7 - /googleapis/js-genai docs - "tools config"
          tools: GEMINI_TOOLS,
        },
        callbacks: {
          onopen: () => {
            logDebug("SessionManager", `Session ${sessionId} connected`)
            isReady = true
            // Also update stored session if it exists (handles race condition)
            const managed = this.sessions.get(sessionId)
            if (managed) {
              managed.isReady = true
            }
            emitter.emit("ready")
          },
          onmessage: (msg: LiveServerMessage) => {
            emitter.emit("message", msg)
          },
          onerror: (e: ErrorEvent) => {
            logError("SessionManager", `Session ${sessionId} error: ${e.message || "Session error"}`)
            emitter.emit("error", new Error(e.message || "Session error"))
          },
          onclose: (e: CloseEvent) => {
            logDebug("SessionManager", `Session ${sessionId} closed: ${e.reason}`)
            emitter.emit("close")
            this.removeSession(sessionId)
          },
        },
      })

      // Set up session timeout
      const timeoutId = setTimeout(() => {
        logDebug("SessionManager", `Session ${sessionId} timed out`)
        this.closeSession(sessionId)
      }, SESSION_TIMEOUT_MS)

      // Store managed session (use local isReady flag set in onopen callback)
      this.sessions.set(sessionId, {
        session,
        emitter,
        createdAt: Date.now(),
        timeoutId,
        isReady,
        secret,
      })

      logDebug("SessionManager", `Session ${sessionId} created successfully`)
      return { sessionId, secret }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      logError("SessionManager", `Failed to create session ${sessionId}: ${message}`)
      throw error
    }
  }

  /**
   * Send audio to a session
   */
  async sendAudio(sessionId: string, base64Audio: string): Promise<void> {
    const managed = this.sessions.get(sessionId)
    if (!managed) {
      throw new Error(`Session ${sessionId} not found`)
    }

    try {
      // SDK expects plain object with data + mimeType, NOT native Blob
      // Native Blob has .type property, but SDK checks .mimeType property
      // Source: SDK tAudioBlob() validates .mimeType starts with "audio/"
      // Source: Context7 - /websites/ai_google_dev_gemini-api docs - "Enable Model Audio Input Transcription"
      await managed.session.sendRealtimeInput({
        audio: {
          data: base64Audio, // Base64 string directly (no conversion needed)
          mimeType: "audio/pcm;rate=16000", // Required format for input transcription
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      logError("SessionManager", `Failed to send audio to ${sessionId}: ${message}`)
      throw error
    }
  }

  /**
   * Send text to a session
   */
  async sendText(sessionId: string, text: string): Promise<void> {
    const managed = this.sessions.get(sessionId)
    if (!managed) {
      throw new Error(`Session ${sessionId} not found`)
    }

    try {
      // Send text as client content
      // Source: Context7 - /googleapis/js-genai docs - "Session.sendClientContent"
      managed.session.sendClientContent({
        turns: [{ role: "user", parts: [{ text }] }],
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      logError("SessionManager", `Failed to send text to ${sessionId}: ${message}`)
      throw error
    }
  }

  /**
   * Signal end of audio stream
   */
  async sendAudioEnd(sessionId: string): Promise<void> {
    const managed = this.sessions.get(sessionId)
    if (!managed) {
      throw new Error(`Session ${sessionId} not found`)
    }

    try {
      await managed.session.sendRealtimeInput({ audioStreamEnd: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      logError("SessionManager", `Failed to send audio end to ${sessionId}: ${message}`)
      throw error
    }
  }

  /**
   * Send tool response back to Gemini
   * Used when model calls a function (e.g., stay_silent)
   * Source: Context7 - /googleapis/js-genai docs - "sendToolResponse"
   */
  async sendToolResponse(
    sessionId: string,
    functionResponses: Array<{ id: string; name: string; response: Record<string, unknown> }>
  ): Promise<void> {
    const managed = this.sessions.get(sessionId)
    if (!managed) {
      throw new Error(`Session ${sessionId} not found`)
    }

    try {
      managed.session.sendToolResponse({ functionResponses })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error"
      logError("SessionManager", `Failed to send tool response to ${sessionId}: ${message}`)
      throw error
    }
  }

  /**
   * Get the EventEmitter for a session (for SSE streaming)
   */
  getEmitter(sessionId: string): EventEmitter | undefined {
    return this.sessions.get(sessionId)?.emitter
  }

  /**
   * Check if a session exists
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  /**
   * Check if a session is ready (connected to Gemini)
   */
  isSessionReady(sessionId: string): boolean {
    return this.sessions.get(sessionId)?.isReady ?? false
  }

  /**
   * Validate session secret for ownership verification
   * Uses timing-safe comparison to prevent timing attacks
   */
  validateSecret(sessionId: string, secret: string): boolean {
    const managed = this.sessions.get(sessionId)
    if (!managed) return false

    // Use timing-safe comparison to prevent timing attacks
    const a = Buffer.from(managed.secret)
    const b = Buffer.from(secret)

    // timingSafeEqual requires buffers of equal length
    if (a.length !== b.length) return false

    return timingSafeEqual(a, b)
  }

  /**
   * Close a session
   */
  closeSession(sessionId: string): void {
    const managed = this.sessions.get(sessionId)
    if (managed) {
      logDebug("SessionManager", `Closing session ${sessionId}`)
      clearTimeout(managed.timeoutId)
      try {
        managed.session.close()
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error"
        logError("SessionManager", `Error closing session ${sessionId}: ${message}`)
      }
      managed.emitter.emit("close")
      this.sessions.delete(sessionId)
    }
  }

  /**
   * Remove session from map (called on natural close)
   */
  private removeSession(sessionId: string): void {
    const managed = this.sessions.get(sessionId)
    if (managed) {
      clearTimeout(managed.timeoutId)
      this.sessions.delete(sessionId)
    }
  }

  /**
   * Clean up stale sessions (older than timeout)
   */
  private cleanupStaleSessions(): void {
    const now = Date.now()
    for (const [sessionId, managed] of this.sessions) {
      if (now - managed.createdAt > SESSION_TIMEOUT_MS) {
        logDebug("SessionManager", `Cleaning up stale session ${sessionId}`)
        this.closeSession(sessionId)
      }
    }
  }

  /**
   * Get current session count
   */
  getSessionCount(): number {
    return this.sessions.size
  }
}

// Use global singleton to survive Next.js hot reload
// This ensures sessions persist across module reloads in development
const globalForGemini = globalThis as unknown as {
  geminiSessionManager: GeminiSessionManager | undefined
}

export const sessionManager =
  globalForGemini.geminiSessionManager ?? new GeminiSessionManager()

if (process.env.NODE_ENV !== "production") {
  globalForGemini.geminiSessionManager = sessionManager
}
