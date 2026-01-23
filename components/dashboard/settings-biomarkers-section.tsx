"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Gauge, Mic, Sparkles, Trash2 } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { useRecording } from "@/hooks/use-recording"
import { db } from "@/lib/storage/db"
import { createDefaultSettingsRecord } from "@/lib/settings/default-settings"
import { VALIDATION } from "@/lib/ml/thresholds"
import type { VoiceBaseline, BiomarkerCalibration } from "@/lib/types"

const BASELINE_PROMPTS = [
  {
    id: "baseline-v1",
    title: "Neutral baseline",
    text:
      "Today I'm setting a quick voice baseline for Kanari. I'm going to speak in a normal, relaxed tone. I'm not trying to sound extra upbeat or extra tired. This is just how I usually sound when I'm doing okay.",
  },
] as const

const TARGET_SECONDS = 20
const MAX_SECONDS = 25

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function SettingsBiomarkersSection() {
  const [baseline, setBaseline] = useState<VoiceBaseline | null>(null)
  const [calibration, setCalibration] = useState<BiomarkerCalibration | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const settings = await db.settings.get("default")
        if (cancelled) return
        setBaseline(settings?.voiceBaseline ?? null)
        setCalibration(settings?.voiceBiomarkerCalibration ?? null)
      } catch {
        // ignore
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const baselineLabel = useMemo(() => {
    if (!baseline) return "Not calibrated"
    const seconds = baseline.speechSeconds ? Math.round(baseline.speechSeconds) : null
    return `Calibrated${seconds ? ` (${seconds}s speech)` : ""}`
  }, [baseline])

  const handleClear = useCallback(async () => {
    setStatus(null)
    try {
      const updated = await db.settings.update("default", {
        voiceBaseline: undefined,
        voiceBiomarkerCalibration: undefined,
      })
      if (updated === 0) {
        await db.settings.put(
          createDefaultSettingsRecord({
            voiceBaseline: undefined,
            voiceBiomarkerCalibration: undefined,
          })
        )
      }
      setBaseline(null)
      setCalibration(null)
      setStatus("Cleared baseline + tuning.")
    } catch {
      setStatus("Failed to clear. Try again.")
    }
  }, [])

  return (
    <div className="rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl p-6 transition-colors hover:bg-card/40 md:col-span-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold font-serif">Stress + Fatigue Accuracy</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-2 font-sans max-w-prose">
            Make your biomarkers personal and harder to game. Kanari can learn what “normal” sounds like for you,
            then score future check-ins relative to your baseline.
          </p>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-2">
          <div className="text-xs text-muted-foreground">Baseline</div>
          <div className="text-sm font-medium">{baselineLabel}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          {baseline ? (
            <>
              Last updated: <span className="text-foreground/80">{formatTimestamp(baseline.recordedAt)}</span>
              {calibration ? (
                <>
                  {" "}• Tuned with <span className="text-foreground/80">{calibration.sampleCount}</span> feedbacks
                </>
              ) : null}
            </>
          ) : (
            <>Takes about {TARGET_SECONDS}s. Audio stays on-device.</>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant={baseline ? "outline" : "default"} onClick={() => setIsDialogOpen(true)}>
            <Sparkles className="h-4 w-4 mr-2" />
            {baseline ? "Recalibrate" : "Calibrate"}
          </Button>

          {baseline || calibration ? (
            <Button variant="outline" onClick={handleClear}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      {status ? <p className="mt-3 text-xs text-muted-foreground">{status}</p> : null}

      <VoiceBaselineDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSaved={(next) => {
          setBaseline(next)
          setStatus("Saved baseline. Future scores will be personalized.")
        }}
      />
    </div>
  )
}

function VoiceBaselineDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (baseline: VoiceBaseline) => void
}) {
  const { open, onOpenChange, onSaved } = props

  const prompt = BASELINE_PROMPTS[0]

  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [recording, controls] = useRecording({
    sampleRate: 16000,
    enableVAD: true,
    autoProcess: true,
    maxDuration: MAX_SECONDS,
  })

  const isRecording = recording.state === "recording"
  const isProcessing = recording.state === "processing"
  const isComplete = recording.state === "complete"
  const speechSeconds = recording.processingResult?.metadata?.speechDuration ?? 0

  const progress = Math.min(100, Math.round((recording.duration / TARGET_SECONDS) * 100))

  useEffect(() => {
    if (!open) {
      setSaveError(null)
      setIsSaving(false)
      controls.reset()
    }
  }, [open, controls])

  const handleSave = useCallback(async () => {
    setSaveError(null)

    const features = recording.features
    const processing = recording.processingResult
    if (!features || !processing) {
      setSaveError("No audio features were captured. Try again.")
      return
    }

    // This is calibration (not a normal check-in), so we want more than the minimal check-in threshold.
    if (speechSeconds < Math.max(8, VALIDATION.MIN_SPEECH_SECONDS)) {
      setSaveError("Not enough clear speech captured. Try again in a quieter spot and speak a bit longer.")
      return
    }

    setIsSaving(true)
    try {
      const baseline: VoiceBaseline = {
        features,
        recordedAt: new Date().toISOString(),
        promptId: prompt.id,
        speechSeconds,
      }

      const updated = await db.settings.update("default", { voiceBaseline: baseline })
      if (updated === 0) {
        await db.settings.put(createDefaultSettingsRecord({ voiceBaseline: baseline }))
      }

      onSaved(baseline)
      onOpenChange(false)
    } catch {
      setSaveError("Failed to save baseline. Try again.")
    } finally {
      setIsSaving(false)
    }
  }, [onOpenChange, onSaved, prompt.id, recording.features, recording.processingResult, speechSeconds])

  const handlePrimary = useCallback(async () => {
    setSaveError(null)
    if (isRecording) {
      await controls.stopRecording()
      return
    }

    controls.reset()
    await controls.startRecording()
  }, [controls, isRecording])

  const primaryLabel = isRecording ? "Stop" : "Start recording"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/70 bg-card/95 backdrop-blur-xl max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-accent" />
            Voice baseline calibration
          </DialogTitle>
          <DialogDescription>
            Read the prompt below in a normal, relaxed voice. Aim for about {TARGET_SECONDS} seconds.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border/60 bg-background/40 p-4">
            <p className="text-sm leading-relaxed">{prompt.text}</p>
          </div>

          <div className="rounded-lg border border-border/60 bg-background/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Recording</p>
                <p className="text-xs text-muted-foreground">
                  {isProcessing
                    ? "Processing audio…"
                    : isComplete
                      ? `Captured ~${Math.round(speechSeconds)}s of speech`
                      : isRecording
                        ? "Speak naturally. You can stop anytime."
                        : "Press Start and begin reading."}
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm tabular-nums">{Math.round(recording.duration)}s</p>
                <p className="text-xs text-muted-foreground">target {TARGET_SECONDS}s</p>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <Progress value={progress} className="h-2" />
              <div
                className={cn(
                  "h-2 rounded-full bg-muted/40 overflow-hidden",
                  isRecording ? "opacity-100" : "opacity-60"
                )}
                aria-hidden
              >
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${Math.min(100, Math.round(recording.audioLevel * 100))}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">Mic level</p>
            </div>
          </div>

          {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRecording || isProcessing || isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void handlePrimary()}
            disabled={isProcessing || isSaving}
            variant={isRecording ? "destructive" : "default"}
          >
            {primaryLabel}
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={!isComplete || isRecording || isProcessing || isSaving}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            Save baseline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
