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
  type CheckInAction,
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
  startSession: () => Promise<void>
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

  // Audio playback hook (assistant output)
  const [_playback, playbackControls] = useAudioPlayback({
    onPlaybackStart: () => {
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

  const messages = useCheckInMessages({
    data,
    dispatch,
    callbacksRef: messageCallbacksRef,
    sendText,
    injectContext,
    queueAudio: playbackControls.queueAudio,
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

  const [gemini, geminiControls] = useGeminiLive({
    ...messages.handlers,
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
    startSession: session.startSession,
    endSession: session.endSession,
    cancelSession: session.cancelSession,
    getSession: session.getSession,
    toggleMute: audio.toggleMute,
    dismissWidget: widgets.dismissWidget,
    undoScheduledActivity: widgets.undoScheduledActivity,
    runQuickAction: widgets.runQuickAction,
    saveJournalEntry: widgets.saveJournalEntry,
    triggerManualTool: widgets.triggerManualTool,
    sendTextMessage: messages.sendTextMessage,
    preserveSession: session.preserveSession,
    hasPreservedSession: session.hasPreservedSession,
    resumePreservedSession: session.resumePreservedSession,
    getContextFingerprint: session.getContextFingerprint,
  }

  return [data, controls]
}
