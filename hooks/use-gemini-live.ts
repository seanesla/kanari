"use client"

/**
 * useGeminiLive Hook
 *
 * Manages WebSocket connection to Gemini Live API for real-time
 * voice conversations. Handles connection lifecycle, audio streaming,
 * and event dispatching.
 *
 * Source: Context7 - /websites/ai_google_dev_api docs - "Live API"
 * https://ai.google.dev/gemini-api/docs/live
 */

import { useReducer, useRef, useCallback, useEffect } from "react"
import {
  GeminiLiveClient,
  createLiveClient,
  type LiveClientConfig,
  type LiveClientState,
  type LiveClientEvents,
} from "@/lib/gemini/live-client"
import { CHECK_IN_SYSTEM_PROMPT } from "@/lib/gemini/live-prompts"

// ============================================
// Types
// ============================================

export type GeminiConnectionState =
  | "idle"
  | "fetching_token"
  | "connecting"
  | "connected"
  | "ready"
  | "error"
  | "disconnected"

export interface GeminiLiveData {
  /** Current connection state */
  state: GeminiConnectionState
  /** True when ready to send/receive audio */
  isReady: boolean
  /** True when model is speaking (outputting audio) */
  isModelSpeaking: boolean
  /** True when user is speaking (detected by VAD) */
  isUserSpeaking: boolean
  /** Current user transcript (partial or final) */
  userTranscript: string
  /** Current model transcript */
  modelTranscript: string
  /** Error message if state is "error" */
  error: string | null
  /** Session token info */
  session: {
    token: string | null
    expiresAt: string | null
    model: string | null
  }
}

export interface GeminiLiveControls {
  /** Initialize connection (get token + connect) */
  connect: () => Promise<void>
  /** Disconnect from Gemini */
  disconnect: () => void
  /** Send audio chunk (base64 PCM) */
  sendAudio: (base64Audio: string) => void
  /** Send text message (for context injection) */
  sendText: (text: string) => void
  /** Inject mismatch context into conversation */
  injectContext: (contextText: string) => void
  /** Signal end of audio stream */
  endAudioStream: () => void
}

export interface UseGeminiLiveOptions {
  /** System instruction (defaults to CHECK_IN_SYSTEM_PROMPT) */
  systemInstruction?: string
  /** Callbacks for audio events */
  onAudioChunk?: (base64Audio: string) => void
  onAudioEnd?: () => void
  /** Callbacks for transcript events */
  onUserTranscript?: (text: string, isFinal: boolean) => void
  onModelTranscript?: (text: string) => void
  /** Callbacks for turn events */
  onTurnComplete?: () => void
  onInterrupted?: () => void
  /** Callbacks for speech detection */
  onUserSpeechStart?: () => void
  onUserSpeechEnd?: () => void
  /** Connection callbacks */
  onConnected?: () => void
  onDisconnected?: (reason: string) => void
  onError?: (error: Error) => void
}

// ============================================
// Reducer
// ============================================

type GeminiAction =
  | { type: "START_FETCHING_TOKEN" }
  | { type: "TOKEN_RECEIVED"; token: string; expiresAt: string; model: string }
  | { type: "START_CONNECTING" }
  | { type: "CONNECTED" }
  | { type: "READY" }
  | { type: "USER_SPEECH_START" }
  | { type: "USER_SPEECH_END" }
  | { type: "MODEL_SPEECH_START" }
  | { type: "MODEL_SPEECH_END" }
  | { type: "USER_TRANSCRIPT"; text: string; isFinal: boolean }
  | { type: "MODEL_TRANSCRIPT"; text: string }
  | { type: "CLEAR_TRANSCRIPTS" }
  | { type: "ERROR"; error: string }
  | { type: "DISCONNECTED" }
  | { type: "RESET" }

const initialState: GeminiLiveData = {
  state: "idle",
  isReady: false,
  isModelSpeaking: false,
  isUserSpeaking: false,
  userTranscript: "",
  modelTranscript: "",
  error: null,
  session: {
    token: null,
    expiresAt: null,
    model: null,
  },
}

function geminiReducer(state: GeminiLiveData, action: GeminiAction): GeminiLiveData {
  switch (action.type) {
    case "START_FETCHING_TOKEN":
      return {
        ...initialState,
        state: "fetching_token",
      }

    case "TOKEN_RECEIVED":
      return {
        ...state,
        session: {
          token: action.token,
          expiresAt: action.expiresAt,
          model: action.model,
        },
      }

    case "START_CONNECTING":
      return {
        ...state,
        state: "connecting",
      }

    case "CONNECTED":
      return {
        ...state,
        state: "connected",
      }

    case "READY":
      return {
        ...state,
        state: "ready",
        isReady: true,
      }

    case "USER_SPEECH_START":
      return {
        ...state,
        isUserSpeaking: true,
      }

    case "USER_SPEECH_END":
      return {
        ...state,
        isUserSpeaking: false,
      }

    case "MODEL_SPEECH_START":
      return {
        ...state,
        isModelSpeaking: true,
      }

    case "MODEL_SPEECH_END":
      return {
        ...state,
        isModelSpeaking: false,
      }

    case "USER_TRANSCRIPT":
      // For non-final transcripts, replace entirely (they represent the current utterance)
      // For final transcripts, use the final text directly
      return {
        ...state,
        userTranscript: action.text,
      }

    case "MODEL_TRANSCRIPT":
      // Append to current model transcript with max length check
      // Max ~10KB to prevent memory bloat in long sessions
      const MAX_TRANSCRIPT_LENGTH = 10000
      const newTranscript = state.modelTranscript + action.text
      return {
        ...state,
        modelTranscript: newTranscript.length > MAX_TRANSCRIPT_LENGTH
          ? newTranscript.slice(-MAX_TRANSCRIPT_LENGTH)  // Keep most recent
          : newTranscript,
      }

    case "CLEAR_TRANSCRIPTS":
      return {
        ...state,
        userTranscript: "",
        modelTranscript: "",
      }

    case "ERROR":
      return {
        ...state,
        state: "error",
        isReady: false,
        error: action.error,
      }

    case "DISCONNECTED":
      return {
        ...state,
        state: "disconnected",
        isReady: false,
        isModelSpeaking: false,
        isUserSpeaking: false,
      }

    case "RESET":
      return initialState

    default:
      return state
  }
}

// ============================================
// Hook
// ============================================

/**
 * Hook for managing Gemini Live API WebSocket connection
 *
 * @example
 * const [gemini, controls] = useGeminiLive({
 *   onAudioChunk: (audio) => playbackQueue.push(audio),
 *   onModelTranscript: (text) => setMessages(m => [...m, { role: 'assistant', content: text }]),
 * })
 *
 * // Start conversation
 * await controls.connect()
 *
 * // Stream audio from microphone
 * controls.sendAudio(base64PcmChunk)
 */
export function useGeminiLive(
  options: UseGeminiLiveOptions = {}
): [GeminiLiveData, GeminiLiveControls] {
  const {
    systemInstruction = CHECK_IN_SYSTEM_PROMPT,
    onAudioChunk,
    onAudioEnd,
    onUserTranscript,
    onModelTranscript,
    onTurnComplete,
    onInterrupted,
    onUserSpeechStart,
    onUserSpeechEnd,
    onConnected,
    onDisconnected,
    onError,
  } = options

  const [data, dispatch] = useReducer(geminiReducer, initialState)
  const clientRef = useRef<GeminiLiveClient | null>(null)

  // Store callbacks in refs to avoid stale closures
  const callbacksRef = useRef({
    onAudioChunk,
    onAudioEnd,
    onUserTranscript,
    onModelTranscript,
    onTurnComplete,
    onInterrupted,
    onUserSpeechStart,
    onUserSpeechEnd,
    onConnected,
    onDisconnected,
    onError,
  })

  // Update refs when callbacks change
  useEffect(() => {
    callbacksRef.current = {
      onAudioChunk,
      onAudioEnd,
      onUserTranscript,
      onModelTranscript,
      onTurnComplete,
      onInterrupted,
      onUserSpeechStart,
      onUserSpeechEnd,
      onConnected,
      onDisconnected,
      onError,
    }
  }, [
    onAudioChunk,
    onAudioEnd,
    onUserTranscript,
    onModelTranscript,
    onTurnComplete,
    onInterrupted,
    onUserSpeechStart,
    onUserSpeechEnd,
    onConnected,
    onDisconnected,
    onError,
  ])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect()
        clientRef.current = null
      }
    }
  }, [])

  /**
   * Fetch ephemeral token from API
   */
  const fetchToken = useCallback(async () => {
    const response = await fetch("/api/gemini/session", {
      method: "POST",
    })

    // Parse JSON once - response body can only be consumed once
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || "Failed to get session token")
    }

    return data as { token: string; expiresAt: string; wsUrl: string; model: string }
  }, [])

  /**
   * Connect to Gemini Live API
   */
  const connect = useCallback(async () => {
    try {
      // Start connection process
      dispatch({ type: "START_FETCHING_TOKEN" })

      // Get ephemeral token
      const session = await fetchToken()
      dispatch({
        type: "TOKEN_RECEIVED",
        token: session.token,
        expiresAt: session.expiresAt,
        model: session.model,
      })

      dispatch({ type: "START_CONNECTING" })

      // Create event handlers that use refs to avoid stale closures
      const events: Partial<LiveClientEvents> = {
        onConnecting: () => {
          // Already dispatched START_CONNECTING
        },
        onConnected: () => {
          dispatch({ type: "READY" })
          callbacksRef.current.onConnected?.()
        },
        onDisconnected: (reason) => {
          dispatch({ type: "DISCONNECTED" })
          callbacksRef.current.onDisconnected?.(reason)
        },
        onError: (error) => {
          dispatch({ type: "ERROR", error: error.message })
          callbacksRef.current.onError?.(error)
        },
        onAudioChunk: (base64Audio) => {
          // First audio chunk = model started speaking
          dispatch({ type: "MODEL_SPEECH_START" })
          callbacksRef.current.onAudioChunk?.(base64Audio)
        },
        onAudioEnd: () => {
          dispatch({ type: "MODEL_SPEECH_END" })
          callbacksRef.current.onAudioEnd?.()
        },
        onUserTranscript: (text, isFinal) => {
          dispatch({ type: "USER_TRANSCRIPT", text, isFinal })
          callbacksRef.current.onUserTranscript?.(text, isFinal)
        },
        onModelTranscript: (text) => {
          dispatch({ type: "MODEL_TRANSCRIPT", text })
          callbacksRef.current.onModelTranscript?.(text)
        },
        onTurnComplete: () => {
          dispatch({ type: "MODEL_SPEECH_END" })
          dispatch({ type: "CLEAR_TRANSCRIPTS" })
          callbacksRef.current.onTurnComplete?.()
        },
        onInterrupted: () => {
          dispatch({ type: "MODEL_SPEECH_END" })
          callbacksRef.current.onInterrupted?.()
        },
        onUserSpeechStart: () => {
          dispatch({ type: "USER_SPEECH_START" })
          callbacksRef.current.onUserSpeechStart?.()
        },
        onUserSpeechEnd: () => {
          dispatch({ type: "USER_SPEECH_END" })
          callbacksRef.current.onUserSpeechEnd?.()
        },
      }

      // Create client config
      const config: LiveClientConfig = {
        token: session.token,
        wsUrl: session.wsUrl,
        model: session.model,
        systemInstruction,
        events,
      }

      // Create and connect client
      const client = createLiveClient(config)
      clientRef.current = client

      await client.connect()
      dispatch({ type: "CONNECTED" })
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Connection failed")
      dispatch({ type: "ERROR", error: err.message })
      callbacksRef.current.onError?.(err)
    }
  }, [fetchToken, systemInstruction])

  /**
   * Disconnect from Gemini
   */
  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect()
      clientRef.current = null
    }
    dispatch({ type: "DISCONNECTED" })
  }, [])

  /**
   * Send audio chunk to Gemini
   */
  const sendAudio = useCallback((base64Audio: string) => {
    if (clientRef.current?.isReady()) {
      clientRef.current.sendAudio(base64Audio)
    }
  }, [])

  /**
   * Send text message to Gemini
   */
  const sendText = useCallback((text: string) => {
    if (clientRef.current?.isReady()) {
      clientRef.current.sendText(text)
    }
  }, [])

  /**
   * Inject context into conversation (for mismatch detection)
   */
  const injectContext = useCallback((contextText: string) => {
    if (clientRef.current?.isReady()) {
      clientRef.current.injectContext(contextText)
    }
  }, [])

  /**
   * Signal end of audio stream
   */
  const endAudioStream = useCallback(() => {
    if (clientRef.current?.isReady()) {
      clientRef.current.sendAudioEnd()
    }
  }, [])

  const controls: GeminiLiveControls = {
    connect,
    disconnect,
    sendAudio,
    sendText,
    injectContext,
    endAudioStream,
  }

  return [data, controls]
}
