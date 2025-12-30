"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Pause, Play, TimerReset } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { BreathingExerciseType, BreathingExerciseWidgetState } from "@/lib/types"
import { WidgetContainer } from "./widget-container"

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
        { label: "Inhale", seconds: 4, fromScale: 0.9, toScale: 1.1 },
        { label: "Hold", seconds: 4, fromScale: 1.1, toScale: 1.1 },
        { label: "Exhale", seconds: 4, fromScale: 1.1, toScale: 0.9 },
        { label: "Hold", seconds: 4, fromScale: 0.9, toScale: 0.9 },
      ]
    case "478":
      return [
        { label: "Inhale", seconds: 4, fromScale: 0.9, toScale: 1.1 },
        { label: "Hold", seconds: 7, fromScale: 1.1, toScale: 1.1 },
        { label: "Exhale", seconds: 8, fromScale: 1.1, toScale: 0.85 },
      ]
    case "relaxing":
    default:
      return [
        { label: "Inhale", seconds: 4, fromScale: 0.9, toScale: 1.1 },
        { label: "Exhale", seconds: 6, fromScale: 1.1, toScale: 0.85 },
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
}

export function BreathingExercise({ widget, onDismiss }: BreathingExerciseProps) {
  const pattern = useMemo(() => getPattern(widget.args.type), [widget.args.type])

  const [isRunning, setIsRunning] = useState(true)
  const [remainingSeconds, setRemainingSeconds] = useState(widget.args.duration)
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [phaseRemaining, setPhaseRemaining] = useState(pattern[0]?.seconds ?? 0)
  const [phaseKey, setPhaseKey] = useState(0)

  // Reset internal state when widget changes (HMR / new tool call)
  useEffect(() => {
    setIsRunning(true)
    setRemainingSeconds(widget.args.duration)
    setPhaseIndex(0)
    setPhaseRemaining(pattern[0]?.seconds ?? 0)
    setPhaseKey((k) => k + 1)
  }, [widget.args.duration, pattern])

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

  return (
    <WidgetContainer
      title="Breathing exercise"
      description={widget.args.type === "478" ? "4-7-8 breathing" : widget.args.type}
      onDismiss={onDismiss}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {isComplete ? "Done" : phase?.label ?? "Breath"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {isComplete ? "Nice work." : `${phaseRemaining}s • ${formatTime(remainingSeconds)} left`}
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
              setRemainingSeconds(widget.args.duration)
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

      <div className="mt-5 flex items-center justify-center">
        <motion.div
          key={phaseKey}
          className="h-28 w-28 rounded-full border border-accent/30 bg-accent/10"
          initial={{ scale: phase?.fromScale ?? 1 }}
          animate={{ scale: phase?.toScale ?? 1 }}
          transition={{ duration: phase?.seconds ?? 1, ease: "easeInOut" }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2">
          <p className="font-medium text-foreground">Remaining</p>
          <p className="mt-0.5">{formatTime(remainingSeconds)}</p>
        </div>
        <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2">
          <p className="font-medium text-foreground">Mode</p>
          <p className="mt-0.5">{widget.args.type}</p>
        </div>
      </div>
    </WidgetContainer>
  )
}

