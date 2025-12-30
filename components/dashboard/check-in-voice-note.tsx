"use client"

/**
 * Voice Note Content Component
 *
 * This component handles the "Voice note" mode of the unified check-in feature.
 * It was extracted from recording-drawer-content.tsx to work inside the new
 * tabbed CheckInDrawer.
 *
 * What it does:
 * 1. Captures voice audio using the useRecording hook (Web Audio API)
 * 2. Processes audio through VAD (Voice Activity Detection) to extract speech
 * 3. Extracts acoustic features using Meyda (MFCC, pitch, energy, etc.)
 * 4. Computes stress/fatigue scores using ML inference
 * 5. Saves the recording to IndexedDB for offline-first storage
 * 6. Optionally prompts user to "Talk to AI" if stress is elevated
 *
 * Key differences from the original recording-drawer-content.tsx:
 * - Removed the header section (now in parent drawer)
 * - Changed instruction from "30-60 seconds" to "Stop when you're ready"
 * - Added onSessionChange callback to notify parent when recording is active
 *
 * Privacy: All audio processing happens client-side. Audio is never uploaded.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "next-view-transitions"
import { toast } from "sonner"
import { Mic, Square, CheckCircle, AlertCircle, Loader2, Lightbulb, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useRecording } from "@/hooks/use-recording"
import { useRecordingActions, useTrendDataActions } from "@/hooks/use-storage"
import { analyzeVoiceMetrics } from "@/lib/ml/inference"
import { RecordingWaveform, AudioLevelMeter } from "@/components/dashboard/recording-waveform"
import { AudioPlayer } from "@/components/dashboard/audio-player"
import { PostRecordingPrompt } from "@/components/check-in"
import { featuresToPatterns } from "@/lib/gemini/mismatch-detector"
import type { Recording, AudioFeatures } from "@/lib/types"

interface VoiceNoteContentProps {
  /** Called when a recording is successfully saved to IndexedDB */
  onRecordingComplete?: (recording: Recording) => void
  /** Called when user clicks "Done" - parent should close the drawer */
  onClose?: () => void
  /** Called when recording state changes - parent uses this to disable tab switching */
  onSessionChange?: (isActive: boolean) => void
}

export function VoiceNoteContent({
  onRecordingComplete,
  onClose,
  onSessionChange,
}: VoiceNoteContentProps) {
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [playheadPosition, setPlayheadPosition] = useState(0)
  const [showCheckInPrompt, setShowCheckInPrompt] = useState(false)
  const savedRecordingRef = useRef<Recording | null>(null)

  // Storage hooks
  const { addRecording } = useRecordingActions()
  const { addTrendData } = useTrendDataActions()

  // Save recording to IndexedDB
  const saveRecording = useCallback(async (
    audioData: Float32Array,
    processingDuration: number,
    extractedFeatures: AudioFeatures
  ) => {
    setIsSaving(true)
    setSaveError(null)
    try {
      // Compute metrics using ML inference
      const metrics = analyzeVoiceMetrics(extractedFeatures)

      // Create recording object
      const recording: Recording = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        duration: processingDuration,
        status: "complete",
        features: extractedFeatures,
        metrics,
        audioData: Array.from(audioData),
        sampleRate: 16000,
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save recording"
      setSaveError(errorMessage)
      toast.error("Save failed", {
        description: errorMessage,
      })
    } finally {
      setIsSaving(false)
    }
  }, [addRecording, addTrendData, onRecordingComplete])

  // Use recording hook
  const [recordingData, recordingControls] = useRecording({
    enableVAD: true,
    autoProcess: true,
    onError: (error) => {
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

  // Notify parent of session state changes
  useEffect(() => {
    onSessionChange?.(isRecording || isProcessing)
  }, [isRecording, isProcessing, onSessionChange])

  // Track if we've attempted to save this recording
  const saveAttemptedRef = useRef(false)

  // Auto-save when recording completes
  useEffect(() => {
    if (isComplete && audioData && features && !isSaved && !isSaving && !saveAttemptedRef.current) {
      saveAttemptedRef.current = true
      saveRecording(audioData, duration, features)
    }
  }, [isComplete, audioData, features, duration, isSaved, isSaving, saveRecording])

  // Reset save attempted flag when starting a new recording
  useEffect(() => {
    if (state === "idle" || state === "recording") {
      saveAttemptedRef.current = false
    }
  }, [state])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleStartRecording = async () => {
    await startRecording()
  }

  const handleStopRecording = async () => {
    await stopRecording()
  }

  const handleReset = () => {
    resetRecording()
    setIsSaved(false)
    setIsSaving(false)
    setSaveError(null)
    setPlayheadPosition(0)
    setShowCheckInPrompt(false)
    savedRecordingRef.current = null
  }

  const handleRetrySave = useCallback(() => {
    if (audioData && features) {
      saveAttemptedRef.current = false
      setSaveError(null)
      saveRecording(audioData, duration, features)
    }
  }, [audioData, features, duration, saveRecording])

  const handleTimeUpdate = useCallback((currentTime: number) => {
    if (duration > 0) {
      setPlayheadPosition(currentTime / duration)
    }
  }, [duration])

  const handleSeek = useCallback((position: number) => {
    setPlayheadPosition(position)
  }, [])

  const handleClose = () => {
    onClose?.()
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-6 space-y-6">
      {/* Recording indicator */}
      <div className="text-center">
        <div
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm",
            isRecording
              ? "bg-destructive/20 text-destructive"
              : isProcessing
                ? "bg-accent/20 text-accent"
                : isComplete
                  ? "bg-success/20 text-success"
                  : hasError
                    ? "bg-destructive/20 text-destructive"
                    : "bg-muted/50 text-muted-foreground"
          )}
        >
          {isRecording && <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />}
          {isProcessing && <Loader2 className="h-3 w-3 animate-spin" />}
          {isComplete && <CheckCircle className="h-3 w-3" />}
          {hasError && <AlertCircle className="h-3 w-3" />}
          {!isRecording && !isProcessing && !isComplete && !hasError && (
            <span className="h-2 w-2 rounded-full bg-muted" />
          )}
          {isRecording && "Recording..."}
          {isProcessing && "Processing audio..."}
          {isComplete && "Complete!"}
          {hasError && "Error"}
          {!isRecording && !isProcessing && !isComplete && !hasError && "Ready to record"}
        </div>
      </div>

      {/* Timer */}
      <div className="text-center">
        <p className="text-5xl md:text-6xl font-serif tabular-nums">{formatTime(duration)}</p>
        <p className="text-sm text-muted-foreground mt-2">
          {isRecording
            ? "Keep talking naturally"
            : isProcessing
              ? "Extracting voice features..."
              : isComplete
                ? `Processed ${processingResult?.metadata.speechDuration.toFixed(1)}s of speech`
                : "Stop when you're ready"}
        </p>
      </div>

      {/* Waveform visualization */}
      {(isRecording || isComplete) && (
        <div className="space-y-4">
          <div className="flex justify-center">
            {isRecording ? (
              <AudioLevelMeter level={audioLevel} barCount={30} />
            ) : isComplete && recordingData.audioData ? (
              <RecordingWaveform
                mode="static"
                audioData={recordingData.audioData}
                width={320}
                height={60}
                playheadPosition={playheadPosition}
                onSeek={handleSeek}
                className="border border-border/30 bg-background/50"
              />
            ) : null}
          </div>
          {/* Audio Player */}
          {isComplete && recordingData.audioData && (
            <div className="max-w-sm mx-auto">
              <AudioPlayer
                audioData={recordingData.audioData}
                sampleRate={16000}
                duration={duration}
                onTimeUpdate={handleTimeUpdate}
              />
            </div>
          )}
        </div>
      )}

      {/* Error display */}
      {hasError && error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Features display (when complete) */}
      {isComplete && features && (
        <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
            Extracted Features
          </p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Speech Rate</p>
              <p className="font-medium">{features.speechRate.toFixed(1)} syl/s</p>
            </div>
            <div>
              <p className="text-muted-foreground">RMS Energy</p>
              <p className="font-medium">{features.rms.toFixed(3)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Pause Ratio</p>
              <p className="font-medium">{(features.pauseRatio * 100).toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Pause Count</p>
              <p className="font-medium">{features.pauseCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Saving indicator */}
      {isSaving && (
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving recording...
          </div>
        </div>
      )}

      {/* Saved confirmation */}
      {isSaved && !isSaving && (
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-sm text-success">
            <CheckCircle className="h-4 w-4" />
            Recording saved successfully
          </div>
        </div>
      )}

      {/* Save error */}
      {saveError && !isSaving && (
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {saveError}
          </div>
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetrySave}
              className="gap-2"
            >
              <RotateCcw className="h-3 w-3" />
              Retry Save
            </Button>
          </div>
        </div>
      )}

      {/* Post-recording check-in prompt */}
      {showCheckInPrompt &&
        savedRecordingRef.current?.id &&
        savedRecordingRef.current?.metrics &&
        savedRecordingRef.current?.features && (
        <PostRecordingPrompt
          recordingId={savedRecordingRef.current.id}
          stressScore={savedRecordingRef.current.metrics.stressScore}
          fatigueScore={savedRecordingRef.current.metrics.fatigueScore}
          patterns={featuresToPatterns(savedRecordingRef.current.features)}
          onDismiss={() => setShowCheckInPrompt(false)}
          onSessionComplete={() => {
            setShowCheckInPrompt(false)
            toast.success("Check-in complete", {
              description: "Your conversation has been saved.",
            })
          }}
        />
      )}

      {/* Contextual guidance after recording is saved (when check-in not shown) */}
      {isSaved && savedRecordingRef.current?.metrics && !showCheckInPrompt && (
        <div className="p-4 rounded-lg bg-card border">
          {savedRecordingRef.current.metrics.stressLevel === 'high' || savedRecordingRef.current.metrics.stressLevel === 'elevated' ? (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Your stress levels appear elevated
              </p>
              <Button asChild onClick={handleClose}>
                <Link href="/dashboard/suggestions">
                  View Recovery Suggestions
                </Link>
              </Button>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Looking good! Your levels are within normal range
              </p>
            </div>
          )}
        </div>
      )}

      {/* Recording button */}
      <div className="flex flex-wrap justify-center gap-4">
        {!isRecording && !isProcessing ? (
          <>
            {!isComplete && (
              <Button
                size="lg"
                className="bg-accent text-accent-foreground hover:bg-accent/90 h-16 w-16 rounded-full p-0"
                onClick={handleStartRecording}
              >
                <Mic className="h-8 w-8" />
              </Button>
            )}
            {isComplete && isSaved && (
              <>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="gap-2"
                >
                  <Mic className="h-4 w-4" />
                  Record Again
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="gap-2"
                >
                  Done
                </Button>
                <Button
                  asChild
                  className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2"
                  onClick={handleClose}
                >
                  <Link href="/dashboard/suggestions">
                    <Lightbulb className="h-4 w-4" />
                    Get Suggestions
                  </Link>
                </Button>
              </>
            )}
          </>
        ) : isRecording ? (
          <Button
            size="lg"
            variant="destructive"
            className="h-16 w-16 rounded-full p-0"
            onClick={handleStopRecording}
          >
            <Square className="h-6 w-6" />
          </Button>
        ) : null}
      </div>

      {/* Tips */}
      {isIdle && !isComplete && (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Tips for best results:</p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>Find a quiet space with minimal background noise</li>
            <li>Speak naturally about how your day is going</li>
            <li>Audio is processed locally and never uploaded</li>
          </ul>
        </div>
      )}
    </div>
  )
}
