"use client"

import { useState, useRef, useCallback, useEffect } from "react"
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
    onStart,
    onStop,
    onComplete,
    onError,
  } = options

  // State
  const [state, setState] = useState<RecordingState>("idle")
  const [duration, setDuration] = useState(0)
  const [audioData, setAudioData] = useState<Float32Array | null>(null)
  const [features, setFeatures] = useState<AudioFeatures | null>(null)
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)

  // Refs
  const recorderRef = useRef<AudioRecorder | null>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)

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
      setState("requesting")
      setError(null)
      setDuration(0)
      setAudioData(null)
      setFeatures(null)
      setProcessingResult(null)
      setAudioLevel(0)

      // Create recorder
      recorderRef.current = new AudioRecorder({
        sampleRate,
        channelCount: 1,
        onDataAvailable: (chunk) => {
          // Update audio level for visualization
          const level = calculateAudioLevel(chunk)
          setAudioLevel(level)
        },
        onError: (err) => {
          setState("error")
          setError(err.message)
          onError?.(err)
        },
      })

      // Start recording
      await recorderRef.current.start()

      setState("recording")
      startTimeRef.current = Date.now()

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        setDuration((Date.now() - startTimeRef.current) / 1000)
      }, 100) // Update every 100ms for smooth UI

      onStart?.()
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to start recording")
      setState("error")
      setError(error.message)
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
      setAudioData(rawAudio)
      setAudioLevel(0)

      onStop?.()

      // Validate audio
      if (!validateAudioData(rawAudio)) {
        throw new Error("Invalid audio data: no signal detected")
      }

      // Process if auto-process is enabled
      if (autoProcess) {
        setState("processing")

        const result = await processAudio(rawAudio, {
          sampleRate,
          enableVAD,
        })

        setFeatures(result.features)
        setProcessingResult(result)
        setState("complete")

        onComplete?.(result)
      } else {
        setState("complete")
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to stop recording")
      setState("error")
      setError(error.message)
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

    setState("idle")
    setDuration(0)
    setAudioData(null)
    setFeatures(null)
    setProcessingResult(null)
    setError(null)
    setAudioLevel(0)
  }, [])

  /**
   * Reset to idle state
   */
  const reset = useCallback(() => {
    setState("idle")
    setDuration(0)
    setAudioData(null)
    setFeatures(null)
    setProcessingResult(null)
    setError(null)
    setAudioLevel(0)
  }, [])

  const data: RecordingData = {
    state,
    duration,
    audioData,
    features,
    processingResult,
    error,
    audioLevel,
  }

  const controls: RecordingControls = {
    startRecording,
    stopRecording,
    cancelRecording,
    reset,
  }

  return [data, controls]
}
