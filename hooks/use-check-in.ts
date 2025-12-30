"use client"

/**
 * useCheckIn Hook
 *
 * Master orchestrating hook for conversational check-in feature.
 * Coordinates between Gemini Live API, audio capture, playback,
 * mismatch detection, and conversation state.
 *
 * This is the primary hook UI components interact with.
 */

import { useReducer, useRef, useCallback, useEffect } from "react"
import { useGeminiLive, type GeminiLiveData } from "@/hooks/use-gemini-live"
import { useAudioPlayback } from "@/hooks/use-audio-playback"
import { processAudio } from "@/lib/audio/processor"
import { analyzeVoiceMetrics } from "@/lib/ml/inference"
import { int16ToBase64 } from "@/lib/audio/pcm-converter"
import { createGeminiHeaders } from "@/lib/utils"
import {
  detectMismatch,
  shouldRunMismatchDetection,
  featuresToPatterns,
} from "@/lib/gemini/mismatch-detector"
import {
  generateMismatchContext,
  generateVoicePatternContext,
  generatePostRecordingContext,
  type SystemContextSummary,
  type SystemTimeContext,
} from "@/lib/gemini/live-prompts"
import {
  fetchCheckInContext,
  formatContextForAPI,
} from "@/lib/gemini/check-in-context"
import { computeContextFingerprint } from "@/lib/gemini/context-fingerprint"
import {
  hasPreservedSession as checkPreservedSession,
  getPreservedSession,
  preserveSession as storePreservedSession,
  clearPreservedSession,
  consumePreservedSession,
  markSessionInvalid,
} from "@/lib/gemini/preserved-session"
import { mergeTranscriptUpdate } from "@/lib/gemini/transcript-merge"
import type { SessionContext } from "@/lib/gemini/live-client"
import type {
  CheckInState,
  CheckInMessage,
  CheckInSession,
  AudioFeatures,
  VoiceMetrics,
  MismatchResult,
  VoicePatterns,
  Suggestion,
  WidgetState,
  JournalEntry,
  ScheduleActivityToolArgs,
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

export interface CheckInControls {
  /** Start a new check-in session */
  startSession: (options?: StartSessionOptions) => Promise<void>
  /** End the current session */
  endSession: () => Promise<void>
  /** Cancel session without saving */
  cancelSession: () => void
  /** Get current session for saving */
  getSession: () => CheckInSession | null
  /** Toggle microphone mute */
  toggleMute: () => void
  /** Dismiss an active widget */
  dismissWidget: (widgetId: string) => void
  /** Undo a scheduled activity created via widget */
  undoScheduledActivity: (widgetId: string, suggestionId: string) => Promise<void>
  /** Run a quick action (sends text to Gemini as user) */
  runQuickAction: (widgetId: string, action: string, label?: string) => void
  /** Save a journal entry from a widget */
  saveJournalEntry: (widgetId: string, content: string) => Promise<void>
  /** Trigger a manual tool call (shows widget immediately) */
  triggerManualTool: (toolName: string, args: Record<string, unknown>) => void
  /** Send a text message to Gemini (from chat input) */
  sendTextMessage: (text: string) => void
  /** Preserve session for later resumption (keeps Gemini connected) */
  preserveSession: () => void
  /** Check if there's a preserved session that can be resumed */
  hasPreservedSession: () => boolean
  /** Resume a preserved session */
  resumePreservedSession: () => Promise<void>
  /** Get current context fingerprint (for external invalidation checks) */
  getContextFingerprint: () => Promise<string>
}

export interface StartSessionOptions {
  /** If triggered after a recording, include recording context */
  recordingContext?: {
    recordingId: string
    stressScore: number
    fatigueScore: number
    patterns: VoicePatterns
  }
}

export interface UseCheckInOptions {
  /** Called when session starts */
  onSessionStart?: (session: CheckInSession) => void
  /** Called when session ends */
  onSessionEnd?: (session: CheckInSession) => void
  /** Called when a message is added */
  onMessage?: (message: CheckInMessage) => void
  /** Called when mismatch is detected */
  onMismatch?: (result: MismatchResult) => void
  /** Called on error */
  onError?: (error: Error) => void
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
      const newStreamingId = action.message.isStreaming && action.message.role === "assistant"
        ? action.message.id
        : state.currentStreamingMessageId
      // Don't increment mismatch count here - it will be incremented in UPDATE_MESSAGE_FEATURES
      // when the actual mismatch detection runs
      return {
        ...state,
        messages: newMessages,
        currentStreamingMessageId: newStreamingId,
        session: state.session
          ? { ...state.session, messages: newMessages }
          : null,
      }
    }

    case "UPDATE_MESSAGE_CONTENT": {
      const updatedMessages = state.messages.map((msg) =>
        msg.id === action.messageId
          ? { ...msg, content: action.content }
          : msg
      )

      return {
        ...state,
        messages: updatedMessages,
        session: state.session
          ? { ...state.session, messages: updatedMessages }
          : null,
      }
    }

    case "SET_MESSAGE_STREAMING": {
      const updatedMessages = state.messages.map((msg) =>
        msg.id === action.messageId
          ? { ...msg, isStreaming: action.isStreaming }
          : msg
      )

      return {
        ...state,
        messages: updatedMessages,
        session: state.session
          ? { ...state.session, messages: updatedMessages }
          : null,
      }
    }

    case "UPDATE_MESSAGE_FEATURES":
      // Properly update message with features/metrics/mismatch without mutation
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
      const updatedMismatchCount = action.mismatch.detected
        ? state.mismatchCount + 1
        : state.mismatchCount
      return {
        ...state,
        messages: updatedMessages,
        mismatchCount: updatedMismatchCount,
        session: state.session
          ? {
              ...state.session,
              messages: updatedMessages,
              mismatchCount: updatedMismatchCount,
            }
          : null,
      }

    case "SET_USER_TRANSCRIPT":
      return { ...state, currentUserTranscript: action.text }

    case "SET_ASSISTANT_TRANSCRIPT":
      return { ...state, currentAssistantTranscript: action.text }

    case "APPEND_ASSISTANT_TRANSCRIPT":
      return { ...state, currentAssistantTranscript: state.currentAssistantTranscript + action.text }

    case "UPDATE_STREAMING_MESSAGE": {
      // O(1) lookup using tracked streaming message ID
      if (!state.currentStreamingMessageId) {
        return state
      }

      const streamingMsgIndex = state.messages.findIndex(
        (msg) => msg.id === state.currentStreamingMessageId
      )

      if (streamingMsgIndex === -1) {
        return state
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
        session: state.session
          ? { ...state.session, messages: updatedMsgs }
          : null,
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
        session: state.session
          ? { ...state.session, messages: msgs }
          : null,
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

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function parseLocalDateTime(date: string, time: string): Date | null {
  const [yearStr, monthStr, dayStr] = date.split("-")
  const [hourStr, minuteStr] = time.split(":")

  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)
  const hour = Number(hourStr)
  const minute = Number(minuteStr)

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return null
  }

  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  if (hour < 0 || hour > 23) return null
  if (minute < 0 || minute > 59) return null

  const dt = new Date(year, month - 1, day, hour, minute, 0, 0)

  // Guard against Date overflow rollovers (e.g., 2025-02-31)
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day ||
    dt.getHours() !== hour ||
    dt.getMinutes() !== minute
  ) {
    return null
  }

  return dt
}

// ============================================
// Hook
// ============================================

/**
 * Master hook for conversational check-in
 *
 * @example
 * const [checkIn, controls] = useCheckIn({
 *   onSessionEnd: (session) => saveToDatabase(session),
 *   onMismatch: (result) => console.log('Mismatch detected:', result),
 * })
 *
 * // Start check-in
 * await controls.startSession()
 *
 * // Check state
 * if (checkIn.state === 'user_speaking') {
 *   // Show speaking indicator
 * }
 */
export function useCheckIn(
  options: UseCheckInOptions = {}
): [CheckInData, CheckInControls] {
  const { onSessionStart, onSessionEnd, onMessage, onMismatch, onError } = options

  const [data, dispatch] = useReducer(checkInReducer, initialState)

  // Store callbacks in refs
  const callbacksRef = useRef({ onSessionStart, onSessionEnd, onMessage, onMismatch, onError })
  useEffect(() => {
    callbacksRef.current = { onSessionStart, onSessionEnd, onMessage, onMismatch, onError }
  }, [onSessionStart, onSessionEnd, onMessage, onMismatch, onError])

  // Audio capture refs
  const audioContextRef = useRef<AudioContext | null>(null)
  const captureWorkletRef = useRef<AudioWorkletNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Float32Array[]>([])
  const sessionStartRef = useRef<string | null>(null)

  // Flag to handle race condition: if cleanup is requested during async initialization,
  // the stream obtained from getUserMedia should be stopped immediately
  const cleanupRequestedRef = useRef(false)

  // Counter to track current initialization. If multiple initializations overlap
  // (e.g., due to Fast Refresh), only the most recent one should proceed.
  // Older initializations will see a different ID and abort.
  const initializationIdRef = useRef(0)

  // Track the last user message ID for updating with features
  const lastUserMessageIdRef = useRef<string | null>(null)

  // When VAD "speech start" events are missing, user transcript updates can keep
  // appending into the previous bubble. We treat the end of an assistant turn
  // (returning to listening) as a boundary for the next user utterance.
  // Pattern doc: docs/error-patterns/voice-transcript-utterance-boundary-missing.md
  const pendingUserUtteranceResetRef = useRef(false)

  // Prevent double-handling utterance end (Gemini may emit both "speech end" and a final transcript)
  const userSpeechEndHandledRef = useRef(false)

  // Post-recording context ref
  const postRecordingContextRef = useRef<string | null>(null)

  // Session context for AI-initiated conversations (passed to Gemini connect)
  const sessionContextRef = useRef<SessionContext | null>(null)

  // Context fingerprint for session preservation
  const contextFingerprintRef = useRef<string | null>(null)

  // Track current state for use in callbacks (avoid stale closures)
  const stateRef = useRef<CheckInState>(data.state)

  // Throttle ref for audio level dispatches (60ms interval)
  const lastAudioLevelDispatchRef = useRef<number>(0)
  const AUDIO_LEVEL_THROTTLE_MS = 60

  // Max audio chunks to prevent memory leak (roughly 10 seconds at 100ms chunks)
  const MAX_AUDIO_CHUNKS = 1000

  // Simple transcript accumulation (no complex state tracking needed)
  // Assistant UI handles rendering, we just need to track current content
  const currentTranscriptRef = useRef("")
  const currentThinkingRef = useRef("")

  // Track current user transcript for use in callbacks (avoid stale closures)
  const userTranscriptRef = useRef<string>("")

  // Track when user started speaking (for correct message timestamp ordering)
  const userSpeechStartRef = useRef<string | null>(null)

  // ========================================
  // Storage Helpers (dynamic import)
  // ========================================

  const addSuggestionToDb = useCallback(async (suggestion: Suggestion) => {
    if (typeof indexedDB === "undefined") {
      throw new Error("IndexedDB not available")
    }
    const { db, fromSuggestion } = await import("@/lib/storage/db")
    await db.suggestions.add(fromSuggestion(suggestion))
  }, [])

  const deleteSuggestionFromDb = useCallback(async (suggestionId: string) => {
    if (typeof indexedDB === "undefined") {
      throw new Error("IndexedDB not available")
    }
    const { db } = await import("@/lib/storage/db")
    await db.suggestions.delete(suggestionId)
  }, [])

  const addJournalEntryToDb = useCallback(async (entry: JournalEntry) => {
    if (typeof indexedDB === "undefined") {
      throw new Error("IndexedDB not available")
    }
    const { db, fromJournalEntry } = await import("@/lib/storage/db")
    await db.journalEntries.add(fromJournalEntry(entry))
  }, [])

  // ========================================
  // Gemini Live Hook
  // ========================================

  const [gemini, geminiControls] = useGeminiLive({
    onConnected: () => {
      dispatch({ type: "SET_READY" })
      dispatch({ type: "SET_AI_GREETING" })

      // Trigger AI to speak first by sending the conversation start signal
      // The system instruction tells the AI to greet the user when it receives this
      geminiControls.sendText("[START_CONVERSATION]")

      // If post-recording context was provided, inject it after a brief delay
      // to let the greeting start first
      if (postRecordingContextRef.current) {
        setTimeout(() => {
          if (postRecordingContextRef.current) {
            geminiControls.sendText(postRecordingContextRef.current)
            postRecordingContextRef.current = null
          }
        }, 500)
      }
    },
    onDisconnected: (reason) => {
      console.log("[useCheckIn] Disconnected:", reason)
      const currentState = stateRef.current

      // Always release microphone + playback resources on disconnect.
      // This prevents the browser from thinking the mic is still active
      // after leaving AI chat or when the server drops the connection.
      cleanupAudioCapture()
      playbackControls.cleanup()

      // Only auto-complete if we were in an active state (user had chance to interact)
      const activeStates: CheckInState[] = [
        "ready",
        "ai_greeting",
        "listening",
        "user_speaking",
        "processing",
        "assistant_speaking",
      ]

      if (activeStates.includes(currentState)) {
        dispatch({ type: "SET_COMPLETE" })
      } else if (currentState !== "complete" && currentState !== "error") {
        // Disconnected during initialization - show error
        dispatch({
          type: "SET_ERROR",
          error: reason || "Connection failed during initialization",
        })
      }
    },
    onError: (error) => {
      dispatch({ type: "SET_ERROR", error: error.message })
      callbacksRef.current.onError?.(error)
    },
    onUserSpeechStart: () => {
      dispatch({ type: "SET_USER_SPEAKING" })
      audioChunksRef.current = [] // Start collecting audio for this utterance
      userTranscriptRef.current = "" // Reset accumulated transcript for new utterance
      dispatch({ type: "SET_USER_TRANSCRIPT", text: "" })
      // Clear the active voice message ID for this new utterance
      lastUserMessageIdRef.current = null
      pendingUserUtteranceResetRef.current = false
      userSpeechEndHandledRef.current = false
      userSpeechStartRef.current = new Date().toISOString() // Capture timestamp when user STARTS speaking
    },
    onUserSpeechEnd: () => {
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
      processUserUtterance()
    },
    onUserTranscript: (text, finished) => {
      // If the previous turn ended and we never received a VAD "speech start" for
      // this utterance, ensure we don't keep appending into the last user bubble.
      if (pendingUserUtteranceResetRef.current && text.trim()) {
        pendingUserUtteranceResetRef.current = false
        audioChunksRef.current = []
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
        dispatch({ type: "SET_MESSAGE_STREAMING", messageId: lastUserMessageIdRef.current!, isStreaming: false })
        dispatch({ type: "SET_PROCESSING" })
        processUserUtterance()
      }
    },
    onModelTranscript: (text, finished) => {
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
    onModelThinking: (text) => {
      // Simple: just accumulate thinking text
      currentThinkingRef.current += text
      dispatch({ type: "APPEND_ASSISTANT_THINKING", text })
    },
    onAudioChunk: (base64Audio) => {
      // If the model starts speaking and we still have a streaming user message,
      // finalize it so it doesn't look "in-progress" throughout the reply.
      const messageId = lastUserMessageIdRef.current
      if (messageId) {
        dispatch({ type: "SET_MESSAGE_STREAMING", messageId, isStreaming: false })
      }
      dispatch({ type: "SET_ASSISTANT_SPEAKING" })
      playbackControls.queueAudio(base64Audio)
    },
    onTurnComplete: () => {
      // Finalize the streaming message (just removes isStreaming flag - no DOM change)
      dispatch({ type: "FINALIZE_STREAMING_MESSAGE" })
      // Reset refs for next response
      currentTranscriptRef.current = ""
      currentThinkingRef.current = ""
      // Transition to listening - this handles both AI greeting and regular responses
      dispatch({ type: "SET_LISTENING" })
      pendingUserUtteranceResetRef.current = true
    },
    onInterrupted: () => {
      // User barged in - clear playback and reset for next response
      playbackControls.clearQueue()
      currentTranscriptRef.current = ""
      currentThinkingRef.current = ""
      dispatch({ type: "CLEAR_CURRENT_TRANSCRIPTS" })
      dispatch({ type: "SET_USER_SPEAKING" })
    },
    onSilenceChosen: (reason) => {
      // Model chose to stay silent - don't play audio, transition to listening
      console.log("[useCheckIn] AI chose silence:", reason)
      dispatch({ type: "SET_LISTENING" })
      pendingUserUtteranceResetRef.current = true
    },
    onWidget: (event) => {
      const now = new Date().toISOString()

      if (event.widget === "schedule_activity") {
        const widgetId = generateId()
        const suggestionId = generateId()

        const scheduledAt = parseLocalDateTime(event.args.date, event.args.time)
        if (!scheduledAt) {
          dispatch({
            type: "ADD_WIDGET",
            widget: {
              id: widgetId,
              type: "schedule_activity",
              createdAt: now,
              args: event.args,
              status: "failed",
              error: "Invalid date/time",
            },
          })
          return
        }

        const suggestion: Suggestion = {
          id: suggestionId,
          content: event.args.title,
          rationale: "Scheduled from AI chat",
          duration: event.args.duration,
          category: event.args.category,
          status: "scheduled",
          createdAt: now,
          scheduledFor: scheduledAt.toISOString(),
        }

        // Optimistically show confirmation, then mark failed if Dexie write fails.
        dispatch({
          type: "ADD_WIDGET",
          widget: {
            id: widgetId,
            type: "schedule_activity",
            createdAt: now,
            args: event.args,
            status: "scheduled",
            suggestionId,
          },
        })

        void (async () => {
          try {
            await addSuggestionToDb(suggestion)
          } catch (error) {
            dispatch({
              type: "UPDATE_WIDGET",
              widgetId,
              updates: {
                status: "failed",
                error: error instanceof Error ? error.message : "Failed to save",
                suggestionId: undefined,
              },
            })
          }
        })()
        return
      }

      if (event.widget === "breathing_exercise") {
        dispatch({
          type: "ADD_WIDGET",
          widget: {
            id: generateId(),
            type: "breathing_exercise",
            createdAt: now,
            args: event.args,
          },
        })
        return
      }

      if (event.widget === "stress_gauge") {
        dispatch({
          type: "ADD_WIDGET",
          widget: {
            id: generateId(),
            type: "stress_gauge",
            createdAt: now,
            args: event.args,
          },
        })
        return
      }

      if (event.widget === "quick_actions") {
        dispatch({
          type: "ADD_WIDGET",
          widget: {
            id: generateId(),
            type: "quick_actions",
            createdAt: now,
            args: event.args,
          },
        })
        return
      }

      if (event.widget === "journal_prompt") {
        dispatch({
          type: "ADD_WIDGET",
          widget: {
            id: generateId(),
            type: "journal_prompt",
            createdAt: now,
            args: event.args,
            status: "draft",
          },
        })
      }
    },
  })

  // Sync connection state
  useEffect(() => {
    dispatch({ type: "SET_CONNECTION_STATE", state: gemini.state })
  }, [gemini.state])

  // Sync stateRef with current state (for use in callbacks)
  useEffect(() => {
    stateRef.current = data.state
  }, [data.state])

  // Sync userTranscriptRef with current user transcript (for use in callbacks)
  useEffect(() => {
    userTranscriptRef.current = data.currentUserTranscript
  }, [data.currentUserTranscript])

  // ========================================
  // Audio Playback Hook
  // ========================================

  const [playback, playbackControls] = useAudioPlayback({
    onPlaybackStart: () => {
      dispatch({ type: "SET_ASSISTANT_SPEAKING" })
    },
    onPlaybackEnd: () => {
      // Use stateRef.current instead of data.state to avoid stale closure
      if (stateRef.current === "assistant_speaking") {
        dispatch({ type: "SET_LISTENING" })
      }
    },
    onAudioLevel: (level) => {
      dispatch({ type: "SET_OUTPUT_LEVEL", level })
    },
  })

  // ========================================
  // Message Handlers
  // ========================================

  const addUserTextMessage = useCallback((content: string) => {
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
  }, [])

  // ========================================
  // Widget Controls
  // ========================================

  const dismissWidget = useCallback((widgetId: string) => {
    dispatch({ type: "DISMISS_WIDGET", widgetId })
  }, [])

  const undoScheduledActivity = useCallback(
    async (widgetId: string, suggestionId: string) => {
      try {
        await deleteSuggestionFromDb(suggestionId)
        dispatch({ type: "DISMISS_WIDGET", widgetId })
      } catch (error) {
        dispatch({
          type: "UPDATE_WIDGET",
          widgetId,
          updates: {
            error: error instanceof Error ? error.message : "Failed to undo",
          },
        })
      }
    },
    [deleteSuggestionFromDb]
  )

  const runQuickAction = useCallback(
    (widgetId: string, action: string, label?: string) => {
      const textToShow = (label?.trim() || action).trim()
      if (!textToShow) return

      addUserTextMessage(textToShow)
      dispatch({ type: "SET_PROCESSING" })
      geminiControls.sendText(action)
      dispatch({ type: "DISMISS_WIDGET", widgetId })
    },
    [addUserTextMessage, geminiControls]
  )

  const saveJournalEntry = useCallback(
    async (widgetId: string, content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return

      const widget = data.widgets.find(
        (w) => w.id === widgetId && w.type === "journal_prompt"
      )

      if (!widget || widget.type !== "journal_prompt") {
        console.warn("[useCheckIn] Journal widget not found:", widgetId)
        return
      }

      const entry: JournalEntry = {
        id: generateId(),
        createdAt: new Date().toISOString(),
        category: widget.args.category || "journal",
        prompt: widget.args.prompt,
        content: trimmed,
        checkInSessionId: data.session?.id,
      }

      try {
        await addJournalEntryToDb(entry)
        dispatch({
          type: "UPDATE_WIDGET",
          widgetId,
          updates: {
            status: "saved",
            entryId: entry.id,
            error: undefined,
          },
        })
      } catch (error) {
        dispatch({
          type: "UPDATE_WIDGET",
          widgetId,
          updates: {
            status: "failed",
            error: error instanceof Error ? error.message : "Failed to save",
          },
        })
      }
    },
    [addJournalEntryToDb, data.session?.id, data.widgets]
  )

  // ========================================
  // Manual Tool Triggering
  // ========================================

  /**
   * Trigger a tool manually from the chat input.
   * Creates the same widget as if Gemini had called the tool.
   */
  const triggerManualTool = useCallback(
    (toolName: string, args: Record<string, unknown>) => {
      const now = new Date().toISOString()

      switch (toolName) {
        case "show_breathing_exercise": {
          dispatch({
            type: "ADD_WIDGET",
            widget: {
              id: generateId(),
              type: "breathing_exercise",
              createdAt: now,
              args: {
                type: (args.type as "box" | "478" | "relaxing") || "box",
                duration: (args.duration as number) || 120,
              },
            },
          })
          break
        }

        case "schedule_activity": {
          const widgetId = generateId()
          const suggestionId = generateId()

          const scheduledAt = parseLocalDateTime(
            args.date as string,
            args.time as string
          )

          if (!scheduledAt) {
            dispatch({
              type: "ADD_WIDGET",
              widget: {
                id: widgetId,
                type: "schedule_activity",
                createdAt: now,
                args: {
                  title: args.title,
                  category: args.category,
                  date: args.date,
                  time: args.time,
                  duration: args.duration,
                } as ScheduleActivityToolArgs,
                status: "failed",
                error: "Invalid date/time",
              },
            })
            return
          }

          const suggestion: Suggestion = {
            id: suggestionId,
            content: args.title as string,
            rationale: "Manually scheduled from chat",
            duration: args.duration as number,
            category: args.category as "break" | "exercise" | "mindfulness" | "social" | "rest",
            status: "scheduled",
            createdAt: now,
            scheduledFor: scheduledAt.toISOString(),
          }

          dispatch({
            type: "ADD_WIDGET",
            widget: {
              id: widgetId,
              type: "schedule_activity",
              createdAt: now,
              args: {
                title: args.title,
                category: args.category,
                date: args.date,
                time: args.time,
                duration: args.duration,
              } as ScheduleActivityToolArgs,
              status: "scheduled",
              suggestionId,
            },
          })

          void (async () => {
            try {
              await addSuggestionToDb(suggestion)
            } catch (error) {
              dispatch({
                type: "UPDATE_WIDGET",
                widgetId,
                updates: {
                  status: "failed",
                  error: error instanceof Error ? error.message : "Failed to save",
                  suggestionId: undefined,
                },
              })
            }
          })()
          break
        }

        case "show_stress_gauge": {
          // For manual trigger without args, use defaults or latest mismatch data
          dispatch({
            type: "ADD_WIDGET",
            widget: {
              id: generateId(),
              type: "stress_gauge",
              createdAt: now,
              args: {
                stressLevel: (args.stressLevel as number) ??
                  (data.latestMismatch?.acousticSignal === "stressed" ? 70 : 40),
                fatigueLevel: (args.fatigueLevel as number) ??
                  (data.latestMismatch?.acousticSignal === "fatigued" ? 70 : 40),
                message: (args.message as string) || "Manual check-in",
              },
            },
          })
          break
        }

        case "show_journal_prompt": {
          // Generate a default prompt based on category or use provided
          const category = (args.category as string) || "reflection"
          const defaultPrompts: Record<string, string> = {
            reflection: "What's on your mind right now?",
            gratitude: "What are you grateful for today?",
            stress: "What's causing you stress, and how can you address it?",
          }

          dispatch({
            type: "ADD_WIDGET",
            widget: {
              id: generateId(),
              type: "journal_prompt",
              createdAt: now,
              args: {
                prompt: (args.prompt as string) || defaultPrompts[category] || defaultPrompts.reflection,
                placeholder: (args.placeholder as string) || "Write your thoughts here...",
                category,
              },
              status: "draft",
            },
          })
          break
        }

        default:
          console.warn("[useCheckIn] Unknown manual tool:", toolName)
      }
    },
    [addSuggestionToDb, data.latestMismatch]
  )

  /**
   * Send a text message to Gemini from the chat input.
   * Adds the message to the conversation and sends to the API.
   */
  const sendTextMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return

      // Add user message to conversation
      addUserTextMessage(trimmed)

      // Set state to processing
      dispatch({ type: "SET_PROCESSING" })

      // Send to Gemini
      geminiControls.sendText(trimmed)
    },
    [addUserTextMessage, geminiControls]
  )

  // ========================================
  // Mismatch Detection
  // ========================================

  const processUserUtterance = useCallback(async () => {
    const chunks = audioChunksRef.current
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
        const mismatchResult = detectMismatch(
          data.currentUserTranscript,
          result.features,
          metrics
        )

        dispatch({ type: "SET_MISMATCH", result: mismatchResult })

        if (mismatchResult.detected) {
          // Inject context into Gemini conversation
          const context = generateMismatchContext(mismatchResult)
          geminiControls.injectContext(context)
          callbacksRef.current.onMismatch?.(mismatchResult)
        }

        // Also periodically inject voice pattern context
        const patterns = featuresToPatterns(result.features)
        const patternContext = generateVoicePatternContext(patterns, metrics)
        geminiControls.injectContext(patternContext)

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

    // Clear chunks for next utterance
    audioChunksRef.current = []
  }, [data.currentUserTranscript, geminiControls])

  // ========================================
  // Audio Capture
  // ========================================

  const initializeAudioCapture = useCallback(async () => {
    // Capture the current initialization ID - if this changes during async operations,
    // it means a newer initialization has started and we should abort
    const currentInitId = ++initializationIdRef.current

    // Helper to check abort reason
    const getAbortReason = (): "cleanup" | "superseded" | null => {
      if (cleanupRequestedRef.current) return "cleanup"
      if (initializationIdRef.current !== currentInitId) return "superseded"
      return null
    }

    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      // Check if we should abort after getUserMedia resolved
      const abortReason = getAbortReason()
      if (abortReason) {
        console.log(`[useCheckIn] Initialization aborted after getUserMedia (${abortReason})`)
        stream.getTracks().forEach((track) => track.stop())
        // Use different error for superseded vs cleanup
        throw new Error(abortReason === "superseded" ? "SESSION_SUPERSEDED" : "INITIALIZATION_ABORTED")
      }

      mediaStreamRef.current = stream

      // Create audio context at 16kHz
      const audioContext = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioContext

      // Resume if suspended
      if (audioContext.state === "suspended") {
        await audioContext.resume()
      }

      // Check abort conditions after resume
      const abortAfterResume = getAbortReason()
      if (abortAfterResume) {
        console.log(`[useCheckIn] Initialization aborted after audioContext.resume (${abortAfterResume})`)
        stream.getTracks().forEach((track) => track.stop())
        mediaStreamRef.current = null
        // Check if context isn't already closed (e.g., by concurrent cleanup)
        // See: docs/error-patterns/audiocontext-double-close.md
        if (audioContext.state !== "closed") {
          audioContext.close()
        }
        audioContextRef.current = null
        throw new Error(abortAfterResume === "superseded" ? "SESSION_SUPERSEDED" : "INITIALIZATION_ABORTED")
      }

      // Also check if context was closed (e.g., by cleanup running during resume)
      if ((audioContext.state as string) === "closed") {
        console.log("[useCheckIn] AudioContext closed during initialization, aborting")
        stream.getTracks().forEach((track) => track.stop())
        mediaStreamRef.current = null
        throw new Error("INITIALIZATION_ABORTED")
      }

      // Load capture worklet
      await audioContext.audioWorklet.addModule("/capture.worklet.js")

      // Check abort conditions after module loading
      const abortAfterModule = getAbortReason()
      if (abortAfterModule) {
        console.log(`[useCheckIn] Initialization aborted after addModule (${abortAfterModule})`)
        stream.getTracks().forEach((track) => track.stop())
        mediaStreamRef.current = null
        // Check if context isn't already closed (e.g., by concurrent cleanup)
        // See: docs/error-patterns/audiocontext-double-close.md
        if (audioContext.state !== "closed") {
          audioContext.close()
        }
        audioContextRef.current = null
        throw new Error(abortAfterModule === "superseded" ? "SESSION_SUPERSEDED" : "INITIALIZATION_ABORTED")
      }

      // Also check if context was closed during module loading
      if ((audioContext.state as string) === "closed") {
        console.log("[useCheckIn] AudioContext closed during module loading, aborting")
        stream.getTracks().forEach((track) => track.stop())
        mediaStreamRef.current = null
        throw new Error("INITIALIZATION_ABORTED")
      }

      // Create worklet node
      const captureWorklet = new AudioWorkletNode(audioContext, "capture-processor")

      // Connect microphone to worklet
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(captureWorklet)

      // Handle audio chunks from worklet
      captureWorklet.port.onmessage = (event) => {
        if (event.data.type === "audio") {
          const pcmBuffer = event.data.pcm as ArrayBuffer
          const int16Data = new Int16Array(pcmBuffer)

          // Convert to base64 and send to Gemini
          const base64Audio = int16ToBase64(int16Data)
          geminiControls.sendAudio(base64Audio)

          // Also store for mismatch detection
          const float32Data = new Float32Array(int16Data.length)
          for (let i = 0; i < int16Data.length; i++) {
            float32Data[i] = int16Data[i] / (int16Data[i] < 0 ? 0x8000 : 0x7fff)
          }
          // Prevent memory leak by dropping oldest chunks if at limit
          if (audioChunksRef.current.length >= MAX_AUDIO_CHUNKS) {
            audioChunksRef.current.shift()
          }
          audioChunksRef.current.push(float32Data)

          // Calculate input level for visualization (throttled to reduce re-renders)
          const now = Date.now()
          if (now - lastAudioLevelDispatchRef.current >= AUDIO_LEVEL_THROTTLE_MS) {
            let sum = 0
            for (let i = 0; i < float32Data.length; i++) {
              sum += float32Data[i] * float32Data[i]
            }
            const rms = Math.sqrt(sum / float32Data.length)
            dispatch({ type: "SET_INPUT_LEVEL", level: Math.min(rms * 5, 1) })
            lastAudioLevelDispatchRef.current = now
          }
        }
      }

      captureWorkletRef.current = captureWorklet
    } catch (error) {
      // Re-throw abort errors directly so startSession can handle them appropriately
      if (error instanceof Error &&
          (error.message === "INITIALIZATION_ABORTED" || error.message === "SESSION_SUPERSEDED")) {
        throw error
      }
      throw new Error(
        `Failed to initialize audio capture: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }, [geminiControls])

  const cleanupAudioCapture = useCallback(() => {
    // Mark cleanup as requested - this handles the race condition where
    // getUserMedia might resolve AFTER cleanup is called
    cleanupRequestedRef.current = true

    // Stop microphone
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        track.stop()
        // Verify track is actually stopped
        if (track.readyState !== "ended") {
          console.warn("[useCheckIn] Track not stopped after .stop():", track.readyState)
        }
      })
      mediaStreamRef.current = null
    }

    // Clear message handler before disconnect (prevents memory leaks)
    if (captureWorkletRef.current) {
      captureWorkletRef.current.port.onmessage = null
      captureWorkletRef.current.disconnect()
      captureWorkletRef.current = null
    }

    // Close audio context if not already closed
    // See: docs/error-patterns/audiocontext-double-close.md
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close()
    }
    audioContextRef.current = null

    audioChunksRef.current = []
  }, [])

  // ========================================
  // Session Controls
  // ========================================

  const startSession = useCallback(
    async (startOptions?: StartSessionOptions) => {
      // Track what's been initialized for proper cleanup on failure
      let playbackInitialized = false
      let captureInitialized = false

      try {
        dispatch({ type: "START_INITIALIZING" })

        // Reset the cleanup abort flag for this new session
        cleanupRequestedRef.current = false

        // Create new session
        const session: CheckInSession = {
          id: generateId(),
          startedAt: new Date().toISOString(),
          messages: [],
          recordingId: startOptions?.recordingContext?.recordingId,
        }
        dispatch({ type: "SET_SESSION", session })
        sessionStartRef.current = session.startedAt

        // Compute context fingerprint for session preservation
        // This allows us to detect if data changed while session was preserved
        contextFingerprintRef.current = await computeContextFingerprint()

        // Generate post-recording context if applicable
        if (startOptions?.recordingContext) {
          const { stressScore, fatigueScore, patterns } = startOptions.recordingContext
          postRecordingContextRef.current = generatePostRecordingContext(
            stressScore,
            fatigueScore,
            patterns
          )
        }

        // Fetch context for AI-initiated conversation (runs in parallel with audio init)
        let sessionContext: SessionContext | undefined
        try {
          const contextData = await fetchCheckInContext()
          const formattedContext = formatContextForAPI(contextData)

          // Always include time context in the system instruction (even if context-summary generation fails).
          sessionContext = {
            timeContext: {
              currentTime: contextData.timeContext.currentTime,
              dayOfWeek: contextData.timeContext.dayOfWeek,
              timeOfDay: contextData.timeContext.timeOfDay,
              daysSinceLastCheckIn: contextData.timeContext.daysSinceLastCheckIn,
            } as SystemTimeContext,
          }

          // Best-effort: generate a richer context summary using Gemini 3
          try {
            const headers = await createGeminiHeaders({
              "Content-Type": "application/json",
            })

            const contextResponse = await fetch("/api/gemini/check-in-context", {
              method: "POST",
              headers,
              body: JSON.stringify(formattedContext),
            })

            if (contextResponse.ok) {
              const { summary } = await contextResponse.json()
              sessionContext.contextSummary = summary as SystemContextSummary
              console.log("[useCheckIn] Context summary prepared for AI-initiated conversation")
            } else {
              console.warn("[useCheckIn] Context summary request failed, using time-only context")
            }
          } catch (summaryError) {
            console.warn("[useCheckIn] Context summary request errored, using time-only context:", summaryError)
          }

          sessionContextRef.current = sessionContext
        } catch (contextError) {
          // Context generation failed - proceed without it (AI will use default greeting)
          console.warn("[useCheckIn] Context generation failed, using default greeting:", contextError)
        }

        // Initialize playback first (needs user gesture context)
        // This loads the playback worklet module
        await playbackControls.initialize()
        playbackInitialized = true

        // Initialize audio capture AFTER playback to avoid worklet loading race
        // Some browsers can only load one AudioWorklet module at a time
        await initializeAudioCapture()
        captureInitialized = true

        dispatch({ type: "SET_CONNECTING" })

        // Connect to Gemini with session context for AI-initiated greeting
        await geminiControls.connect(sessionContext)

        callbacksRef.current.onSessionStart?.(session)
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Failed to start session")

        // INITIALIZATION_ABORTED is expected in React StrictMode - the first mount's
        // async initialization is aborted when StrictMode unmounts the component.
        // The second mount will succeed, so we silently clean up without showing errors.
        if (err.message === "INITIALIZATION_ABORTED") {
          console.log("[useCheckIn] Session initialization aborted (StrictMode cleanup)")
          // Cleanup only what was initialized (in reverse order)
          if (captureInitialized) {
            cleanupAudioCapture()
          }
          if (playbackInitialized) {
            playbackControls.cleanup()
          }
          // Reset to idle so second mount can try again
          dispatch({ type: "RESET" })
          return
        }

        // SESSION_SUPERSEDED means a newer session started while this one was initializing.
        // Just silently exit - the new session is handling things now.
        // DON'T dispatch RESET or it will trigger auto-start and create an infinite loop.
        if (err.message === "SESSION_SUPERSEDED") {
          console.log("[useCheckIn] Session superseded by newer initialization")
          // Don't cleanup - the new session owns the resources now
          // Don't dispatch anything - let the new session handle state
          return
        }

        // Real errors get shown to the user
        dispatch({ type: "SET_ERROR", error: err.message })
        callbacksRef.current.onError?.(err)

        // Cleanup only what was initialized (in reverse order)
        if (captureInitialized) {
          cleanupAudioCapture()
        }
        if (playbackInitialized) {
          playbackControls.cleanup()
        }
      }
    },
    [geminiControls, playbackControls, initializeAudioCapture, cleanupAudioCapture]
  )

  const endSession = useCallback(async () => {
    dispatch({ type: "SET_ENDING" })

    // Clear any preserved session (user explicitly ended, don't preserve)
    clearPreservedSession(false) // false = don't disconnect, we'll do it below

    // Calculate session duration
    const duration = sessionStartRef.current
      ? (Date.now() - new Date(sessionStartRef.current).getTime()) / 1000
      : 0

    // Update session with final data
    const finalSession: CheckInSession | null = data.session
      ? {
          ...data.session,
          endedAt: new Date().toISOString(),
          messages: data.messages,
          mismatchCount: data.mismatchCount,
          duration,
        }
      : null

    // Cleanup with error handling - continue cleanup even if one fails
    const cleanupErrors: Error[] = []

    try {
      cleanupAudioCapture()
    } catch (error) {
      cleanupErrors.push(
        error instanceof Error ? error : new Error("Audio capture cleanup failed")
      )
    }

    try {
      playbackControls.cleanup()
    } catch (error) {
      cleanupErrors.push(
        error instanceof Error ? error : new Error("Playback cleanup failed")
      )
    }

    try {
      geminiControls.disconnect()
    } catch (error) {
      cleanupErrors.push(
        error instanceof Error ? error : new Error("Gemini disconnect failed")
      )
    }

    // Log cleanup errors but don't fail the session end
    if (cleanupErrors.length > 0) {
      console.error("[useCheckIn] Cleanup errors:", cleanupErrors)
    }

    dispatch({ type: "SET_COMPLETE" })

    if (finalSession) {
      callbacksRef.current.onSessionEnd?.(finalSession)
    }
  }, [data.session, data.messages, data.mismatchCount, geminiControls, playbackControls, cleanupAudioCapture])

  const cancelSession = useCallback(() => {
    cleanupAudioCapture()
    playbackControls.cleanup()
    geminiControls.disconnect()
    dispatch({ type: "RESET" })
  }, [geminiControls, playbackControls, cleanupAudioCapture])

  const getSession = useCallback(() => {
    if (!data.session) return null

    const duration = sessionStartRef.current
      ? (Date.now() - new Date(sessionStartRef.current).getTime()) / 1000
      : 0

    return {
      ...data.session,
      endedAt: data.session.endedAt || new Date().toISOString(),
      messages: data.messages,
      mismatchCount: data.mismatchCount,
      duration,
    }
  }, [data.session, data.messages, data.mismatchCount])

  const toggleMute = useCallback(() => {
    if (!mediaStreamRef.current) {
      console.warn("[useCheckIn] Cannot toggle mute: no media stream")
      return
    }

    const audioTrack = mediaStreamRef.current.getAudioTracks()[0]
    if (!audioTrack) {
      console.warn("[useCheckIn] Cannot toggle mute: no audio track")
      return
    }

    // Toggle the track's enabled state
    audioTrack.enabled = !audioTrack.enabled
    dispatch({ type: "SET_MUTED", muted: !audioTrack.enabled })
  }, [])

  // ========================================
  // Session Preservation
  // ========================================

  /**
   * Preserve the current session for later resumption.
   * Keeps the Gemini connection alive but cleans up local audio resources.
   */
  const preserveSession = useCallback(() => {
    const client = geminiControls.getClient()
    if (!client || !client.isConnectionHealthy()) {
      console.warn("[useCheckIn] Cannot preserve - no healthy connection")
      return
    }

    if (!contextFingerprintRef.current) {
      console.warn("[useCheckIn] Cannot preserve - no context fingerprint")
      return
    }

    // Detach event handlers from the client (stops React from receiving events)
    client.detachEventHandlers()

    // Store the session in the preservation store
    storePreservedSession(client, data, contextFingerprintRef.current)

    // Cleanup local audio resources (but keep Gemini connected)
    cleanupAudioCapture()
    playbackControls.cleanup()

    // Reset local state (session is now preserved externally)
    dispatch({ type: "RESET" })

    console.log("[useCheckIn] Session preserved")
  }, [geminiControls, data, cleanupAudioCapture, playbackControls])

  /**
   * Check if there's a preserved session that can be resumed.
   */
  const hasPreservedSession = useCallback(() => {
    return checkPreservedSession()
  }, [])

  /**
   * Resume a preserved session.
   * Restores state, reinitializes audio, and reattaches to the existing Gemini connection.
   */
  const resumePreservedSession = useCallback(async () => {
    const preserved = consumePreservedSession()
    if (!preserved) {
      console.warn("[useCheckIn] No preserved session to resume")
      return
    }

    try {
      // Check if the connection is still healthy
      if (!preserved.client.isConnectionHealthy()) {
        console.warn("[useCheckIn] Preserved connection is no longer healthy")
        markSessionInvalid()
        throw new Error("Preserved connection lost")
      }

      // Restore the reducer state from the preserved snapshot
      // We need to dispatch actions to restore the state
      dispatch({ type: "START_INITIALIZING" })

      // Initialize audio resources
      await playbackControls.initialize()
      await initializeAudioCapture()

      // Reattach to the existing Gemini client
      geminiControls.reattachToClient(preserved.client)

      // Restore the context fingerprint
      contextFingerprintRef.current = preserved.contextFingerprint

      // Restore session data
      if (preserved.checkInData.session) {
        dispatch({ type: "SET_SESSION", session: preserved.checkInData.session })
        sessionStartRef.current = preserved.checkInData.session.startedAt
      }

      // Restore messages by replaying them
      for (const message of preserved.checkInData.messages) {
        dispatch({ type: "ADD_MESSAGE", message })
      }

      // Restore active widgets
      for (const widget of preserved.checkInData.widgets) {
        dispatch({ type: "ADD_WIDGET", widget })
      }

      // Set the appropriate state based on what was preserved
      dispatch({ type: "SET_READY" })
      dispatch({ type: "SET_LISTENING" })

      console.log("[useCheckIn] Session resumed successfully")
    } catch (error) {
      console.error("[useCheckIn] Failed to resume session:", error)
      // If resume fails, clean up and let caller handle
      cleanupAudioCapture()
      playbackControls.cleanup()
      dispatch({ type: "RESET" })
      throw error
    }
  }, [geminiControls, playbackControls, initializeAudioCapture, cleanupAudioCapture])

  /**
   * Get the current context fingerprint for external invalidation checks.
   */
  const getContextFingerprint = useCallback(async () => {
    return computeContextFingerprint()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudioCapture()
    }
  }, [cleanupAudioCapture])

  const controls: CheckInControls = {
    startSession,
    endSession,
    cancelSession,
    getSession,
    toggleMute,
    dismissWidget,
    undoScheduledActivity,
    runQuickAction,
    saveJournalEntry,
    triggerManualTool,
    sendTextMessage,
    preserveSession,
    hasPreservedSession,
    resumePreservedSession,
    getContextFingerprint,
  }

  return [data, controls]
}
