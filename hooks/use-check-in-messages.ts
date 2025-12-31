"use client"

import { useCallback, useEffect, useRef } from "react"
import type { Dispatch, MutableRefObject } from "react"
import type { GeminiLiveData } from "@/hooks/use-gemini-live"
import { processAudio } from "@/lib/audio/processor"
import {
  detectMismatch,
  featuresToPatterns,
  shouldRunMismatchDetection,
} from "@/lib/gemini/mismatch-detector"
import { buildMismatchContext, buildVoicePatternContext } from "@/lib/gemini/context-builder"
import { mergeTranscriptUpdate } from "@/lib/gemini/transcript-merge"
import { analyzeVoiceMetrics } from "@/lib/ml/inference"
import type {
  AudioFeatures,
  CheckInMessage,
  CheckInSession,
  CheckInState,
  MismatchResult,
  VoiceMetrics,
  WidgetState,
} from "@/lib/types"

// ============================================
// Types
// ============================================

export interface CheckInData {
  /** Current check-in state */
  state: CheckInState
  /** True when ready for voice conversation */
  isActive: boolean
  /** Current session */
  session: CheckInSession | null
  /** Messages in current conversation */
  messages: CheckInMessage[]
  /** ID of currently streaming assistant message (for O(1) lookup) */
  currentStreamingMessageId: string | null
  /** Current user transcript (partial) */
  currentUserTranscript: string
  /** Current assistant transcript (being spoken) */
  currentAssistantTranscript: string
  /** Current assistant thinking (chain-of-thought) */
  currentAssistantThinking: string
  /** Latest mismatch detection result */
  latestMismatch: MismatchResult | null
  /** Number of mismatches detected this session */
  mismatchCount: number
  /** Active Gemini-triggered widgets */
  widgets: WidgetState[]
  /** Audio levels for visualization */
  audioLevels: {
    input: number // User microphone
    output: number // Assistant playback
  }
  /** Connection state details */
  connectionState: GeminiLiveData["state"]
  /** Error message if any */
  error: string | null
  /** Microphone mute state */
  isMuted: boolean
}

export interface CheckInMessagesCallbacks {
  onMessage?: (message: CheckInMessage) => void
  onMismatch?: (result: MismatchResult) => void
}

// ============================================
// Reducer
// ============================================

export type CheckInAction =
  | { type: "START_INITIALIZING" }
  | { type: "SET_CONNECTING" }
  | { type: "SET_READY" }
  | { type: "SET_AI_GREETING" }
  | { type: "SET_LISTENING" }
  | { type: "SET_USER_SPEAKING" }
  | { type: "SET_PROCESSING" }
  | { type: "SET_ASSISTANT_SPEAKING" }
  | { type: "SET_ENDING" }
  | { type: "SET_COMPLETE" }
  | { type: "SET_SESSION"; session: CheckInSession }
  | { type: "ADD_MESSAGE"; message: CheckInMessage }
  | { type: "UPDATE_MESSAGE_CONTENT"; messageId: string; content: string }
  | { type: "SET_MESSAGE_STREAMING"; messageId: string; isStreaming: boolean }
  | {
      type: "UPDATE_MESSAGE_FEATURES"
      messageId: string
      features: AudioFeatures
      metrics: VoiceMetrics
      mismatch: MismatchResult
    }
  | { type: "SET_USER_TRANSCRIPT"; text: string }
  | { type: "SET_ASSISTANT_TRANSCRIPT"; text: string }
  | { type: "APPEND_ASSISTANT_TRANSCRIPT"; text: string }
  | { type: "UPDATE_STREAMING_MESSAGE"; text: string }
  | { type: "FINALIZE_STREAMING_MESSAGE" }
  | { type: "SET_ASSISTANT_THINKING"; text: string }
  | { type: "APPEND_ASSISTANT_THINKING"; text: string }
  | { type: "CLEAR_CURRENT_TRANSCRIPTS" }
  | { type: "SET_MISMATCH"; result: MismatchResult }
  | { type: "SET_INPUT_LEVEL"; level: number }
  | { type: "SET_OUTPUT_LEVEL"; level: number }
  | { type: "SET_CONNECTION_STATE"; state: GeminiLiveData["state"] }
  | { type: "SET_ERROR"; error: string }
  | { type: "SET_MUTED"; muted: boolean }
  | { type: "ADD_WIDGET"; widget: WidgetState }
  | { type: "UPDATE_WIDGET"; widgetId: string; updates: Partial<WidgetState> }
  | { type: "DISMISS_WIDGET"; widgetId: string }
  | { type: "RESET" }

export const initialState: CheckInData = {
  state: "idle",
  isActive: false,
  session: null,
  messages: [],
  currentStreamingMessageId: null,
  currentUserTranscript: "",
  currentAssistantTranscript: "",
  currentAssistantThinking: "",
  latestMismatch: null,
  mismatchCount: 0,
  widgets: [],
  audioLevels: { input: 0, output: 0 },
  connectionState: "idle",
  error: null,
  isMuted: false,
}

export function checkInReducer(state: CheckInData, action: CheckInAction): CheckInData {
  switch (action.type) {
    case "START_INITIALIZING":
      return { ...initialState, state: "initializing" }

    case "SET_CONNECTING":
      return { ...state, state: "connecting" }

    case "SET_READY":
      return { ...state, state: "ready", isActive: true }

    case "SET_AI_GREETING":
      return { ...state, state: "ai_greeting" }

    case "SET_LISTENING":
      return { ...state, state: "listening" }

    case "SET_USER_SPEAKING":
      return { ...state, state: "user_speaking" }

    case "SET_PROCESSING":
      return { ...state, state: "processing" }

    case "SET_ASSISTANT_SPEAKING":
      return { ...state, state: "assistant_speaking" }

    case "SET_ENDING":
      return { ...state, state: "ending" }

    case "SET_COMPLETE":
      return { ...state, state: "complete", isActive: false }

    case "SET_SESSION":
      return { ...state, session: action.session }

    case "ADD_MESSAGE": {
      const newMessages = [...state.messages, action.message]
      // Track streaming message ID for O(1) lookup during updates
      // Only assistant messages participate in the streaming-ID fast path.
      // User messages may be updated during live transcription and should not
      // interfere with assistant streaming updates.
      const currentStreamingMessageId =
        action.message.role === "assistant" && action.message.isStreaming
          ? action.message.id
          : state.currentStreamingMessageId

      return {
        ...state,
        messages: newMessages,
        currentStreamingMessageId,
        session: state.session ? { ...state.session, messages: newMessages } : null,
      }
    }

    case "UPDATE_MESSAGE_CONTENT": {
      const updatedMessages = state.messages.map((msg) =>
        msg.id === action.messageId ? { ...msg, content: action.content } : msg
      )
      return {
        ...state,
        messages: updatedMessages,
        session: state.session ? { ...state.session, messages: updatedMessages } : null,
      }
    }

    case "SET_MESSAGE_STREAMING": {
      const updatedMessages = state.messages.map((msg) =>
        msg.id === action.messageId ? { ...msg, isStreaming: action.isStreaming } : msg
      )

      // If we just turned off streaming on the current streaming message, clear the tracking ID
      const currentStreamingMessageId =
        !action.isStreaming && state.currentStreamingMessageId === action.messageId
          ? null
          : state.currentStreamingMessageId

      return {
        ...state,
        messages: updatedMessages,
        currentStreamingMessageId,
        session: state.session ? { ...state.session, messages: updatedMessages } : null,
      }
    }

    case "UPDATE_MESSAGE_FEATURES": {
      const currentMessage = state.messages.find((msg) => msg.id === action.messageId)
      const wasMismatchAlreadyCounted = Boolean(currentMessage?.mismatch?.detected)
      const shouldIncrement = action.mismatch.detected && !wasMismatchAlreadyCounted
      const newMismatchCount = shouldIncrement ? state.mismatchCount + 1 : state.mismatchCount

      const updatedMessages = state.messages.map((msg) =>
        msg.id === action.messageId
          ? {
              ...msg,
              features: action.features,
              metrics: action.metrics,
              mismatch: action.mismatch,
            }
          : msg
      )

      return {
        ...state,
        messages: updatedMessages,
        latestMismatch: action.mismatch,
        mismatchCount: newMismatchCount,
        session: state.session
          ? {
              ...state.session,
              messages: updatedMessages,
              mismatchCount: newMismatchCount,
            }
          : null,
      }
    }

    case "SET_USER_TRANSCRIPT":
      return { ...state, currentUserTranscript: action.text }

    case "SET_ASSISTANT_TRANSCRIPT":
      return { ...state, currentAssistantTranscript: action.text }

    case "APPEND_ASSISTANT_TRANSCRIPT":
      return { ...state, currentAssistantTranscript: state.currentAssistantTranscript + action.text }

    case "UPDATE_STREAMING_MESSAGE": {
      // O(1) lookup using tracked streaming message ID
      const streamingId = state.currentStreamingMessageId
      if (!streamingId) {
        return state
      }

      const streamingMsgIndex = state.messages.findIndex((msg) => msg.id === streamingId)
      if (streamingMsgIndex === -1) {
        // Streaming message ID is stale, clear it
        return { ...state, currentStreamingMessageId: null }
      }

      const streamingMsg = state.messages[streamingMsgIndex]
      const updatedMsgs = [...state.messages]
      updatedMsgs[streamingMsgIndex] = {
        ...streamingMsg,
        content: streamingMsg.content + action.text,
      }
      return {
        ...state,
        messages: updatedMsgs,
        session: state.session ? { ...state.session, messages: updatedMsgs } : null,
      }
    }

    case "FINALIZE_STREAMING_MESSAGE": {
      // O(1) lookup using tracked streaming message ID
      if (!state.currentStreamingMessageId) {
        return state
      }

      const streamingIndex = state.messages.findIndex(
        (msg) => msg.id === state.currentStreamingMessageId
      )

      if (streamingIndex === -1) {
        return { ...state, currentStreamingMessageId: null }
      }

      const msgs = [...state.messages]
      msgs[streamingIndex] = { ...msgs[streamingIndex], isStreaming: false }
      return {
        ...state,
        messages: msgs,
        currentStreamingMessageId: null,
        session: state.session ? { ...state.session, messages: msgs } : null,
      }
    }

    case "SET_ASSISTANT_THINKING":
      return { ...state, currentAssistantThinking: action.text }

    case "APPEND_ASSISTANT_THINKING":
      return { ...state, currentAssistantThinking: state.currentAssistantThinking + action.text }

    case "CLEAR_CURRENT_TRANSCRIPTS":
      return {
        ...state,
        currentUserTranscript: "",
        currentAssistantTranscript: "",
        currentAssistantThinking: "",
      }

    case "SET_MISMATCH":
      return { ...state, latestMismatch: action.result }

    case "SET_INPUT_LEVEL":
      return { ...state, audioLevels: { ...state.audioLevels, input: action.level } }

    case "SET_OUTPUT_LEVEL":
      return { ...state, audioLevels: { ...state.audioLevels, output: action.level } }

    case "SET_CONNECTION_STATE":
      return { ...state, connectionState: action.state }

    case "SET_ERROR":
      return { ...state, state: "error", isActive: false, error: action.error }

    case "SET_MUTED":
      return { ...state, isMuted: action.muted }

    case "ADD_WIDGET":
      return { ...state, widgets: [...state.widgets, action.widget] }

    case "UPDATE_WIDGET":
      return {
        ...state,
        widgets: state.widgets.map((w) =>
          w.id === action.widgetId ? ({ ...w, ...action.updates } as WidgetState) : w
        ),
      }

    case "DISMISS_WIDGET":
      return { ...state, widgets: state.widgets.filter((w) => w.id !== action.widgetId) }

    case "RESET":
      return initialState

    default:
      return state
  }
}

// ============================================
// Helper Functions
// ============================================

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

// ============================================
// Sub-hook: Messages
// ============================================

export interface CheckInMessagesGeminiHandlers {
  onUserSpeechStart: () => void
  onUserSpeechEnd: () => void
  onUserTranscript: (text: string, finished: boolean) => void
  onModelTranscript: (text: string, finished: boolean) => void
  onModelThinking: (text: string) => void
  onAudioChunk: (base64Audio: string) => void
  onTurnComplete: () => void
  onInterrupted: () => void
  onSilenceChosen: (reason: string) => void
}

export interface UseCheckInMessagesOptions {
  data: CheckInData
  dispatch: Dispatch<CheckInAction>
  callbacksRef: MutableRefObject<CheckInMessagesCallbacks>
  sendText: (text: string) => void
  injectContext: (contextText: string) => void
  queueAudio: (base64Audio: string) => void
  clearQueuedAudio: () => void
  resetAudioChunks: () => void
  drainAudioChunks: () => Float32Array[]
}

export interface UseCheckInMessagesResult {
  addUserTextMessage: (content: string) => void
  sendTextMessage: (text: string) => void
  handlers: CheckInMessagesGeminiHandlers
}

export function useCheckInMessages(options: UseCheckInMessagesOptions): UseCheckInMessagesResult {
  const {
    data,
    dispatch,
    callbacksRef,
    sendText,
    injectContext,
    queueAudio,
    clearQueuedAudio,
    resetAudioChunks,
    drainAudioChunks,
  } = options

  // Track the last user message ID for updating with features
  const lastUserMessageIdRef = useRef<string | null>(null)

  // When VAD "speech start" events are missing, user transcript updates can keep
  // appending into the previous bubble. We treat the end of an assistant turn
  // (returning to listening) as a boundary for the next user utterance.
  // Pattern doc: docs/error-patterns/voice-transcript-utterance-boundary-missing.md
  const pendingUserUtteranceResetRef = useRef(false)

  // Prevent double-handling utterance end (Gemini may emit both "speech end" and a final transcript)
  const userSpeechEndHandledRef = useRef(false)

  // Simple transcript accumulation (no complex state tracking needed)
  // Assistant UI handles rendering, we just need to track current content
  const currentTranscriptRef = useRef("")
  const currentThinkingRef = useRef("")

  // Track current user transcript for use in callbacks (avoid stale closures)
  const userTranscriptRef = useRef<string>("")

  // Track when user started speaking (for correct message timestamp ordering)
  const userSpeechStartRef = useRef<string | null>(null)

  // Sync userTranscriptRef with current user transcript (for use in callbacks)
  useEffect(() => {
    userTranscriptRef.current = data.currentUserTranscript
  }, [data.currentUserTranscript])

  const addUserTextMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return

      const message: CheckInMessage = {
        id: generateId(),
        role: "user",
        content: trimmed,
        timestamp: new Date().toISOString(),
      }

      dispatch({ type: "ADD_MESSAGE", message })
      callbacksRef.current.onMessage?.(message)
    },
    [dispatch, callbacksRef]
  )

  const processUserUtterance = useCallback(async () => {
    const chunks = drainAudioChunks()
    if (chunks.length === 0) return

    // Get the message ID we need to update - captured at time of message creation
    const messageIdToUpdate = lastUserMessageIdRef.current

    try {
      // Concatenate audio chunks
      const totalLength = chunks.reduce((sum, c) => sum + c.length, 0)
      const audioData = new Float32Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        audioData.set(chunk, offset)
        offset += chunk.length
      }

      // Extract features
      const result = await processAudio(audioData, {
        sampleRate: 16000,
        enableVAD: false, // Already VAD-filtered by capture
      })

      // Compute metrics
      const metrics = analyzeVoiceMetrics(result.features)

      // Check for mismatch
      if (shouldRunMismatchDetection(data.currentUserTranscript, result.features)) {
        const mismatchResult = detectMismatch(data.currentUserTranscript, result.features, metrics)

        dispatch({ type: "SET_MISMATCH", result: mismatchResult })

        if (mismatchResult.detected) {
          // Inject context into Gemini conversation
          const context = buildMismatchContext(mismatchResult)
          injectContext(context)
          callbacksRef.current.onMismatch?.(mismatchResult)
        }

        // Also periodically inject voice pattern context
        const patterns = featuresToPatterns(result.features)
        const patternContext = buildVoicePatternContext(patterns, metrics)
        injectContext(patternContext)

        // Update the user message with features and metrics using dispatch
        // This properly updates React state instead of mutating directly
        if (messageIdToUpdate) {
          dispatch({
            type: "UPDATE_MESSAGE_FEATURES",
            messageId: messageIdToUpdate,
            features: result.features,
            metrics,
            mismatch: mismatchResult,
          })
        }
      }
    } catch (error) {
      console.error("[useCheckIn] Failed to process utterance:", error)
    }
  }, [callbacksRef, data.currentUserTranscript, dispatch, drainAudioChunks, injectContext])

  const onUserSpeechStart = useCallback(() => {
    dispatch({ type: "SET_USER_SPEAKING" })
    resetAudioChunks() // Start collecting audio for this utterance
    userTranscriptRef.current = "" // Reset accumulated transcript for new utterance
    dispatch({ type: "SET_USER_TRANSCRIPT", text: "" })
    // Clear the active voice message ID for this new utterance
    lastUserMessageIdRef.current = null
    pendingUserUtteranceResetRef.current = false
    userSpeechEndHandledRef.current = false
    userSpeechStartRef.current = new Date().toISOString() // Capture timestamp when user STARTS speaking
  }, [dispatch, resetAudioChunks])

  const onUserSpeechEnd = useCallback(() => {
    // Guard against double-handling (some SDKs send both a final transcript and a speech-end event)
    if (userSpeechEndHandledRef.current) return
    userSpeechEndHandledRef.current = true

    dispatch({ type: "SET_PROCESSING" })

    const transcript = userTranscriptRef.current.trim()
    const messageId = lastUserMessageIdRef.current

    if (transcript) {
      if (!messageId) {
        const newMessageId = generateId()
        const message: CheckInMessage = {
          id: newMessageId,
          role: "user",
          content: transcript,
          timestamp: userSpeechStartRef.current || new Date().toISOString(),
        }

        // Reset the captured timestamp for the next utterance
        userSpeechStartRef.current = null

        lastUserMessageIdRef.current = newMessageId
        dispatch({ type: "ADD_MESSAGE", message })
        callbacksRef.current.onMessage?.(message)
      } else {
        // Ensure the in-flight message is finalized and contains the latest transcript
        dispatch({ type: "UPDATE_MESSAGE_CONTENT", messageId, content: transcript })
        dispatch({ type: "SET_MESSAGE_STREAMING", messageId, isStreaming: false })
      }
    } else if (messageId) {
      // No transcript text, but finalize any in-flight message so it doesn't look stuck
      dispatch({ type: "SET_MESSAGE_STREAMING", messageId, isStreaming: false })
    }

    // Process collected audio for mismatch detection
    void processUserUtterance()
  }, [callbacksRef, dispatch, processUserUtterance])

  const onUserTranscript = useCallback(
    (text: string, finished: boolean) => {
      // If the previous turn ended and we never received a VAD "speech start" for
      // this utterance, ensure we don't keep appending into the last user bubble.
      if (pendingUserUtteranceResetRef.current && text.trim()) {
        pendingUserUtteranceResetRef.current = false
        resetAudioChunks()
        userTranscriptRef.current = ""
        dispatch({ type: "SET_USER_TRANSCRIPT", text: "" })
        lastUserMessageIdRef.current = null
        userSpeechEndHandledRef.current = false
        userSpeechStartRef.current = null
      }

      // Capture timestamp on FIRST chunk of user speech
      // (VAD signals may not fire, so capture here as fallback)
      if (userTranscriptRef.current === "" && text.trim() && !userSpeechStartRef.current) {
        userSpeechStartRef.current = new Date().toISOString()
      }

      // Accumulate transcript chunks (Gemini sends word-by-word without finished flag)
      userTranscriptRef.current = mergeTranscriptUpdate(userTranscriptRef.current, text).next

      // Update transcript preview with accumulated text (used for mismatch detection and UI fallbacks)
      dispatch({ type: "SET_USER_TRANSCRIPT", text: userTranscriptRef.current })

      const transcript = userTranscriptRef.current.trim()
      if (!transcript) return

      // Ensure there's a message bubble immediately (don't wait for model audio).
      // Pattern doc: docs/error-patterns/voice-transcript-message-commit-late.md
      // If we already have a voice message for this utterance, update it in-place.
      const messageId = lastUserMessageIdRef.current
      if (!messageId) {
        const newMessageId = generateId()
        const message: CheckInMessage = {
          id: newMessageId,
          role: "user",
          content: transcript,
          timestamp: userSpeechStartRef.current || new Date().toISOString(),
          // Treat as streaming until speech end is observed (prevents animation flicker)
          isStreaming: !userSpeechEndHandledRef.current,
        }

        // Reset the captured timestamp for the next utterance
        userSpeechStartRef.current = null

        lastUserMessageIdRef.current = newMessageId
        dispatch({ type: "ADD_MESSAGE", message })
        callbacksRef.current.onMessage?.(message)
      } else {
        dispatch({ type: "UPDATE_MESSAGE_CONTENT", messageId, content: transcript })
      }

      // finished flag is rarely sent by Gemini, but handle it if it comes
      if (finished && !userSpeechEndHandledRef.current) {
        userSpeechEndHandledRef.current = true
        dispatch({
          type: "SET_MESSAGE_STREAMING",
          messageId: lastUserMessageIdRef.current!,
          isStreaming: false,
        })
        dispatch({ type: "SET_PROCESSING" })
        void processUserUtterance()
      }
    },
    [dispatch, processUserUtterance, resetAudioChunks]
  )

  const onModelTranscript = useCallback(
    (text: string, finished: boolean) => {
      if (!text) return

      // On FIRST chunk, add streaming message to array (single element approach)
      if (currentTranscriptRef.current === "") {
        const streamingMessage: CheckInMessage = {
          id: generateId(),
          role: "assistant",
          content: text,
          isStreaming: true,
          timestamp: new Date().toISOString(),
        }
        dispatch({ type: "ADD_MESSAGE", message: streamingMessage })
        currentTranscriptRef.current = text
      } else {
        // Subsequent chunks: update the existing message in place.
        // The Live API may emit either delta chunks or cumulative transcript snapshots,
        // so we merge carefully to avoid duplication/concatenation artifacts.
        const merged = mergeTranscriptUpdate(currentTranscriptRef.current, text)
        currentTranscriptRef.current = merged.next
        if (merged.delta) {
          dispatch({ type: "UPDATE_STREAMING_MESSAGE", text: merged.delta })
        }
      }

      // Some sessions may send transcription completion without a `turnComplete` signal.
      // Use `finished` as an additional boundary so the next turn doesn't append into the
      // previous bubble.
      if (finished) {
        dispatch({ type: "FINALIZE_STREAMING_MESSAGE" })
        currentTranscriptRef.current = ""
      }
    },
    [dispatch]
  )

  const onModelThinking = useCallback(
    (text: string) => {
      // Simple: just accumulate thinking text
      currentThinkingRef.current += text
      dispatch({ type: "APPEND_ASSISTANT_THINKING", text })
    },
    [dispatch]
  )

  const onAudioChunk = useCallback(
    (base64Audio: string) => {
      // If the model starts speaking and we still have a streaming user message,
      // finalize it so it doesn't look "in-progress" throughout the reply.
      const messageId = lastUserMessageIdRef.current
      if (messageId) {
        dispatch({ type: "SET_MESSAGE_STREAMING", messageId, isStreaming: false })
      }
      dispatch({ type: "SET_ASSISTANT_SPEAKING" })
      queueAudio(base64Audio)
    },
    [dispatch, queueAudio]
  )

  const onTurnComplete = useCallback(() => {
    // Finalize the streaming message (just removes isStreaming flag - no DOM change)
    dispatch({ type: "FINALIZE_STREAMING_MESSAGE" })
    // Reset refs for next response
    currentTranscriptRef.current = ""
    currentThinkingRef.current = ""
    // Transition to listening - this handles both AI greeting and regular responses
    dispatch({ type: "SET_LISTENING" })
    pendingUserUtteranceResetRef.current = true
  }, [dispatch])

  const onInterrupted = useCallback(() => {
    // User barged in - clear playback and reset for next response
    clearQueuedAudio()
    currentTranscriptRef.current = ""
    currentThinkingRef.current = ""
    dispatch({ type: "CLEAR_CURRENT_TRANSCRIPTS" })
    dispatch({ type: "SET_USER_SPEAKING" })
  }, [clearQueuedAudio, dispatch])

  const onSilenceChosen = useCallback(
    (reason: string) => {
      // Model chose to stay silent - don't play audio, transition to listening
      console.log("[useCheckIn] AI chose silence:", reason)
      dispatch({ type: "SET_LISTENING" })
      pendingUserUtteranceResetRef.current = true
    },
    [dispatch]
  )

  const sendTextMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return

      // Add user message to conversation
      addUserTextMessage(trimmed)

      // Set state to processing
      dispatch({ type: "SET_PROCESSING" })

      // Send to Gemini
      sendText(trimmed)
    },
    [addUserTextMessage, dispatch, sendText]
  )

  const handlers: CheckInMessagesGeminiHandlers = {
    onUserSpeechStart,
    onUserSpeechEnd,
    onUserTranscript,
    onModelTranscript,
    onModelThinking,
    onAudioChunk,
    onTurnComplete,
    onInterrupted,
    onSilenceChosen,
  }

  return {
    addUserTextMessage,
    sendTextMessage,
    handlers,
  }
}
