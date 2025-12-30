'use client'

import { useMemo } from 'react'
import { Mic } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Recording } from '@/lib/types'

interface RecordingMarkerProps {
  recording: Recording
  className?: string
}

// Get color based on stress score (0-100)
// Low stress (0-30) = green, moderate (30-60) = yellow, high (60+) = red
function getStressColor(score: number | undefined): string {
  if (score === undefined) return 'bg-muted-foreground'
  if (score < 30) return 'bg-green-500'
  if (score < 60) return 'bg-yellow-500'
  return 'bg-red-500'
}

// Get color based on fatigue score
function getFatigueColor(score: number | undefined): string {
  if (score === undefined) return 'bg-muted-foreground'
  if (score < 30) return 'bg-green-500'
  if (score < 60) return 'bg-yellow-500'
  return 'bg-red-500'
}

export function RecordingMarker({ recording, className }: RecordingMarkerProps) {
  const stressScore = recording.metrics?.stressScore
  const fatigueScore = recording.metrics?.fatigueScore

  const stressColor = useMemo(() => getStressColor(stressScore), [stressScore])
  const fatigueColor = useMemo(() => getFatigueColor(fatigueScore), [fatigueScore])

  return (
    <div
      className={cn(
        'h-full w-full flex items-center gap-1.5 px-2 py-1',
        'rounded bg-amber-500/20 border border-amber-500/40',
        'cursor-pointer hover:bg-amber-500/30 transition-colors',
        className
      )}
      title={`Recording | Stress: ${stressScore ?? '?'} | Fatigue: ${fatigueScore ?? '?'}`}
    >
      {/* Mic icon */}
      <Mic className="h-3 w-3 text-amber-500 flex-shrink-0" />

      {/* Stress/fatigue indicator dots */}
      <div className="flex gap-1">
        <div
          className={cn('w-2 h-2 rounded-full', stressColor)}
          title={`Stress: ${stressScore ?? '?'}`}
        />
        <div
          className={cn('w-2 h-2 rounded-full', fatigueColor)}
          title={`Fatigue: ${fatigueScore ?? '?'}`}
        />
      </div>
    </div>
  )
}
