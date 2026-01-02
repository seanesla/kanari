"use client"

import { useCallback, useEffect, useRef } from "react"
import type { Dispatch, MutableRefObject } from "react"
import {
  createFeatureAccumulator,
  getAverageFeatures,
  updateFeatureAccumulator,
  type FeatureAccumulator,
} from "@/lib/audio/feature-aggregator"
import { processAudio } from "@/lib/audio/processor"
import { logDebug } from "@/lib/logger"
import {
  detectMismatch,
  featuresToPatterns,
  shouldRunMismatchDetection,
} from "@/lib/gemini/mismatch-detector"
import { buildMismatchContext, buildVoicePatternContext } from "@/lib/gemini/context-builder"
import { mergeTranscriptUpdate } from "@/lib/gemini/transcript-merge"
import { analyzeVoiceMetrics } from "@/lib/ml/inference"
import type { CheckInMessage } from "@/lib/types"
import type { CheckInAction, CheckInData, CheckInMessagesCallbacks } from "../state"
import { generateId } from "../ids"

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
  generateAndSendFlashResponse?: (text: string) => Promise<void>
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
  const lastAssistantMessageIdRef = useRef<string | null>(null)

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

  // Accumulate session-level audio features across utterances
  const sessionFeatureAccumulatorRef = useRef<FeatureAccumulator | null>(null)
  const lastSessionIdRef = useRef<string | null>(null)

  // Dev-only: enable with localStorage.setItem("kanari.debugTranscriptMerge", "1")
  const debugTranscriptMergeRef = useRef(false)
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      debugTranscriptMergeRef.current = window.localStorage.getItem("kanari.debugTranscriptMerge") === "1"
    } catch {
      // ignore
    }
  }, [])

  // Sync userTranscriptRef with current user transcript (for use in callbacks)
  useEffect(() => {
    userTranscriptRef.current = data.currentUserTranscript
  }, [data.currentUserTranscript])

  // Reset session-level accumulation when session changes
  useEffect(() => {
    const sessionId = data.session?.id ?? null
    if (sessionId !== lastSessionIdRef.current) {
      sessionFeatureAccumulatorRef.current = null
      lastSessionIdRef.current = sessionId
    }
  }, [data.session?.id])

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

      // Update session-level metrics (weighted by audio length)
      const weight = audioData.length
      const accumulator = sessionFeatureAccumulatorRef.current
        ? updateFeatureAccumulator(sessionFeatureAccumulatorRef.current, result.features, weight)
        : createFeatureAccumulator(result.features, weight)
      sessionFeatureAccumulatorRef.current = accumulator

      const averagedFeatures = getAverageFeatures(accumulator)
      const sessionMetrics = analyzeVoiceMetrics(averagedFeatures)

      dispatch({
        type: "SET_SESSION_ACOUSTIC_METRICS",
        metrics: {
          stressScore: sessionMetrics.stressScore,
          fatigueScore: sessionMetrics.fatigueScore,
          stressLevel: sessionMetrics.stressLevel,
          fatigueLevel: sessionMetrics.fatigueLevel,
          confidence: sessionMetrics.confidence,
          analyzedAt: sessionMetrics.analyzedAt,
          features: averagedFeatures,
        },
      })

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
      const mergedUser = mergeTranscriptUpdate(userTranscriptRef.current, text)
      if (debugTranscriptMergeRef.current) {
        logDebug("TranscriptMerge", "user", {
          prevLength: userTranscriptRef.current.length,
          incomingLength: text.length,
          nextLength: mergedUser.next.length,
          kind: mergedUser.kind,
          deltaLength: mergedUser.delta.length,
        })
      }
      userTranscriptRef.current = mergedUser.next

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
        lastAssistantMessageIdRef.current = streamingMessage.id
      } else {
        // Simple append - Gemini Live sends truly out-of-order chunks from
        // multiple parallel transcript streams, which cannot be fixed client-side.
        // Using mergeTranscriptUpdate() makes it worse by falsely detecting "restarts".
        // Known limitation: docs/error-patterns/transcript-stream-duplication.md
        currentTranscriptRef.current = currentTranscriptRef.current + text

        if (lastAssistantMessageIdRef.current) {
          dispatch({
            type: "UPDATE_MESSAGE_CONTENT",
            messageId: lastAssistantMessageIdRef.current,
            content: currentTranscriptRef.current,
          })
        }
      }

      // NOTE: finished: true means this transcription CHUNK is finalized, NOT that the turn is done.
      // The Gemini Live API can send multiple transcription segments with finished: true before
      // the actual turnComplete event. Do NOT set isStreaming: false here - only onTurnComplete should.
      // Setting isStreaming: false prematurely removes the "Speaking..." placeholder and shows the
      // jumbled content when more transcript chunks arrive.
      // Pattern doc: docs/error-patterns/transcript-stream-duplication.md
      // REMOVED: if (finished && lastAssistantMessageIdRef.current) { ... }
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
      // NOTE: Don't dispatch SET_ASSISTANT_SPEAKING here!
      // The state transition happens in onPlaybackStart (use-check-in.ts)
      // when audio actually starts playing. This allows the "processing" state
      // to persist while audio is being queued/buffered, giving the UI time
      // to show thinking indicators.
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
    lastAssistantMessageIdRef.current = null
    // Transition to listening - this handles both AI greeting and regular responses
    dispatch({ type: "SET_LISTENING" })
    pendingUserUtteranceResetRef.current = true
  }, [dispatch])

  const onInterrupted = useCallback(() => {
    // User barged in - clear playback and reset for next response
    clearQueuedAudio()
    currentTranscriptRef.current = ""
    currentThinkingRef.current = ""
    lastAssistantMessageIdRef.current = null
    dispatch({ type: "CLEAR_CURRENT_TRANSCRIPTS" })
    dispatch({ type: "SET_USER_SPEAKING" })
  }, [clearQueuedAudio, dispatch])

  const onSilenceChosen = useCallback(
    (reason: string) => {
      // Model chose to stay silent - don't play audio, transition to listening
      console.log("[useCheckIn] AI chose silence:", reason)

      // Mark the last user message as having triggered silence
      // This provides visual feedback that AI intentionally chose not to respond
      const messageIdToMark = lastUserMessageIdRef.current
      if (messageIdToMark) {
        dispatch({ type: "SET_MESSAGE_SILENCE_TRIGGERED", messageId: messageIdToMark })
      }

      dispatch({ type: "SET_LISTENING" })
      pendingUserUtteranceResetRef.current = true
      lastAssistantMessageIdRef.current = null
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
