'use client'

import { useRouter } from 'next/navigation'
import { Mic, Clock, TrendingUp, ArrowRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover'
import { formatDate, formatDuration } from '@/lib/date-utils'
import type { Recording } from '@/lib/types'

interface RecordingTooltipProps {
  recording: Recording | null
  open: boolean
  onOpenChange: (open: boolean) => void
  anchorPosition: { x: number; y: number } | null
}

// Get color class based on score (0-100)
function getScoreColor(score: number | undefined): string {
  if (score === undefined) return 'text-muted-foreground'
  if (score < 30) return 'text-green-500'
  if (score < 60) return 'text-yellow-500'
  return 'text-red-500'
}

function getScoreBarColor(score: number | undefined): string {
  if (score === undefined) return 'bg-muted-foreground'
  if (score < 30) return 'bg-green-500'
  if (score < 60) return 'bg-yellow-500'
  return 'bg-red-500'
}

function getScoreLabel(score: number | undefined): string {
  if (score === undefined) return 'Unknown'
  if (score < 30) return 'Low'
  if (score < 60) return 'Moderate'
  if (score < 80) return 'Elevated'
  return 'High'
}

export function RecordingTooltip({
  recording,
  open,
  onOpenChange,
  anchorPosition,
}: RecordingTooltipProps) {
  const router = useRouter()

  if (!recording) return null

  const stressScore = recording.metrics?.stressScore
  const fatigueScore = recording.metrics?.fatigueScore

  const handleViewRecording = () => {
    onOpenChange(false)
    router.push(`/dashboard/recordings?highlight=${recording.id}`)
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {/* Invisible anchor positioned at click location */}
      {anchorPosition && (
        <PopoverAnchor
          style={{
            position: 'fixed',
            left: anchorPosition.x,
            top: anchorPosition.y,
            width: 1,
            height: 1,
            pointerEvents: 'none',
          }}
        />
      )}
      <PopoverContent
        className="w-64 p-0 bg-card/95 backdrop-blur-xl border-border/70"
        side="right"
        sideOffset={8}
        align="start"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-accent/10">
              <Mic className="h-3.5 w-3.5 text-accent" />
            </div>
            <span className="text-sm font-medium">Recording</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-3 space-y-3">
          {/* Time & Duration */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {formatDate(recording.createdAt)}
            </span>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{formatDuration(recording.duration)}</span>
            </div>
          </div>

          {/* Metrics */}
          {recording.metrics ? (
            <div className="space-y-2">
              {/* Stress Score */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Stress</span>
                  <span className={cn('font-medium', getScoreColor(stressScore))}>
                    {stressScore} - {getScoreLabel(stressScore)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', getScoreBarColor(stressScore))}
                    style={{ width: `${stressScore ?? 0}%` }}
                  />
                </div>
              </div>

              {/* Fatigue Score */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Fatigue</span>
                  <span className={cn('font-medium', getScoreColor(fatigueScore))}>
                    {fatigueScore} - {getScoreLabel(fatigueScore)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', getScoreBarColor(fatigueScore))}
                    style={{ width: `${fatigueScore ?? 0}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-2">
              {recording.status === 'processing' ? 'Processing...' : 'No metrics available'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 pt-0">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-accent border-accent/30 hover:bg-accent/10"
            onClick={handleViewRecording}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            View Recording
            <ArrowRight className="h-3.5 w-3.5 ml-auto" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
