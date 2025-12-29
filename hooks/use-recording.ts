"use client"

import { useReducer, useRef, useCallback, useEffect } from "react"
import { AudioRecorder } from "@/lib/audio/recorder"
import { processAudio, validateAudioData, type ProcessingResult } from "@/lib/audio/processor"
import type { AudioFeatures } from "@/lib/types"

export type RecordingState =
  | "idle"
  | "requesting"
  | "recording"
  | "processing"
  | "complete"
  | "error"

export interface RecordingData {
  /**
   * Current state of the recording
   */
  state: RecordingState

  /**
   * Recording duration in seconds
   */
  duration: number

  /**
   * Raw audio data (available after stop)
   */
  audioData: Float32Array | null

  /**
   * Extracted audio features (available after processing)
   */
  features: AudioFeatures | null

  /**
   * Processing result with metadata (available after processing)
   */
  processingResult: ProcessingResult | null

  /**
   * Error message if state is "error"
   */
  error: string | null

  /**
   * Real-time audio level (0-1) for visualization
   */
  audioLevel: number
}

// Reducer action types
type RecordingAction =
  | { type: "START_REQUESTING" }
  | { type: "START_RECORDING" }
  | { type: "SET_DURATION"; duration: number }
  | { type: "SET_AUDIO_LEVEL"; level: number }
  | { type: "STOP_RECORDING"; audioData: Float32Array }
  | { type: "START_PROCESSING" }
  | { type: "COMPLETE"; features: AudioFeatures; processingResult: ProcessingResult }
  | { type: "COMPLETE_NO_PROCESS" }
  | { type: "ERROR"; error: string }
  | { type: "RESET" }

const initialState: RecordingData = {
  state: "idle",
  duration: 0,
  audioData: null,
  features: null,
  processingResult: null,
  error: null,
  audioLevel: 0,
}

function recordingReducer(state: RecordingData, action: RecordingAction): RecordingData {
  switch (action.type) {
    case "START_REQUESTING":
      return {
        ...initialState,
        state: "requesting",
      }
    case "START_RECORDING":
      return {
        ...state,
        state: "recording",
      }
    case "SET_DURATION":
      return {
        ...state,
        duration: action.duration,
      }
    case "SET_AUDIO_LEVEL":
      return {
        ...state,
        audioLevel: action.level,
      }
    case "STOP_RECORDING":
      return {
        ...state,
        audioData: action.audioData,
        audioLevel: 0,
      }
    case "START_PROCESSING":
      return {
        ...state,
        state: "processing",
      }
    case "COMPLETE":
      return {
        ...state,
        state: "complete",
        features: action.features,
        processingResult: action.processingResult,
      }
    case "COMPLETE_NO_PROCESS":
      return {
        ...state,
        state: "complete",
      }
    case "ERROR":
      return {
        ...state,
        state: "error",
        error: action.error,
      }
    case "RESET":
      return initialState
    default:
      return state
  }
}

export interface RecordingControls {
  /**
   * Start recording
   */
  startRecording: () => Promise<void>

  /**
   * Stop recording and process audio
   */
  stopRecording: () => Promise<void>

  /**
   * Cancel recording without processing
   */
  cancelRecording: () => void

  /**
   * Reset to idle state
   */
  reset: () => void
}

export interface UseRecordingOptions {
  /**
   * Sample rate for recording (default: 16000)
   */
  sampleRate?: number

  /**
   * Enable Voice Activity Detection (default: true)
   */
  enableVAD?: boolean

  /**
   * Auto-process after recording stops (default: true)
   */
  autoProcess?: boolean

  /**
   * Maximum recording duration in seconds (default: 600 = 10 minutes)
   */
  maxDuration?: number

  /**
   * Callback when recording starts
   */
  onStart?: () => void

  /**
   * Callback when recording stops
   */
  onStop?: () => void

  /**
   * Callback when processing completes
   */
  onComplete?: (result: ProcessingResult) => void

  /**
   * Callback when error occurs
   */
  onError?: (error: Error) => void
}

const DEFAULT_SAMPLE_RATE = 16000
const DEFAULT_MAX_DURATION = 600 // 10 minutes

/**
 * React hook for managing audio recording workflow
 *
 * Workflow:
 * 1. idle -> requesting (permission request)
 * 2. requesting -> recording (recording started)
 * 3. recording -> processing (stopped, processing audio)
 * 4. processing -> complete (features extracted)
 * 5. complete -> idle (reset)
 * 6. Any state -> error (on failure)
 */
export function useRecording(options: UseRecordingOptions = {}): [RecordingData, RecordingControls] {
  const {
    sampleRate = DEFAULT_SAMPLE_RATE,
    enableVAD = true,
    autoProcess = true,
    maxDuration = DEFAULT_MAX_DURATION,
    onStart,
    onStop,
    onComplete,
    onError,
  } = options

  // Consolidated state with useReducer for better performance
  const [data, dispatch] = useReducer(recordingReducer, initialState)

  // Refs
  const recorderRef = useRef<AudioRecorder | null>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)

  // Refs for auto-stop
  const maxDurationRef = useRef(maxDuration)
  maxDurationRef.current = maxDuration

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.cancel()
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
      }
    }
  }, [])

  /**
   * Calculate audio level for visualization
   */
  const calculateAudioLevel = useCallback((audioChunk: Float32Array): number => {
    // Calculate RMS
    let sum = 0
    for (let i = 0; i < audioChunk.length; i++) {
      sum += audioChunk[i] * audioChunk[i]
    }
    const rms = Math.sqrt(sum / audioChunk.length)

    // Convert to 0-1 range with some scaling
    return Math.min(rms * 5, 1)
  }, [])

  /**
   * Start recording
   */
  const startRecording = useCallback(async () => {
    try {
      dispatch({ type: "START_REQUESTING" })

      // Create recorder
      recorderRef.current = new AudioRecorder({
        sampleRate,
        channelCount: 1,
        onDataAvailable: (chunk) => {
          // Update audio level for visualization
          const level = calculateAudioLevel(chunk)
          dispatch({ type: "SET_AUDIO_LEVEL", level })
        },
        onError: (err) => {
          dispatch({ type: "ERROR", error: err.message })
          onError?.(err)
        },
      })

      // Start recording
      await recorderRef.current.start()

      dispatch({ type: "START_RECORDING" })
      startTimeRef.current = Date.now()

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        dispatch({ type: "SET_DURATION", duration: (Date.now() - startTimeRef.current) / 1000 })
      }, 100) // Update every 100ms for smooth UI

      onStart?.()
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to start recording")
      dispatch({ type: "ERROR", error: error.message })
      onError?.(error)
    }
  }, [sampleRate, calculateAudioLevel, onStart, onError])

  /**
   * Stop recording and optionally process audio
   */
  const stopRecording = useCallback(async () => {
    try {
      if (!recorderRef.current) {
        throw new Error("No active recording")
      }

      // Stop duration timer
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
        durationIntervalRef.current = null
      }

      // Stop recording
      const rawAudio = await recorderRef.current.stop()
      dispatch({ type: "STOP_RECORDING", audioData: rawAudio })

      onStop?.()

      // Validate audio
      if (!validateAudioData(rawAudio)) {
        throw new Error("Invalid audio data: no signal detected")
      }

      // Process if auto-process is enabled
      if (autoProcess) {
        dispatch({ type: "START_PROCESSING" })

        const result = await processAudio(rawAudio, {
          sampleRate,
          enableVAD,
        })

        dispatch({ type: "COMPLETE", features: result.features, processingResult: result })
        onComplete?.(result)
      } else {
        dispatch({ type: "COMPLETE_NO_PROCESS" })
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to stop recording")
      dispatch({ type: "ERROR", error: error.message })
      onError?.(error)
    }
  }, [sampleRate, enableVAD, autoProcess, onStop, onComplete, onError])

  /**
   * Cancel recording without processing
   */
  const cancelRecording = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.cancel()
      recorderRef.current = null
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }

    dispatch({ type: "RESET" })
  }, [])

  /**
   * Reset to idle state
   */
  const reset = useCallback(() => {
    dispatch({ type: "RESET" })
  }, [])

  // Auto-stop when max duration is reached
  useEffect(() => {
    if (data.state === "recording" && data.duration >= maxDurationRef.current) {
      stopRecording()
    }
  }, [data.state, data.duration, stopRecording])

  const controls: RecordingControls = {
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
  }

  return [data, controls]
}
