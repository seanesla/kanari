import type { GeminiConnectionState } from "@/hooks/use-gemini-live"
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

/**
 * Initialization phases during check-in startup
 * These represent real events from the system, not hardcoded timers
 */
export type InitPhase =
  | "fetching_context"     // Fetching context from IndexedDB + optional Gemini API
  | "init_audio_playback"  // Setting up AudioContext + worklet for playback
  | "init_audio_capture"   // getUserMedia + worklet for mic input
  | "connecting_gemini"    // WebSocket connection to Gemini Live API
  | "waiting_ai_response"  // Connected, waiting for AI to generate first response
  | null                   // Not in init phase

export interface CheckInData {
  /** Current check-in state */
  state: CheckInState
  /** Current initialization phase (null when not initializing) */
  initPhase: InitPhase
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
  connectionState: GeminiConnectionState
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
  | { type: "SET_INIT_PHASE"; phase: InitPhase }
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
  | { type: "SET_MESSAGE_SILENCE_TRIGGERED"; messageId: string }
  | {
      type: "UPDATE_MESSAGE_FEATURES"
      messageId: string
      features: AudioFeatures
      metrics: VoiceMetrics
      mismatch: MismatchResult
    }
  | {
      type: "SET_SESSION_ACOUSTIC_METRICS"
      metrics: CheckInSession["acousticMetrics"] | null
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
  | { type: "SET_CONNECTION_STATE"; state: GeminiConnectionState }
  | { type: "SET_ERROR"; error: string }
  | { type: "SET_MUTED"; muted: boolean }
  | { type: "ADD_WIDGET"; widget: WidgetState }
  | { type: "UPDATE_WIDGET"; widgetId: string; updates: Partial<WidgetState> }
  | { type: "DISMISS_WIDGET"; widgetId: string }
  | { type: "RESET" }

export const initialState: CheckInData = {
  state: "idle",
  initPhase: null,
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
      return { ...initialState, state: "initializing", initPhase: "fetching_context" }

    case "SET_INIT_PHASE":
      return { ...state, initPhase: action.phase }

    case "SET_CONNECTING":
      return { ...state, state: "connecting" }

    case "SET_READY":
      return { ...state, state: "ready", initPhase: null, isActive: true }

    case "SET_AI_GREETING":
      return { ...state, state: "ai_greeting", initPhase: null }

    case "SET_LISTENING":
      return { ...state, state: "listening", initPhase: null }

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

    case "SET_MESSAGE_SILENCE_TRIGGERED": {
      const updatedMessages = state.messages.map((msg) =>
        msg.id === action.messageId ? { ...msg, silenceTriggered: true } : msg
      )
      return {
        ...state,
        messages: updatedMessages,
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

    case "SET_SESSION_ACOUSTIC_METRICS": {
      if (!state.session) return state

      return {
        ...state,
        session: {
          ...state.session,
          acousticMetrics: action.metrics ?? undefined,
        },
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
