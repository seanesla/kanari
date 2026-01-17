"use client"

/**
 * useCheckIn Hook
 *
 * Master orchestrating hook for conversational check-in feature.
 * Composes sub-hooks for audio capture, session lifecycle, widget handling,
 * and transcript/message state.
 *
 * External behavior should remain unchanged.
 */

import { useCallback, useEffect, useReducer, useRef } from "react"
import { useAudioPlayback } from "@/hooks/use-audio-playback"
import { useGeminiLive, type GeminiLiveControls } from "@/hooks/use-gemini-live"
import type { GeminiLiveClient, SessionContext } from "@/lib/gemini/live-client"
import type { CheckInMessage, CheckInSession, CheckInState, MismatchResult } from "@/lib/types"
import { useCheckInAudio } from "./use-check-in-audio"
import {
  checkInReducer,
  initialState,
  type CheckInData,
  type CheckInMessagesCallbacks,
  useCheckInMessages,
} from "./use-check-in-messages"
import { type CheckInSessionCallbacks, useCheckInSession } from "./use-check-in-session"
import { useCheckInWidgets } from "./use-check-in-widgets"

export type { CheckInAction, CheckInData } from "./use-check-in-messages"
export { checkInReducer, initialState } from "./use-check-in-messages"

export interface CheckInControls {
  /** Start a new check-in session */
  startSession: (options?: { userGesture?: boolean }) => Promise<void>
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
  /** Interrupt the assistant while it's speaking (barge-in) */
  interruptAssistant: () => void
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

export function useCheckIn(options: UseCheckInOptions = {}): [CheckInData, CheckInControls] {
  const { onSessionStart, onSessionEnd, onMessage, onMismatch, onError } = options

  const [data, dispatch] = useReducer(checkInReducer, initialState)

  // Enforce "AI speaks first" at the start of a session.
  // We block user audio/text until the assistant produces *any* output (audio, transcript, or explicit silence).
  const assistantHasStartedRef = useRef(false)

  const sessionCallbacksRef = useRef<CheckInSessionCallbacks>({
    onSessionStart,
    onSessionEnd,
    onError,
  })

  const messageCallbacksRef = useRef<CheckInMessagesCallbacks>({
    onMessage,
    onMismatch,
  })

  useEffect(() => {
    sessionCallbacksRef.current = { onSessionStart, onSessionEnd, onError }
    messageCallbacksRef.current = { onMessage, onMismatch }
  }, [onMessage, onMismatch, onError, onSessionStart, onSessionEnd])

  // Track current state for use in callbacks (avoid stale closures)
  const stateRef = useRef<CheckInState>(data.state)
  useEffect(() => {
    stateRef.current = data.state
  }, [data.state])

  // If we restore a session (preserve/resume) that already contains assistant messages,
  // allow user input immediately.
  useEffect(() => {
    if (assistantHasStartedRef.current) return
    if (data.messages.some((m) => m.role === "assistant")) {
      assistantHasStartedRef.current = true
    }
  }, [data.messages])

  // Audio playback hook (assistant output)
  const [_playback, playbackControls] = useAudioPlayback({
    onPlaybackStart: () => {
      assistantHasStartedRef.current = true
      dispatch({ type: "SET_ASSISTANT_SPEAKING" })
    },
    onPlaybackEnd: () => {
      if (stateRef.current === "assistant_speaking") {
        dispatch({ type: "SET_LISTENING" })
      }
    },
    onAudioLevel: (level) => {
      dispatch({ type: "SET_OUTPUT_LEVEL", level })
    },
  })

  // When the user manually interrupts the assistant, we should:
  // - stop any currently buffered/playing output audio
  // - suppress any additional model audio chunks for the *current* turn
  //   (until onTurnComplete / onInterrupted fires)
  const suppressAssistantAudioRef = useRef(false)

  // Gemini Live hook wiring
  const geminiControlsRef = useRef<GeminiLiveControls | null>(null)

  const getGeminiControls = useCallback((): GeminiLiveControls => {
    const controls = geminiControlsRef.current
    if (!controls) {
      throw new Error("Gemini controls not ready")
    }
    return controls
  }, [])

  const sendAudio = useCallback((base64Audio: string) => {
    // Block user audio until the assistant starts the conversation.
    if (!assistantHasStartedRef.current) return
    getGeminiControls().sendAudio(base64Audio)
  }, [getGeminiControls])

  const sendText = useCallback((text: string) => {
    getGeminiControls().sendText(text)
  }, [getGeminiControls])

  const injectContext = useCallback((contextText: string) => {
    getGeminiControls().injectContext(contextText)
  }, [getGeminiControls])

  const connect = useCallback(
    (context?: SessionContext) => {
      return getGeminiControls().connect(context)
    },
    [getGeminiControls]
  )

  const disconnect = useCallback(() => {
    getGeminiControls().disconnect()
  }, [getGeminiControls])

  const getClient = useCallback((): GeminiLiveClient | null => {
    return getGeminiControls().getClient()
  }, [getGeminiControls])

  const reattachToClient = useCallback(
    (client: GeminiLiveClient) => {
      getGeminiControls().reattachToClient(client)
    },
    [getGeminiControls]
  )

  // Sub-hooks
  const audio = useCheckInAudio({ dispatch, sendAudio })

  const queueAssistantAudio = useCallback(
    (base64Audio: string) => {
      if (suppressAssistantAudioRef.current) return
      playbackControls.queueAudio(base64Audio)
    },
    [playbackControls.queueAudio]
  )

  const messages = useCheckInMessages({
    data,
    dispatch,
    callbacksRef: messageCallbacksRef,
    sendText,
    injectContext,
    queueAudio: queueAssistantAudio,
    clearQueuedAudio: playbackControls.clearQueue,
    resetAudioChunks: audio.resetAudioChunks,
    drainAudioChunks: audio.drainAudioChunks,
  })

  const widgets = useCheckInWidgets({
    data,
    dispatch,
    sendText,
    addUserTextMessage: messages.addUserTextMessage,
  })

  const session = useCheckInSession({
    data,
    dispatch,
    callbacksRef: sessionCallbacksRef,
    playbackControls,
    audio,
    gemini: {
      connect,
      disconnect,
      sendText,
      getClient,
      reattachToClient,
    },
    stateRef,
  })

  // Ensure manual interruption only suppresses audio for the current assistant turn.
  const messageHandlersWithAudioSuppression = {
    ...messages.handlers,
    onModelTranscript: (text: string, finished: boolean) => {
      assistantHasStartedRef.current = true
      messages.handlers.onModelTranscript(text, finished)
    },
    onAudioChunk: (base64Audio: string) => {
      assistantHasStartedRef.current = true
      messages.handlers.onAudioChunk(base64Audio)
    },
    onSilenceChosen: (reason: string) => {
      assistantHasStartedRef.current = true
      messages.handlers.onSilenceChosen(reason)
    },
    onTurnComplete: () => {
      suppressAssistantAudioRef.current = false
      messages.handlers.onTurnComplete()
    },
    onInterrupted: () => {
      suppressAssistantAudioRef.current = false
      messages.handlers.onInterrupted()
    },
  }

  const [gemini, geminiControls] = useGeminiLive({
    ...messageHandlersWithAudioSuppression,
    ...widgets.handlers,
    ...session.handlers,
  })

  // Keep controls in a ref for sub-hooks.
  geminiControlsRef.current = geminiControls

  // Sync connection state
  useEffect(() => {
    dispatch({ type: "SET_CONNECTION_STATE", state: gemini.state })
  }, [gemini.state])

  const controls: CheckInControls = {
    startSession: async (options) => {
      assistantHasStartedRef.current = false
      await session.startSession(options)
    },
    endSession: session.endSession,
    cancelSession: session.cancelSession,
    getSession: session.getSession,
    toggleMute: audio.toggleMute,
    dismissWidget: widgets.dismissWidget,
    undoScheduledActivity: widgets.undoScheduledActivity,
    runQuickAction: widgets.runQuickAction,
    saveJournalEntry: widgets.saveJournalEntry,
    triggerManualTool: widgets.triggerManualTool,
    sendTextMessage: (text) => {
      if (!assistantHasStartedRef.current) return
      messages.sendTextMessage(text)
    },
    preserveSession: session.preserveSession,
    hasPreservedSession: session.hasPreservedSession,
    resumePreservedSession: async () => {
      assistantHasStartedRef.current = false
      await session.resumePreservedSession()
    },
    getContextFingerprint: session.getContextFingerprint,
    interruptAssistant: () => {
      suppressAssistantAudioRef.current = true
      playbackControls.clearQueue()
      const state = stateRef.current
      if (state === "assistant_speaking" || state === "ai_greeting" || state === "processing") {
        dispatch({ type: "SET_LISTENING" })
      }
    },
  }

  return [data, controls]
}
