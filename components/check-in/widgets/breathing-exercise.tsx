"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Pause, Play, TimerReset } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import type { BreathingExerciseType, BreathingExerciseWidgetState } from "@/lib/types"
import { WidgetContainer } from "./widget-container"
import { cn } from "@/lib/utils"

const MIN_DURATION_SECONDS = 30
const MAX_DURATION_SECONDS = 10 * 60
const DURATION_STEP_SECONDS = 5

function clampAndSnapDuration(seconds: number): number {
  const fallback = 120
  const safe = Number.isFinite(seconds) ? seconds : fallback
  const clamped = Math.min(MAX_DURATION_SECONDS, Math.max(MIN_DURATION_SECONDS, safe))
  const snapped = Math.round(clamped / DURATION_STEP_SECONDS) * DURATION_STEP_SECONDS
  return Math.min(MAX_DURATION_SECONDS, Math.max(MIN_DURATION_SECONDS, snapped))
}

type BreathPhase = {
  label: string
  seconds: number
  fromScale: number
  toScale: number
}

function getPattern(type: BreathingExerciseType): BreathPhase[] {
  switch (type) {
    case "box":
      return [
        { label: "Breathe in", seconds: 4, fromScale: 0.9, toScale: 1.1 },
        { label: "Hold", seconds: 4, fromScale: 1.1, toScale: 1.1 },
        { label: "Breathe out", seconds: 4, fromScale: 1.1, toScale: 0.9 },
        { label: "Hold", seconds: 4, fromScale: 0.9, toScale: 0.9 },
      ]
    case "478":
      return [
        { label: "Breathe in", seconds: 4, fromScale: 0.9, toScale: 1.1 },
        { label: "Hold", seconds: 7, fromScale: 1.1, toScale: 1.1 },
        { label: "Breathe out", seconds: 8, fromScale: 1.1, toScale: 0.85 },
      ]
    case "relaxing":
    default:
      return [
        { label: "Breathe in", seconds: 4, fromScale: 0.9, toScale: 1.1 },
        { label: "Breathe out", seconds: 6, fromScale: 1.1, toScale: 0.85 },
      ]
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

interface BreathingExerciseProps {
  widget: BreathingExerciseWidgetState
  onDismiss?: () => void
  onBack?: () => void
  onOpenFocus?: (durationSeconds: number) => void
  initialDurationSeconds?: number
  autoStart?: boolean
  variant?: "inline" | "focus"
  className?: string
}

export function BreathingExercise({
  widget,
  onDismiss,
  onBack,
  onOpenFocus,
  initialDurationSeconds,
  autoStart = false,
  variant = "inline",
  className,
}: BreathingExerciseProps) {
  const pattern = useMemo(() => getPattern(widget.args.type), [widget.args.type])
  const suggestedDurationSeconds = widget.args.duration
  const initialDuration = clampAndSnapDuration(initialDurationSeconds ?? widget.args.duration)

  const [hasStarted, setHasStarted] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [durationSeconds, setDurationSeconds] = useState(initialDuration)
  const [remainingSeconds, setRemainingSeconds] = useState(initialDuration)
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [phaseRemaining, setPhaseRemaining] = useState(pattern[0]?.seconds ?? 0)
  const [phaseKey, setPhaseKey] = useState(0)

  const isFocus = variant === "focus"

  // Reset internal state when widget changes (HMR / new tool call)
  useEffect(() => {
    setHasStarted(false)
    setIsRunning(false)
    setDurationSeconds(initialDuration)
    setRemainingSeconds(initialDuration)
    setPhaseIndex(0)
    setPhaseRemaining(pattern[0]?.seconds ?? 0)
    setPhaseKey((k) => k + 1)
  }, [initialDuration, pattern])

  useEffect(() => {
    if (!autoStart) return
    if (hasStarted) return

    setHasStarted(true)
    setIsRunning(true)
    setRemainingSeconds(durationSeconds)
    setPhaseIndex(0)
    setPhaseRemaining(pattern[0]?.seconds ?? 0)
    setPhaseKey((k) => k + 1)
  }, [autoStart, durationSeconds, hasStarted, pattern])

  useEffect(() => {
    if (!isRunning) return
    if (remainingSeconds <= 0) return

    const tick = window.setInterval(() => {
      setRemainingSeconds((s) => Math.max(0, s - 1))
      setPhaseRemaining((s) => Math.max(0, s - 1))
    }, 1000)

    return () => {
      window.clearInterval(tick)
    }
  }, [isRunning, remainingSeconds])

  useEffect(() => {
    if (!isRunning) return
    if (remainingSeconds <= 0) return
    if (phaseRemaining > 0) return

    const next = (phaseIndex + 1) % pattern.length
    setPhaseIndex(next)
    setPhaseRemaining(pattern[next]?.seconds ?? 0)
    setPhaseKey((k) => k + 1)
  }, [isRunning, phaseRemaining, phaseIndex, pattern, remainingSeconds])

  const phase = pattern[phaseIndex]
  const isComplete = remainingSeconds <= 0
  const phaseText = isComplete ? "Done" : phase?.label ?? "Breathe"
  const displayedPhaseRemaining = isComplete ? 0 : Math.max(1, phaseRemaining)

  const phaseTotalSeconds = phase?.seconds ?? 1
  const phaseLevel = isComplete
    ? 0
    : Math.min(1, Math.max(0, phaseRemaining / Math.max(1, phaseTotalSeconds)))
  const ringRadius = 48
  const ringCircumference = ringRadius * 2 * Math.PI
  const ringDashOffset = ringCircumference - phaseLevel * ringCircumference

  return (
    <WidgetContainer
      title="Breathing exercise"
      description={widget.args.type === "478" ? "4-7-8 breathing" : widget.args.type}
      onBack={isFocus ? onBack : undefined}
      onDismiss={onDismiss}
      variant={isFocus ? "focus" : "inline"}
      className={className}
    >
      {!hasStarted ? (
        <>
          <p className="text-sm text-muted-foreground">
            Kanari suggested a short breathing exercise. Want to start it now?
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2">
              <p className="font-medium text-foreground">Duration</p>
              <p className="mt-0.5">{formatTime(durationSeconds)}</p>
              {suggestedDurationSeconds !== durationSeconds ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Suggested: {formatTime(suggestedDurationSeconds)}
                </p>
              ) : null}
            </div>
            <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2">
              <p className="font-medium text-foreground">Pattern</p>
              <p className="mt-0.5">
                {widget.args.type === "box"
                  ? "4-4-4-4"
                  : widget.args.type === "478"
                    ? "4-7-8"
                    : "4-6"}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Choose duration</span>
              <span className="tabular-nums">{formatTime(durationSeconds)}</span>
            </div>
            <Slider
              value={[durationSeconds]}
              min={MIN_DURATION_SECONDS}
              max={MAX_DURATION_SECONDS}
              step={DURATION_STEP_SECONDS}
              onValueChange={(value) => {
                const next = value[0] ?? initialDurationSeconds
                setDurationSeconds(clampAndSnapDuration(next))
              }}
            />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{formatTime(MIN_DURATION_SECONDS)}</span>
              <span>{formatTime(MAX_DURATION_SECONDS)}</span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onDismiss}>
              Not now
            </Button>
            <Button
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={() => {
                if (onOpenFocus) {
                  onOpenFocus(durationSeconds)
                  return
                }
                setHasStarted(true)
                setIsRunning(true)
                setRemainingSeconds(durationSeconds)
                setPhaseIndex(0)
                setPhaseRemaining(pattern[0]?.seconds ?? 0)
                setPhaseKey((k) => k + 1)
              }}
            >
              Start
            </Button>
          </div>
        </>
      ) : (
        <div className={cn("space-y-5", isFocus && "h-full min-h-0 flex flex-col")}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{phaseText}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isComplete
                  ? "Nice work."
                  : `${displayedPhaseRemaining}s • ${formatTime(remainingSeconds)} left`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => setIsRunning((r) => !r)}
                disabled={isComplete}
              >
                {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                <span className="sr-only">{isRunning ? "Pause" : "Resume"}</span>
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => {
                  setIsRunning(true)
                  setRemainingSeconds(durationSeconds)
                  setPhaseIndex(0)
                  setPhaseRemaining(pattern[0]?.seconds ?? 0)
                  setPhaseKey((k) => k + 1)
                }}
              >
                <TimerReset className="h-4 w-4" />
                <span className="sr-only">Restart</span>
              </Button>
            </div>
          </div>

          <div className={cn("flex items-center justify-center", isFocus && "flex-1 min-h-0")}>
            <motion.div
              key={phaseKey}
              className={cn(
                "relative",
                isFocus ? "h-56 w-56 md:h-64 md:w-64" : "h-40 w-40"
              )}
              initial={{ scale: phase?.fromScale ?? 1 }}
              animate={{ scale: phase?.toScale ?? 1 }}
              transition={{ duration: phase?.seconds ?? 1, ease: "easeInOut" }}
            >
              <svg
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none -rotate-90"
                viewBox="0 0 100 100"
              >
                <circle
                  cx="50"
                  cy="50"
                  r={ringRadius}
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth={3}
                  className="text-accent/15"
                />
                <motion.circle
                  cx="50"
                  cy="50"
                  r={ringRadius}
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeDasharray={`${ringCircumference} ${ringCircumference}`}
                  strokeDashoffset={ringDashOffset}
                  strokeLinecap="round"
                  className={isRunning ? "text-accent/70" : "text-accent/40"}
                  animate={{ strokeDashoffset: ringDashOffset }}
                  transition={{ duration: isRunning ? 0.65 : 0, ease: "easeOut" }}
                />
              </svg>

              <div className="absolute inset-0 rounded-full bg-accent/20 blur-2xl" />

              <div
                className={
                  "absolute inset-3 rounded-full border border-accent/25 bg-gradient-to-br from-accent/25 via-background/10 to-accent/5 backdrop-blur-xl " +
                  "shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_18px_45px_rgba(0,0,0,0.25)]"
                }
              />

              <motion.div
                aria-hidden="true"
                className="absolute inset-3 rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 36, repeat: Infinity, ease: "linear" }}
              >
                <div className="absolute -inset-10 rounded-full bg-gradient-to-r from-transparent via-accent/12 to-transparent blur-2xl" />
              </motion.div>

              <div className="absolute inset-6 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.16),transparent_60%)]" />

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <motion.p
                  key={phaseKey}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    isFocus ? "text-lg" : "text-base",
                    "font-semibold tracking-wide"
                  )}
                >
                  {phaseText}
                </motion.p>
                {!isComplete ? (
                  <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                    {displayedPhaseRemaining}s
                  </p>
                ) : null}
              </div>
            </motion.div>
          </div>

          <div className={cn("grid grid-cols-2 gap-2 text-xs text-muted-foreground", isFocus && "mt-auto")}>
            <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2">
              <p className="font-medium text-foreground">Remaining</p>
              <p className="mt-0.5">{formatTime(remainingSeconds)}</p>
            </div>
            <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2">
              <p className="font-medium text-foreground">Mode</p>
              <p className="mt-0.5">{widget.args.type}</p>
            </div>
          </div>
        </div>
      )}
    </WidgetContainer>
  )
}
