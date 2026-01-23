"use client"

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react"
import { toast } from "sonner"
import { useRecording } from "@/hooks/use-recording"
import { useRecordingActions, useTrendDataActions } from "@/hooks/use-storage"
import { analyzeVoiceMetrics } from "@/lib/ml/inference"
import {
  applyBiomarkerCalibration,
  computeCombinedConfidence,
  computePersonalizedAcousticScores,
  computeVoiceDataQuality,
  scoreToFatigueLevel,
  scoreToStressLevel,
} from "@/lib/ml/personalized-biomarkers"
import { db } from "@/lib/storage/db"
import type { AudioFeatures, BiomarkerCalibration, Recording } from "@/lib/types"

export interface VoiceRecordingSavedEvent {
  recording: Recording
  audioData: Float32Array
  sampleRate: number
}

export interface UseVoiceRecordingOptions {
  onRecordingComplete?: (recording: Recording) => void
  /**
   * Invoked after the recording has been successfully saved (non-blocking).
   * Useful for optional background work (e.g. semantic analysis).
   */
  onRecordingSaved?: (event: VoiceRecordingSavedEvent) => void | Promise<void>
  /**
   * Audio sample rate stored on the recording object (defaults to 16000).
   */
  sampleRate?: number
  /**
   * Optional override for recorder errors. If not provided, a default toast is shown.
   */
  onRecordingError?: (error: Error) => void
  /**
   * Optional ref for accessing the saved recording outside the hook.
   * If omitted, the hook uses its own internal ref.
   */
  savedRecordingRef?: MutableRefObject<Recording | null>
}

export function useVoiceRecording(options: UseVoiceRecordingOptions = {}) {
  const {
    onRecordingComplete,
    onRecordingSaved,
    sampleRate = 16000,
    onRecordingError,
  } = options

  const internalSavedRecordingRef = useRef<Recording | null>(null)
  const savedRecordingRef = options.savedRecordingRef ?? internalSavedRecordingRef

  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [playheadPosition, setPlayheadPosition] = useState(0)
  const [showCheckInPrompt, setShowCheckInPrompt] = useState(false)

  // Storage hooks
  const { addRecording } = useRecordingActions()
  const { addTrendData } = useTrendDataActions()

  // Save recording to IndexedDB
  const saveRecording = useCallback(async (
    audioData: Float32Array,
    processingDuration: number,
    extractedFeatures: AudioFeatures,
    speechSeconds: number
  ) => {
    setIsSaving(true)
    setSaveError(null)
    try {
      const baseMetrics = analyzeVoiceMetrics(extractedFeatures)

      let baselineFeatures: AudioFeatures | null = null
      let calibration: BiomarkerCalibration | null = null
      try {
        const settings = await db.settings.get("default")
        baselineFeatures = settings?.voiceBaseline?.features ?? null
        calibration = settings?.voiceBiomarkerCalibration ?? null
      } catch {
        // ignore
      }

      let maxAbs = 0
      for (let i = 0; i < audioData.length; i++) {
        const abs = Math.abs(audioData[i] ?? 0)
        if (abs > maxAbs) maxAbs = abs
      }

      const quality = computeVoiceDataQuality({
        speechSeconds,
        totalSeconds: processingDuration,
        rms: extractedFeatures.rms,
        maxAbs,
      })

      const personalized = computePersonalizedAcousticScores({
        features: extractedFeatures,
        baseline: baselineFeatures,
        fallbackScores: {
          stressScore: baseMetrics.stressScore,
          fatigueScore: baseMetrics.fatigueScore,
        },
      })

      const stressScore = applyBiomarkerCalibration({
        rawScore: personalized.stressScore,
        dimension: "stress",
        calibration,
      })
      const fatigueScore = applyBiomarkerCalibration({
        rawScore: personalized.fatigueScore,
        dimension: "fatigue",
        calibration,
      })

      const confidence = computeCombinedConfidence({
        baseConfidence: baseMetrics.confidence,
        quality,
      })

      const metrics = {
        stressScore,
        fatigueScore,
        stressLevel: scoreToStressLevel(stressScore),
        fatigueLevel: scoreToFatigueLevel(fatigueScore),
        confidence,
        analyzedAt: baseMetrics.analyzedAt,
        explanations: personalized.explanations,
        quality,
      }

      // Create recording object
      const recording: Recording = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        duration: processingDuration,
        status: "complete",
        features: extractedFeatures,
        metrics,
        audioData: Array.from(audioData),
        sampleRate,
      }

      // Save to IndexedDB
      await addRecording(recording)

      // Update trend data for dashboard
      await addTrendData({
        date: new Date().toISOString().split("T")[0],
        stressScore: metrics.stressScore,
        fatigueScore: metrics.fatigueScore,
      })

      savedRecordingRef.current = recording
      setIsSaved(true)

      // Show check-in prompt for elevated stress or fatigue
      if (metrics.stressScore > 50 || metrics.fatigueScore > 50) {
        setShowCheckInPrompt(true)
      }

      onRecordingComplete?.(recording)

      if (onRecordingSaved) {
        void Promise.resolve(onRecordingSaved({ recording, audioData, sampleRate }))
          .catch(() => {
            // Intentional no-op: post-save work should never block or fail the core save flow.
          })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save recording"
      setSaveError(errorMessage)
      toast.error("Save failed", {
        description: errorMessage,
      })
    } finally {
      setIsSaving(false)
    }
  }, [addRecording, addTrendData, onRecordingComplete, onRecordingSaved, sampleRate])

  // Use recording hook
  const [recordingData, recordingControls] = useRecording({
    enableVAD: true,
    autoProcess: true,
    onError: (error) => {
      if (onRecordingError) {
        onRecordingError(error)
        return
      }

      toast.error("Recording failed", {
        description: error.message || "An error occurred during recording",
      })
    },
  })

  const { state, duration, audioLevel, features, processingResult, error, audioData } = recordingData
  const { startRecording, stopRecording, reset: resetRecording } = recordingControls

  const isRecording = state === "recording"
  const isProcessing = state === "processing"
  const isComplete = state === "complete"
  const hasError = state === "error"
  const isIdle = state === "idle"

  // Track if we've attempted to save this recording
  const saveAttemptedRef = useRef(false)

  // Auto-save when recording completes
  useEffect(() => {
    if (isComplete && audioData && features && !isSaved && !isSaving && !saveAttemptedRef.current) {
      saveAttemptedRef.current = true
      const speechSeconds = recordingData.processingResult?.metadata?.speechDuration ?? duration
      saveRecording(audioData, duration, features, speechSeconds)
    }
  }, [isComplete, audioData, features, duration, isSaved, isSaving, saveRecording, recordingData.processingResult])

  // Reset save attempted flag when starting a new recording
  useEffect(() => {
    if (state === "idle" || state === "recording") {
      saveAttemptedRef.current = false
    }
  }, [state])

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }, [])

  const handleStartRecording = useCallback(async () => {
    await startRecording()
  }, [startRecording])

  const handleStopRecording = useCallback(async () => {
    await stopRecording()
  }, [stopRecording])

  const handleReset = useCallback(() => {
    resetRecording()
    setIsSaved(false)
    setIsSaving(false)
    setSaveError(null)
    setPlayheadPosition(0)
    setShowCheckInPrompt(false)
    savedRecordingRef.current = null
  }, [resetRecording])

  const handleRetrySave = useCallback(() => {
    if (audioData && features) {
      saveAttemptedRef.current = false
      setSaveError(null)
      const speechSeconds = processingResult?.metadata?.speechDuration ?? duration
      saveRecording(audioData, duration, features, speechSeconds)
    }
  }, [audioData, features, duration, processingResult, saveRecording])

  const handleTimeUpdate = useCallback((currentTime: number) => {
    if (duration > 0) {
      setPlayheadPosition(currentTime / duration)
    }
  }, [duration])

  const handleSeek = useCallback((position: number) => {
    setPlayheadPosition(position)
  }, [])

  return {
    // Raw recorder state
    state,
    duration,
    audioLevel,
    features,
    processingResult,
    error,
    audioData,
    recordingData,
    recordingControls,

    // Derived recorder flags
    isRecording,
    isProcessing,
    isComplete,
    hasError,
    isIdle,

    // Save state
    isSaved,
    isSaving,
    saveError,
    savedRecordingRef,
    showCheckInPrompt,
    setShowCheckInPrompt,
    playheadPosition,

    // UI helpers
    formatTime,
    handleStartRecording,
    handleStopRecording,
    handleReset,
    handleRetrySave,
    handleTimeUpdate,
    handleSeek,
  }
}
