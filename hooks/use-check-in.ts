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
import { useGeminiLive, type GeminiLiveData } from "./use-gemini-live"
import { useAudioPlayback } from "./use-audio-playback"
import { processAudio } from "@/lib/audio/processor"
import { analyzeVoiceMetrics } from "@/lib/ml/inference"
import { int16ToBase64 } from "@/lib/audio/pcm-converter"
import {
  detectMismatch,
  shouldRunMismatchDetection,
  featuresToPatterns,
} from "@/lib/gemini/mismatch-detector"
import {
  generateMismatchContext,
  generateVoicePatternContext,
  generatePostRecordingContext,
} from "@/lib/gemini/live-prompts"
import type {
  CheckInState,
  CheckInMessage,
  CheckInSession,
  AudioFeatures,
  VoiceMetrics,
  MismatchResult,
  VoicePatterns,
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
  | { type: "SET_LISTENING" }
  | { type: "SET_USER_SPEAKING" }
  | { type: "SET_PROCESSING" }
  | { type: "SET_ASSISTANT_SPEAKING" }
  | { type: "SET_ENDING" }
  | { type: "SET_COMPLETE" }
  | { type: "SET_SESSION"; session: CheckInSession }
  | { type: "ADD_MESSAGE"; message: CheckInMessage }
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
      const newStreamingId = action.message.isStreaming
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

  // Track the last user message ID for updating with features
  const lastUserMessageIdRef = useRef<string | null>(null)

  // Post-recording context ref
  const postRecordingContextRef = useRef<string | null>(null)

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
  // Gemini Live Hook
  // ========================================

  const [gemini, geminiControls] = useGeminiLive({
    onConnected: () => {
      dispatch({ type: "SET_READY" })
      dispatch({ type: "SET_LISTENING" })

      // If post-recording context was provided, inject it
      if (postRecordingContextRef.current) {
        geminiControls.sendText(postRecordingContextRef.current)
        postRecordingContextRef.current = null
      }
    },
    onDisconnected: (reason) => {
      console.log("[useCheckIn] Disconnected:", reason)
      const currentState = stateRef.current

      // Only auto-complete if we were in an active state (user had chance to speak)
      const activeStates: CheckInState[] = [
        "ready",
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
      userSpeechStartRef.current = new Date().toISOString() // Capture timestamp when user STARTS speaking
    },
    onUserSpeechEnd: () => {
      dispatch({ type: "SET_PROCESSING" })
      // Add user message when speech ends (before processing)
      const transcript = userTranscriptRef.current
      if (transcript.trim()) {
        addUserMessage(transcript)
      }
      // Process collected audio for mismatch detection
      processUserUtterance()
    },
    onUserTranscript: (text, finished) => {
      // Capture timestamp on FIRST chunk of user speech
      // (VAD signals may not fire, so capture here as fallback)
      if (userTranscriptRef.current === "" && text.trim() && !userSpeechStartRef.current) {
        userSpeechStartRef.current = new Date().toISOString()
      }

      // Accumulate transcript chunks (Gemini sends word-by-word without finished flag)
      userTranscriptRef.current = userTranscriptRef.current + text

      // finished flag is rarely sent by Gemini, but handle it if it comes
      if (finished && userTranscriptRef.current.trim()) {
        addUserMessage(userTranscriptRef.current)
        userTranscriptRef.current = ""
        dispatch({ type: "SET_USER_TRANSCRIPT", text: "" })
        dispatch({ type: "SET_PROCESSING" })
        processUserUtterance()
      } else {
        // Still speaking - update transcript preview with accumulated text
        dispatch({ type: "SET_USER_TRANSCRIPT", text: userTranscriptRef.current })
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
        // Subsequent chunks: update the existing message in place
        currentTranscriptRef.current += text
        dispatch({ type: "UPDATE_STREAMING_MESSAGE", text })
      }
    },
    onModelThinking: (text) => {
      // Simple: just accumulate thinking text
      currentThinkingRef.current += text
      dispatch({ type: "APPEND_ASSISTANT_THINKING", text })
    },
    onAudioChunk: (base64Audio) => {
      // Save any pending user message on first audio chunk
      if (stateRef.current !== "assistant_speaking" && userTranscriptRef.current.trim()) {
        addUserMessage(userTranscriptRef.current)
        userTranscriptRef.current = ""
        dispatch({ type: "SET_USER_TRANSCRIPT", text: "" })
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
      dispatch({ type: "SET_LISTENING" })
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

  const addUserMessage = useCallback(
    (content: string) => {
      const messageId = generateId()
      // Use timestamp from when user STARTED speaking (not when message is added)
      // This ensures correct chronological ordering when AI starts responding before user finishes
      const message: CheckInMessage = {
        id: messageId,
        role: "user",
        content,
        timestamp: userSpeechStartRef.current || new Date().toISOString(),
      }

      // Reset the captured timestamp for the next utterance
      userSpeechStartRef.current = null

      // Save the message ID for later update with features
      lastUserMessageIdRef.current = messageId

      dispatch({ type: "ADD_MESSAGE", message })
      callbacksRef.current.onMessage?.(message)
    },
    []
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
      mediaStreamRef.current = stream

      // Create audio context at 16kHz
      const audioContext = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioContext

      // Resume if suspended
      if (audioContext.state === "suspended") {
        await audioContext.resume()
      }

      // Abort if context was closed during resume (e.g., React StrictMode unmount)
      // Note: TypeScript's AudioContextState type is outdated and doesn't include "closed",
      // but the Web Audio API spec includes it: https://webaudio.github.io/web-audio-api/#dom-audiocontextstate
      if ((audioContext.state as string) === "closed") {
        console.log("[useCheckIn] AudioContext closed during initialization, aborting")
        // Clean up the stream we just created
        stream.getTracks().forEach((track) => track.stop())
        mediaStreamRef.current = null
        throw new Error("INITIALIZATION_ABORTED")
      }

      // Load capture worklet
      await audioContext.audioWorklet.addModule("/capture.worklet.js")

      // Abort if context was closed during module loading
      if ((audioContext.state as string) === "closed") {
        console.log("[useCheckIn] AudioContext closed during module loading, aborting")
        // Clean up the stream we just created
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
      throw new Error(
        `Failed to initialize audio capture: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    }
  }, [geminiControls])

  const cleanupAudioCapture = useCallback(() => {
    // Stop microphone
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    // Disconnect worklet
    if (captureWorkletRef.current) {
      captureWorkletRef.current.disconnect()
      captureWorkletRef.current = null
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

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

        // Create new session
        const session: CheckInSession = {
          id: generateId(),
          startedAt: new Date().toISOString(),
          messages: [],
          recordingId: startOptions?.recordingContext?.recordingId,
        }
        dispatch({ type: "SET_SESSION", session })
        sessionStartRef.current = session.startedAt

        // Generate post-recording context if applicable
        if (startOptions?.recordingContext) {
          const { stressScore, fatigueScore, patterns } = startOptions.recordingContext
          postRecordingContextRef.current = generatePostRecordingContext(
            stressScore,
            fatigueScore,
            patterns
          )
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

        // Connect to Gemini
        await geminiControls.connect()

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
  }

  return [data, controls]
}
