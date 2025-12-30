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
import { cn, getGeminiApiKey } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useRecording } from "@/hooks/use-recording"
import { useRecordingActions, useTrendDataActions } from "@/hooks/use-storage"
import { analyzeVoiceMetrics } from "@/lib/ml/inference"
import { RecordingWaveform, AudioLevelMeter } from "@/components/dashboard/recording-waveform"
import { AudioPlayer } from "@/components/dashboard/audio-player"
import { PostRecordingPrompt } from "@/components/check-in"
import { featuresToPatterns } from "@/lib/gemini/mismatch-detector"
import { float32ToWavBase64 } from "@/lib/audio"
import type { Recording, AudioFeatures, GeminiSemanticAnalysis } from "@/lib/types"

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
  // ============================================
  // Component State
  // ============================================
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [playheadPosition, setPlayheadPosition] = useState(0)
  const [showCheckInPrompt, setShowCheckInPrompt] = useState(false)
  const savedRecordingRef = useRef<Recording | null>(null)

  // Emotion detection state - tracks background Gemini API call
  // The emotion analysis runs asynchronously after the recording is saved
  const [isAnalyzingEmotion, setIsAnalyzingEmotion] = useState(false)
  const [emotionAnalysis, setEmotionAnalysis] = useState<GeminiSemanticAnalysis | null>(null)

  // Storage hooks for IndexedDB operations
  const { addRecording, updateRecording } = useRecordingActions()
  const { addTrendData } = useTrendDataActions()

  /**
   * Analyze audio for emotion detection using Gemini API
   *
   * This function runs in the background after a recording is saved.
   * It converts the audio to WAV format, sends it to the Gemini semantic
   * analysis API, and updates the recording with the emotion results.
   *
   * The analysis is non-blocking - the recording is saved immediately,
   * and emotion detection results are added when available.
   *
   * @param recordingId - The ID of the saved recording to update
   * @param audioData - Raw audio samples as Float32Array
   * @param sampleRate - Sample rate of the audio (typically 16000 Hz)
   */
  const analyzeEmotionInBackground = useCallback(async (
    recordingId: string,
    audioData: Float32Array,
    sampleRate: number = 16000
  ) => {
    setIsAnalyzingEmotion(true)

    try {
      // Step 1: Get user's Gemini API key from IndexedDB settings
      // The key is stored locally and never sent to our servers
      const apiKey = await getGeminiApiKey()
      if (!apiKey) {
        // No API key configured - skip emotion analysis silently
        // User can add their key in Settings to enable this feature
        console.log("[Emotion] No API key configured, skipping emotion analysis")
        return
      }

      // Step 2: Convert Float32Array audio to WAV base64 format
      // Gemini expects audio in standard formats (WAV, MP3, etc.)
      // WAV is lossless and preserves audio quality for accurate analysis
      const wavBase64 = float32ToWavBase64(audioData, sampleRate)

      // Step 3: Call the emotion detection API endpoint
      // The API sends the audio to Gemini for semantic analysis
      const response = await fetch("/api/gemini/semantic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Pass API key in header - used by server to authenticate with Gemini
          "X-Gemini-Api-Key": apiKey,
        },
        body: JSON.stringify({
          audio: wavBase64,
          mimeType: "audio/wav",
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `API error: ${response.status}`)
      }

      // Step 4: Parse the emotion analysis results
      // Response includes per-segment emotions, overall emotion, and observations
      const analysis: GeminiSemanticAnalysis = await response.json()
      setEmotionAnalysis(analysis)

      // Step 5: Update the recording in IndexedDB with emotion data
      // This links the semantic analysis to the acoustic features
      await updateRecording(recordingId, {
        semanticAnalysis: analysis,
      })

      // Update the ref so UI components can access the analysis
      if (savedRecordingRef.current?.id === recordingId) {
        savedRecordingRef.current = {
          ...savedRecordingRef.current,
          semanticAnalysis: analysis,
        }
      }

      console.log("[Emotion] Analysis complete:", {
        overallEmotion: analysis.overallEmotion,
        confidence: analysis.emotionConfidence,
        segments: analysis.segments.length,
      })
    } catch (err) {
      // Log error but don't show toast - emotion analysis is optional
      // The core recording functionality works without it
      console.error("[Emotion] Analysis failed:", err)
    } finally {
      setIsAnalyzingEmotion(false)
    }
  }, [updateRecording])

  /**
   * Save recording to IndexedDB and trigger emotion analysis
   *
   * This is the main save function called when recording completes.
   * It performs the following steps:
   * 1. Compute stress/fatigue metrics from acoustic features (client-side ML)
   * 2. Save the recording to IndexedDB immediately
   * 3. Update trend data for the dashboard charts
   * 4. Trigger background emotion analysis via Gemini API
   * 5. Show check-in prompt if stress/fatigue is elevated
   *
   * @param audioData - Raw audio samples as Float32Array
   * @param processingDuration - Duration of the processed audio in seconds
   * @param extractedFeatures - Acoustic features extracted by Meyda
   */
  const saveRecording = useCallback(async (
    audioData: Float32Array,
    processingDuration: number,
    extractedFeatures: AudioFeatures
  ) => {
    setIsSaving(true)
    setSaveError(null)
    try {
      // Compute stress/fatigue metrics using client-side ML inference
      // This uses threshold-based analysis of acoustic features
      const metrics = analyzeVoiceMetrics(extractedFeatures)

      // Create recording object with all metadata
      const recording: Recording = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        duration: processingDuration,
        status: "complete",
        features: extractedFeatures,
        metrics,
        // Store raw audio for playback and potential re-analysis
        audioData: Array.from(audioData),
        sampleRate: 16000,
        // semanticAnalysis will be added by background emotion detection
      }

      // Save to IndexedDB immediately - don't wait for emotion analysis
      await addRecording(recording)

      // Update trend data for dashboard stress/fatigue charts
      await addTrendData({
        date: new Date().toISOString().split("T")[0],
        stressScore: metrics.stressScore,
        fatigueScore: metrics.fatigueScore,
      })

      savedRecordingRef.current = recording
      setIsSaved(true)

      // Show check-in prompt for elevated stress or fatigue
      // Threshold of 50 indicates moderate to high levels
      if (metrics.stressScore > 50 || metrics.fatigueScore > 50) {
        setShowCheckInPrompt(true)
      }

      // Notify parent component that recording is complete
      onRecordingComplete?.(recording)

      // Trigger emotion analysis in background (non-blocking)
      // This calls Gemini API to detect emotions from speech content
      analyzeEmotionInBackground(recording.id, audioData, 16000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save recording"
      setSaveError(errorMessage)
      toast.error("Save failed", {
        description: errorMessage,
      })
    } finally {
      setIsSaving(false)
    }
  }, [addRecording, addTrendData, onRecordingComplete, analyzeEmotionInBackground])

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

      {/* Emotion Analysis Section - Shows Gemini semantic analysis results */}
      {isComplete && isSaved && (isAnalyzingEmotion || emotionAnalysis) && (
        <div className="p-4 rounded-lg bg-purple-500/5 border border-purple-500/20">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
            Emotion Analysis
          </p>
          {isAnalyzingEmotion ? (
            // Loading state while Gemini analyzes the audio
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Analyzing emotions with Gemini...</span>
            </div>
          ) : emotionAnalysis ? (
            // Display emotion analysis results
            <div className="space-y-3">
              {/* Overall emotion with confidence */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Overall Emotion</p>
                  <p className="font-medium text-lg capitalize">
                    {emotionAnalysis.overallEmotion === "happy" && "😊 "}
                    {emotionAnalysis.overallEmotion === "sad" && "😢 "}
                    {emotionAnalysis.overallEmotion === "angry" && "😤 "}
                    {emotionAnalysis.overallEmotion === "neutral" && "😐 "}
                    {emotionAnalysis.overallEmotion}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-sm">Confidence</p>
                  <p className="font-medium">
                    {(emotionAnalysis.emotionConfidence * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
              {/* Summary from Gemini */}
              {emotionAnalysis.summary && (
                <div className="pt-2 border-t border-purple-500/10">
                  <p className="text-sm text-muted-foreground italic">
                    "{emotionAnalysis.summary}"
                  </p>
                </div>
              )}
              {/* Segment count indicator */}
              {emotionAnalysis.segments.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Analyzed {emotionAnalysis.segments.length} speech segment
                  {emotionAnalysis.segments.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          ) : null}
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
