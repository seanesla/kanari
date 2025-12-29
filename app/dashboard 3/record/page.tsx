"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "next-view-transitions"
import { Mic, Square, CheckCircle, AlertCircle, Loader2, History, Lightbulb, RotateCcw } from "lucide-react"
import { useSceneMode } from "@/lib/scene-context"
import { cn } from "@/lib/utils"
import { DecorativeGrid } from "@/components/ui/decorative-grid"
import { Button } from "@/components/ui/button"
import { useRecording } from "@/hooks/use-recording"
import { useRecordingActions, useTrendDataActions } from "@/hooks/use-storage"
import { analyzeVoiceMetrics } from "@/lib/ml/inference"
import { RecordingWaveform, AudioLevelMeter } from "@/components/dashboard/recording-waveform"
import { AudioPlayer } from "@/components/dashboard/audio-player"
import type { Recording, AudioFeatures } from "@/lib/types"

export default function RecordPage() {
  const { setMode } = useSceneMode()
  const [visible, setVisible] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [playheadPosition, setPlayheadPosition] = useState(0)
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
      console.log("Recording saved successfully:", recording.id)
    } catch (err) {
      console.error("Failed to save recording:", err)
      setSaveError(err instanceof Error ? err.message : "Failed to save recording")
    } finally {
      setIsSaving(false)
    }
  }, [addRecording, addTrendData])

  // Use recording hook
  const [recordingData, recordingControls] = useRecording({
    enableVAD: true,
    autoProcess: true,
    onComplete: (result) => {
      console.log("Recording complete:", result)
    },
    onError: (error) => {
      console.error("Recording error:", error)
    },
  })

  const { state, duration, audioLevel, features, processingResult, error, audioData } = recordingData
  const { startRecording, stopRecording, cancelRecording, reset: resetRecording } = recordingControls

  const isRecording = state === "recording"
  const isProcessing = state === "processing"
  const isComplete = state === "complete"
  const hasError = state === "error"

  // Track if we've attempted to save this recording
  const saveAttemptedRef = useRef(false)

  // Auto-save when recording completes - using useEffect to avoid stale closure
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

  // Navigation guard for unsaved recordings
  useEffect(() => {
    // Browser close/refresh
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if ((isRecording || isProcessing || (isComplete && !isSaved)) && !isSaving) {
        e.preventDefault()
        e.returnValue = "You have an unsaved recording. Leave anyway?"
      }
    }

    // Back/forward button
    const handlePopState = () => {
      if ((isRecording || isProcessing || (isComplete && !isSaved)) && !isSaving) {
        const shouldLeave = window.confirm("You have an unsaved recording. Leave anyway?")
        if (!shouldLeave) {
          // Push state back to prevent navigation
          window.history.pushState(null, "", window.location.href)
        }
      }
    }

    // Push initial state for popstate to work
    if (isRecording || isProcessing || (isComplete && !isSaved)) {
      window.history.pushState(null, "", window.location.href)
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    window.addEventListener("popstate", handlePopState)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      window.removeEventListener("popstate", handlePopState)
    }
  }, [isRecording, isProcessing, isComplete, isSaved, isSaving])

  // Set scene to dashboard mode
  useEffect(() => {
    setMode("dashboard")
  }, [setMode])

  // Trigger entry animation
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

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
    savedRecordingRef.current = null
  }

  // Retry save if it failed
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

  return (
    <div className="min-h-screen bg-transparent relative overflow-hidden">
      <main className="px-8 md:px-16 lg:px-20 pt-28 pb-12 relative z-10">
        {/* HERO SECTION */}
        <div className="relative mb-16">
          {/* Grid background */}
          <DecorativeGrid />

          {/* Decorative blur accents */}
          <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />

          {/* Content */}
          <div
            className={cn(
              "relative transition-all duration-1000 delay-100",
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
            )}
          >
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-6">Record</p>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif leading-[0.95] mb-6">
              Voice <span className="text-accent">check-in</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl">
              Speak naturally for 30-60 seconds about your day. Your voice carries signals of stress and fatigue that
              we'll analyze locally in your browser.
            </p>
          </div>
        </div>

        {/* RECORDING INTERFACE */}
        <div
          className={cn(
            "relative max-w-2xl mx-auto transition-all duration-1000 delay-200",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
          )}
        >
          <div className="rounded-2xl border border-border/70 bg-card/30 backdrop-blur-xl p-8 md:p-12">
            {/* Recording indicator */}
            <div className="text-center mb-8">
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
            <div className="text-center mb-8">
              <p className="text-6xl md:text-8xl font-serif tabular-nums">{formatTime(duration)}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {isRecording
                  ? "Keep talking naturally"
                  : isProcessing
                    ? "Extracting voice features..."
                    : isComplete
                      ? `Processed ${processingResult?.metadata.speechDuration.toFixed(1)}s of speech`
                      : "Recommended: 30-60 seconds"}
              </p>
            </div>

            {/* Waveform visualization */}
            {(isRecording || isComplete) && (
              <div className="mb-8 space-y-4">
                <div className="flex justify-center">
                  {isRecording ? (
                    <AudioLevelMeter level={audioLevel} barCount={30} />
                  ) : isComplete && recordingData.audioData ? (
                    <RecordingWaveform
                      mode="static"
                      audioData={recordingData.audioData}
                      width={400}
                      height={80}
                      playheadPosition={playheadPosition}
                      onSeek={handleSeek}
                      className="border border-border/30 bg-background/50"
                    />
                  ) : null}
                </div>
                {/* Audio Player */}
                {isComplete && recordingData.audioData && (
                  <div className="max-w-md mx-auto">
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
              <div className="mb-8 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Features display (when complete) */}
            {isComplete && features && (
              <div className="mb-8 p-4 rounded-lg bg-accent/5 border border-accent/20">
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
                  Extracted Features
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
              <div className="mb-4 text-center">
                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving recording...
                </div>
              </div>
            )}

            {/* Saved confirmation */}
            {isSaved && !isSaving && (
              <div className="mb-4 text-center">
                <div className="inline-flex items-center gap-2 text-sm text-success">
                  <CheckCircle className="h-4 w-4" />
                  Recording saved successfully
                </div>
              </div>
            )}

            {/* Save error */}
            {saveError && !isSaving && (
              <div className="mb-4 text-center space-y-2">
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
                        asChild
                        variant="outline"
                        className="gap-2"
                      >
                        <Link href="/dashboard/history">
                          <History className="h-4 w-4" />
                          View History
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleReset}
                        className="gap-2"
                      >
                        <Mic className="h-4 w-4" />
                        Record Again
                      </Button>
                      <Button
                        asChild
                        className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2"
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

            {/* Instructions */}
            <div className="mt-12 space-y-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Tips for best results:</p>
              <ul className="space-y-2 list-disc list-inside">
                <li>Find a quiet space with minimal background noise</li>
                <li>Speak naturally about how your day is going</li>
                <li>Don't worry about what you say—only voice patterns are analyzed</li>
                <li>Audio is processed locally and never uploaded</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
