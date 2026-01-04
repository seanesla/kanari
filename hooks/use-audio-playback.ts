"use client"

/**
 * useAudioPlayback Hook
 *
 * Manages audio playback for Gemini Live API responses using an AudioWorklet.
 * Handles 24kHz PCM audio from Gemini, queues chunks, and plays through Web Audio API.
 *
 * Features:
 * - Buffered playback for smooth audio
 * - Barge-in support (clear queue when user interrupts)
 * - Audio level visualization
 * - Automatic sample rate conversion
 */

import { useReducer, useRef, useCallback, useEffect } from "react"
import { base64ToInt16 } from "@/lib/audio/pcm-converter"

// ============================================
// Types
// ============================================

export type PlaybackState = "idle" | "initializing" | "ready" | "playing" | "error"

export interface AudioPlaybackData {
  /** Current playback state */
  state: PlaybackState
  /** True when worklet is initialized and ready */
  isReady: boolean
  /** True when audio is currently playing */
  isPlaying: boolean
  /** Current audio level (0-1) for visualization */
  audioLevel: number
  /** Number of chunks queued for playback */
  queuedChunks: number
  /** Total buffered samples */
  bufferedSamples: number
  /** Error message if state is "error" */
  error: string | null
}

export interface AudioPlaybackControls {
  /** Initialize the audio context and worklet */
  initialize: () => Promise<void>
  /** Queue audio chunk for playback (base64 PCM from Gemini) */
  queueAudio: (base64Audio: string) => void
  /** Clear the playback queue (for barge-in) */
  clearQueue: () => void
  /** Pause playback */
  pause: () => void
  /** Resume playback */
  resume: () => void
  /** Clean up resources */
  cleanup: () => void
}

export interface UseAudioPlaybackOptions {
  /** Output sample rate (default: 24000 - Gemini output rate) */
  sampleRate?: number
  /** Callback when playback starts */
  onPlaybackStart?: () => void
  /** Callback when playback ends (buffer empty) */
  onPlaybackEnd?: () => void
  /** Callback for audio level updates */
  onAudioLevel?: (level: number) => void
}

// ============================================
// Reducer
// ============================================

type PlaybackAction =
  | { type: "START_INITIALIZING" }
  | { type: "INITIALIZED" }
  | { type: "PLAYING" }
  | { type: "STOPPED" }
  | { type: "QUEUE_STATUS"; queueLength: number; bufferedSamples: number }
  | { type: "AUDIO_LEVEL"; level: number }
  | { type: "BUFFER_EMPTY" }
  | { type: "CLEARED" }
  | { type: "ERROR"; error: string }
  | { type: "CLEANUP" }

const initialState: AudioPlaybackData = {
  state: "idle",
  isReady: false,
  isPlaying: false,
  audioLevel: 0,
  queuedChunks: 0,
  bufferedSamples: 0,
  error: null,
}

function playbackReducer(state: AudioPlaybackData, action: PlaybackAction): AudioPlaybackData {
  switch (action.type) {
    case "START_INITIALIZING":
      return {
        ...initialState,
        state: "initializing",
      }

    case "INITIALIZED":
      return {
        ...state,
        state: "ready",
        isReady: true,
      }

    case "PLAYING":
      return {
        ...state,
        state: "playing",
        isPlaying: true,
      }

    case "STOPPED":
      return {
        ...state,
        state: "ready",
        isPlaying: false,
      }

    case "QUEUE_STATUS":
      return {
        ...state,
        queuedChunks: action.queueLength,
        bufferedSamples: action.bufferedSamples,
        isPlaying: action.queueLength > 0 || action.bufferedSamples > 0,
      }

    case "AUDIO_LEVEL":
      return {
        ...state,
        audioLevel: action.level,
      }

    case "BUFFER_EMPTY":
      return {
        ...state,
        isPlaying: false,
        queuedChunks: 0,
        bufferedSamples: 0,
      }

    case "CLEARED":
      return {
        ...state,
        isPlaying: false,
        queuedChunks: 0,
        bufferedSamples: 0,
        audioLevel: 0,
      }

    case "ERROR":
      return {
        ...state,
        state: "error",
        isReady: false,
        error: action.error,
      }

    case "CLEANUP":
      return initialState

    default:
      return state
  }
}

// ============================================
// Hook
// ============================================

// Gemini outputs audio at 24kHz
const GEMINI_OUTPUT_SAMPLE_RATE = 24000

/**
 * Hook for managing audio playback from Gemini Live API
 *
 * @example
 * const [playback, controls] = useAudioPlayback({
 *   onPlaybackEnd: () => console.log('Gemini finished speaking'),
 * })
 *
 * // Initialize once
 * await controls.initialize()
 *
 * // Queue audio chunks from Gemini
 * controls.queueAudio(base64AudioFromGemini)
 *
 * // Clear on barge-in
 * controls.clearQueue()
 */
export function useAudioPlayback(
  options: UseAudioPlaybackOptions = {}
): [AudioPlaybackData, AudioPlaybackControls] {
  const {
    sampleRate = GEMINI_OUTPUT_SAMPLE_RATE,
    onPlaybackStart,
    onPlaybackEnd,
    onAudioLevel,
  } = options

  const [data, dispatch] = useReducer(playbackReducer, initialState)

  // Audio context and worklet refs
  const audioContextRef = useRef<AudioContext | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const isPlayingRef = useRef(false)

  // Initialization / teardown coordination (handles StrictMode + rapid open/close).
  // Pattern doc: docs/error-patterns/audioplayback-init-after-unmount.md
  const mountedRef = useRef(true)
  const cleanupRequestedRef = useRef(false)
  const initializationIdRef = useRef(0)

  // Track instance lifecycle to prevent stale callbacks from being executed
  // if another instance was created (e.g., rapid open/close of dialog)
  const instanceRef = useRef<object>({})

  // Store callbacks in refs
  const callbacksRef = useRef({ onPlaybackStart, onPlaybackEnd, onAudioLevel })
  useEffect(() => {
    callbacksRef.current = { onPlaybackStart, onPlaybackEnd, onAudioLevel }
  }, [onPlaybackStart, onPlaybackEnd, onAudioLevel])

  /**
   * Initialize audio context and worklet
   */
  const initialize = useCallback(async () => {
    // Idempotent: avoid creating multiple AudioContexts for the same hook instance.
    if (
      audioContextRef.current &&
      (audioContextRef.current.state as string) !== "closed" &&
      workletNodeRef.current
    ) {
      return
    }

    if (!mountedRef.current) {
      throw new Error("INITIALIZATION_ABORTED")
    }

    const currentInitId = ++initializationIdRef.current
    cleanupRequestedRef.current = false

    const assertNotAborted = () => {
      if (!mountedRef.current || cleanupRequestedRef.current) {
        throw new Error("INITIALIZATION_ABORTED")
      }
      if (initializationIdRef.current !== currentInitId) {
        throw new Error("INITIALIZATION_ABORTED")
      }
    }

    try {
      dispatch({ type: "START_INITIALIZING" })
      assertNotAborted()

      // Create AudioContext at 24kHz (Gemini output rate)
      const audioContext = new AudioContext({ sampleRate })
      audioContextRef.current = audioContext

      // Ensure context is running (may be suspended on page load)
      if (audioContext.state === "suspended") {
        await audioContext.resume()
      }
      assertNotAborted()

      // Abort if context was closed during resume (e.g., React StrictMode unmount)
      // Note: TypeScript's AudioContextState type is outdated and doesn't include "closed",
      // but the Web Audio API spec includes it: https://webaudio.github.io/web-audio-api/#dom-audiocontextstate
      if ((audioContext.state as string) === "closed") {
        console.log("[useAudioPlayback] AudioContext closed during initialization, aborting")
        throw new Error("INITIALIZATION_ABORTED")
      }

      // Load the playback worklet
      await audioContext.audioWorklet.addModule("/playback.worklet.js")
      assertNotAborted()

      // Abort if context was closed during module loading
      if ((audioContext.state as string) === "closed") {
        console.log("[useAudioPlayback] AudioContext closed during module loading, aborting")
        throw new Error("INITIALIZATION_ABORTED")
      }

      // Create worklet node
      const workletNode = new AudioWorkletNode(audioContext, "playback-processor", {
        outputChannelCount: [1], // Mono output
      })

      // Connect to destination (speakers)
      workletNode.connect(audioContext.destination)

      // Handle messages from worklet
      const currentInstance = instanceRef.current
      workletNode.port.onmessage = (event) => {
        const { type, queueLength, bufferedSamples } = event.data

        // Only process messages if this instance is still active
        // This prevents stale callbacks when multiple hook instances exist
        if (instanceRef.current !== currentInstance) {
          return
        }

        switch (type) {
          case "queueStatus":
            dispatch({ type: "QUEUE_STATUS", queueLength, bufferedSamples })

            // Calculate audio level from buffered samples for visualization
            if (bufferedSamples > 0) {
              const level = Math.min(bufferedSamples / 10000, 1)
              dispatch({ type: "AUDIO_LEVEL", level })
              callbacksRef.current.onAudioLevel?.(level)
            }

            // Detect playback start
            if (!isPlayingRef.current && (queueLength > 0 || bufferedSamples > 0)) {
              isPlayingRef.current = true
              dispatch({ type: "PLAYING" })
              callbacksRef.current.onPlaybackStart?.()
            }
            break

          case "bufferEmpty":
            if (isPlayingRef.current) {
              isPlayingRef.current = false
              dispatch({ type: "BUFFER_EMPTY" })
              callbacksRef.current.onPlaybackEnd?.()
            }
            break

          case "cleared":
            isPlayingRef.current = false
            dispatch({ type: "CLEARED" })
            break
        }
      }

      workletNodeRef.current = workletNode
      dispatch({ type: "INITIALIZED" })
    } catch (error) {
      cleanupRequestedRef.current = true
      const err = error instanceof Error ? error : new Error("Failed to initialize audio playback")
      dispatch({ type: "ERROR", error: err.message })
      throw err
    }
  }, [sampleRate])

  /**
   * Queue audio chunk for playback
   */
  const queueAudio = useCallback((base64Audio: string) => {
    const worklet = workletNodeRef.current
    const audioContext = audioContextRef.current

    // Check if worklet is initialized
    if (!worklet) {
      console.warn("[useAudioPlayback] Not initialized, cannot queue audio")
      return
    }

    // Check if AudioContext is still open
    // Web Audio API spec includes "closed" state: https://webaudio.github.io/web-audio-api/#dom-audiocontextstate
    if (!audioContext || (audioContext.state as string) === "closed") {
      console.warn("[useAudioPlayback] AudioContext closed, cannot queue audio")
      return
    }

    try {
      // Convert base64 to Int16 PCM
      const int16Data = base64ToInt16(base64Audio)

      // Send to worklet (transfer ownership for efficiency)
      worklet.port.postMessage(
        {
          type: "audio",
          pcm: int16Data.buffer,
        },
        [int16Data.buffer]
      )
    } catch (error) {
      console.error("[useAudioPlayback] Failed to queue audio:", error)
    }
  }, [])

  /**
   * Clear the playback queue (for barge-in)
   * Immediately stops any playing audio and clears the queue
   */
  const clearQueue = useCallback(() => {
    const worklet = workletNodeRef.current
    if (!worklet) return

    // Immediately set playing to false to prevent onPlaybackStart from being called
    // if buffered audio finishes before the worklet processes the clear message
    isPlayingRef.current = false

    // Send clear command to the worklet
    worklet.port.postMessage({ type: "clear" })
  }, [])

  /**
   * Pause playback
   */
  const pause = useCallback(() => {
    const worklet = workletNodeRef.current
    if (!worklet) return

    worklet.port.postMessage({ type: "stop" })
    dispatch({ type: "STOPPED" })
  }, [])

  /**
   * Resume playback
   */
  const resume = useCallback(() => {
    const worklet = workletNodeRef.current
    if (!worklet) return

    worklet.port.postMessage({ type: "start" })
    dispatch({ type: "PLAYING" })
  }, [])

  /**
   * Clean up resources
   */
  const cleanup = useCallback(() => {
    cleanupRequestedRef.current = true
    initializationIdRef.current += 1

    // Invalidate this instance so stale worklet messages are ignored
    const oldInstance = instanceRef.current
    instanceRef.current = {}

    // Clear message handler to prevent memory leaks
    if (workletNodeRef.current) {
      workletNodeRef.current.port.onmessage = null
      workletNodeRef.current.disconnect()
      workletNodeRef.current = null
    }

    // Close audio context if not already closed
    // See: docs/error-patterns/audiocontext-double-close.md
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close()
    }
    audioContextRef.current = null

    isPlayingRef.current = false
    dispatch({ type: "CLEANUP" })
  }, [])

  // Cleanup on unmount - use the cleanup function to avoid duplication
  useEffect(() => {
    return () => {
      mountedRef.current = false
      cleanup()
    }
  }, [cleanup])

  const controls: AudioPlaybackControls = {
    initialize,
    queueAudio,
    clearQueue,
    pause,
    resume,
    cleanup,
  }

  return [data, controls]
}
