'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  useFloating,
  offset,
  flip,
  shift,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
} from '@floating-ui/react'
import { Mic, Clock, TrendingUp, ArrowRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { formatDate, formatDuration } from '@/lib/date-utils'
import type { CheckInSession } from '@/lib/types'

interface CheckInTooltipProps {
  session: CheckInSession | null
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

export function CheckInTooltip({
  session,
  open,
  onOpenChange,
  anchorPosition,
}: CheckInTooltipProps) {
  const router = useRouter()
  const [positionReady, setPositionReady] = useState(false)

  // Source: Context7 - /floating-ui/floating-ui docs - "Configure useFloating Hook for Popover Positioning"
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange,
    placement: 'right-start',
    middleware: [
      offset(8),
      flip({ fallbackPlacements: ['left-start', 'bottom', 'top'] }),
      shift({ padding: 16 }),
    ],
  })

  // Source: Context7 - /floating-ui/floating-ui docs - "Position Floating Element Relative to Click (React)"
  // Set virtual element as position reference when anchor position changes
  useEffect(() => {
    if (!anchorPosition) {
      setPositionReady(false)
      return
    }
    refs.setPositionReference({
      getBoundingClientRect() {
        return {
          width: 0,
          height: 0,
          x: anchorPosition.x,
          y: anchorPosition.y,
          top: anchorPosition.y,
          left: anchorPosition.x,
          right: anchorPosition.x,
          bottom: anchorPosition.y,
        }
      },
    })
    setPositionReady(true)
  }, [anchorPosition, refs])

  // Source: Context7 - /floating-ui/floating-ui docs - "Enable Dismiss on Ancestor Scroll"
  const dismiss = useDismiss(context, {
    ancestorScroll: true,
  })

  // Source: Context7 - /floating-ui/floating-ui docs - "Set custom role for useRole Hook"
  const role = useRole(context, {
    role: 'dialog',
  })

  const { getFloatingProps } = useInteractions([dismiss, role])

  // Defensive check - don't render until position is ready to prevent scroll jump
  if (!session?.id || !open || !anchorPosition || !positionReady) return null

  const stressScore = session.acousticMetrics?.stressScore
  const fatigueScore = session.acousticMetrics?.fatigueScore

  const handleViewCheckIn = () => {
    onOpenChange(false)
    router.push(`/dashboard/history?highlight=${session.id}`)
  }

  return (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        style={floatingStyles}
        {...getFloatingProps()}
        className="w-64 max-w-[calc(100vw-2rem)] p-0 bg-card/95 backdrop-blur-xl border border-border/70 rounded-md shadow-md z-50 animate-in fade-in-0 zoom-in-95"
      >
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-accent/10">
                <Mic className="h-3.5 w-3.5 text-accent" />
              </div>
              <span className="text-sm font-medium">Check-in</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onOpenChange(false)}
              aria-label="Close check-in details"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Content */}
          <div className="p-3 space-y-3">
            {/* Time & Duration */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {formatDate(session.startedAt)}
              </span>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{formatDuration(session.duration ?? 0)}</span>
              </div>
            </div>

            {/* Metrics */}
            {session.acousticMetrics ? (
              <div className="space-y-2">
                {/* Stress Score */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Stress</span>
                    <span className={cn('font-medium', getScoreColor(stressScore))}>
                      {stressScore !== undefined ? stressScore : '—'} · {getScoreLabel(stressScore)}
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
                      {fatigueScore !== undefined ? fatigueScore : '—'} · {getScoreLabel(fatigueScore)}
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
                No metrics available
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 pt-0">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-accent border-accent/30 hover:bg-accent/10"
              onClick={handleViewCheckIn}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              View Check-in
              <ArrowRight className="h-3.5 w-3.5 ml-auto" />
            </Button>
          </div>
      </div>
    </FloatingPortal>
  )
}
