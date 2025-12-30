"use client"

/**
 * useGeminiLive Hook
 *
 * Manages connection to server-side Gemini Live session for real-time
 * voice conversations. Uses SSE for receiving and POST for sending.
 *
 * Architecture:
 * - Server manages the actual Gemini session (API key stays server-side)
 * - Client receives audio/transcripts via Server-Sent Events (SSE)
 * - Client sends audio via POST requests
 *
 * Source: Context7 - /googleapis/js-genai docs - "Live.connect"
 */

import { useReducer, useRef, useCallback, useEffect } from "react"
import {
  GeminiLiveClient,
  createLiveClient,
  type LiveClientConfig,
  type LiveClientEvents,
  type GeminiWidgetEvent,
  type SessionContext,
} from "@/lib/gemini/live-client"

// ============================================
// Types
// ============================================

export type GeminiConnectionState =
  | "idle"
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
}

export interface GeminiLiveControls {
  /** Initialize connection with optional context for AI-initiated conversations */
  connect: (context?: SessionContext) => Promise<void>
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
  /** Get the current client instance (for session preservation) */
  getClient: () => GeminiLiveClient | null
  /** Reattach to an existing client (for session resumption) */
  reattachToClient: (client: GeminiLiveClient) => void
}

export interface UseGeminiLiveOptions {
  /** Callbacks for audio events */
  onAudioChunk?: (base64Audio: string) => void
  onAudioEnd?: () => void
  /** Callbacks for transcript events */
  onUserTranscript?: (text: string, isFinal: boolean) => void
  onModelTranscript?: (text: string, finished: boolean) => void
  onModelThinking?: (text: string) => void
  /** Callbacks for turn events */
  onTurnComplete?: () => void
  onInterrupted?: () => void
  /** Called when AI chooses silence (doesn't respond) */
  onSilenceChosen?: (reason: string) => void
  /** Called when Gemini triggers an interactive widget */
  onWidget?: (event: GeminiWidgetEvent) => void
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

export type GeminiAction =
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

export const initialState: GeminiLiveData = {
  state: "idle",
  isReady: false,
  isModelSpeaking: false,
  isUserSpeaking: false,
  userTranscript: "",
  modelTranscript: "",
  error: null,
}

export function geminiReducer(state: GeminiLiveData, action: GeminiAction): GeminiLiveData {
  switch (action.type) {
    case "START_CONNECTING":
      return {
        ...initialState,
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
      return {
        ...state,
        userTranscript: action.text,
      }

    case "MODEL_TRANSCRIPT":
      // Append to current model transcript with max length check
      const MAX_TRANSCRIPT_LENGTH = 10000
      const newTranscript = state.modelTranscript + action.text
      return {
        ...state,
        modelTranscript: newTranscript.length > MAX_TRANSCRIPT_LENGTH
          ? newTranscript.slice(-MAX_TRANSCRIPT_LENGTH)
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
 * Hook for managing Gemini Live API connection
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
    onAudioChunk,
    onAudioEnd,
    onUserTranscript,
    onModelTranscript,
    onModelThinking,
    onTurnComplete,
    onInterrupted,
    onSilenceChosen,
    onWidget,
    onUserSpeechStart,
    onUserSpeechEnd,
    onConnected,
    onDisconnected,
    onError,
  } = options

  const [data, dispatch] = useReducer(geminiReducer, initialState)
  const clientRef = useRef<GeminiLiveClient | null>(null)
  const isConnectingRef = useRef(false)

  // Store callbacks in refs to avoid stale closures
  const callbacksRef = useRef({
    onAudioChunk,
    onAudioEnd,
    onUserTranscript,
    onModelTranscript,
    onModelThinking,
    onTurnComplete,
    onInterrupted,
    onSilenceChosen,
    onWidget,
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
      onModelThinking,
      onTurnComplete,
      onInterrupted,
      onSilenceChosen,
      onWidget,
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
    onModelThinking,
    onTurnComplete,
    onInterrupted,
    onSilenceChosen,
    onWidget,
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
   * Connect to Gemini Live API
   *
   * @param context - Optional context for AI-initiated conversations
   *                  Includes contextSummary and timeContext for personalized greeting
   */
  const connect = useCallback(async (context?: SessionContext) => {
    // Prevent concurrent connection attempts
    if (isConnectingRef.current) {
      console.warn("[GeminiLive] Connection already in progress")
      return
    }

    try {
      isConnectingRef.current = true
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
        onModelTranscript: (text, finished) => {
          dispatch({ type: "MODEL_TRANSCRIPT", text })
          callbacksRef.current.onModelTranscript?.(text, finished)
        },
        onModelThinking: (text) => {
          callbacksRef.current.onModelThinking?.(text)
        },
        onTurnComplete: () => {
          dispatch({ type: "MODEL_SPEECH_END" })
          // Note: Don't clear transcripts here - let useCheckIn manage its own state
          // Clearing here was causing race conditions with save logic
          callbacksRef.current.onTurnComplete?.()
        },
        onInterrupted: () => {
          dispatch({ type: "MODEL_SPEECH_END" })
          callbacksRef.current.onInterrupted?.()
        },
        onSilenceChosen: (reason) => {
          dispatch({ type: "MODEL_SPEECH_END" })
          callbacksRef.current.onSilenceChosen?.(reason)
        },
        onUserSpeechStart: () => {
          dispatch({ type: "USER_SPEECH_START" })
          callbacksRef.current.onUserSpeechStart?.()
        },
        onUserSpeechEnd: () => {
          dispatch({ type: "USER_SPEECH_END" })
          callbacksRef.current.onUserSpeechEnd?.()
        },
        onWidget: (event) => {
          callbacksRef.current.onWidget?.(event)
        },
      }

      // Create client config (simplified - server handles session creation)
      const config: LiveClientConfig = {
        events,
      }

      // Create and connect client
      const client = createLiveClient(config)
      clientRef.current = client

      // Pass context for AI-initiated conversations (builds personalized system instruction)
      await client.connect(context)
      dispatch({ type: "CONNECTED" })
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Connection failed")
      dispatch({ type: "ERROR", error: err.message })
      callbacksRef.current.onError?.(err)
    } finally {
      isConnectingRef.current = false
    }
  }, [])

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

  /**
   * Get the current client instance (for session preservation)
   */
  const getClient = useCallback(() => {
    return clientRef.current
  }, [])

  /**
   * Reattach to an existing client (for session resumption)
   * This is used when resuming a preserved session - takes ownership of
   * an existing GeminiLiveClient and reattaches event handlers.
   */
  const reattachToClient = useCallback((client: GeminiLiveClient) => {
    // Set the client reference
    clientRef.current = client

    // Create event handlers using refs (same pattern as connect())
    const events: Partial<LiveClientEvents> = {
      onConnecting: () => {
        // Already connected
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
      onModelTranscript: (text, finished) => {
        dispatch({ type: "MODEL_TRANSCRIPT", text })
        callbacksRef.current.onModelTranscript?.(text, finished)
      },
      onModelThinking: (text) => {
        callbacksRef.current.onModelThinking?.(text)
      },
      onTurnComplete: () => {
        dispatch({ type: "MODEL_SPEECH_END" })
        callbacksRef.current.onTurnComplete?.()
      },
      onInterrupted: () => {
        dispatch({ type: "MODEL_SPEECH_END" })
        callbacksRef.current.onInterrupted?.()
      },
      onSilenceChosen: (reason) => {
        dispatch({ type: "MODEL_SPEECH_END" })
        callbacksRef.current.onSilenceChosen?.(reason)
      },
      onUserSpeechStart: () => {
        dispatch({ type: "USER_SPEECH_START" })
        callbacksRef.current.onUserSpeechStart?.()
      },
      onUserSpeechEnd: () => {
        dispatch({ type: "USER_SPEECH_END" })
        callbacksRef.current.onUserSpeechEnd?.()
      },
      onWidget: (event) => {
        callbacksRef.current.onWidget?.(event)
      },
    }

    // Reattach handlers to the existing client
    client.reattachEventHandlers(events)

    // Set state to ready (client is already connected)
    dispatch({ type: "READY" })
  }, [])

  const controls: GeminiLiveControls = {
    connect,
    disconnect,
    sendAudio,
    sendText,
    injectContext,
    endAudioStream,
    getClient,
    reattachToClient,
  }

  return [data, controls]
}
