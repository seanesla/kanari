'use client'

import { useMemo } from 'react'
import { Mic } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CheckInSession } from '@/lib/types'

interface CheckInMarkerProps {
  session: CheckInSession
  className?: string
}

// Fix 7: Theme-aware colors using semantic Tailwind classes
// Low stress (0-33) = green, moderate (34-66) = amber, high (67+) = red
function getScoreColor(score: number | undefined): string {
  if (score === undefined) return 'bg-muted-foreground/50'
  if (score < 34) return 'bg-emerald-500'
  if (score < 67) return 'bg-amber-500'
  return 'bg-rose-500'
}

function scoreToBand(score: number | undefined): 'low' | 'medium' | 'high' | 'unknown' {
  if (score === undefined) return 'unknown'
  if (score < 34) return 'low'
  if (score < 67) return 'medium'
  return 'high'
}

export function CheckInMarker({ session, className }: CheckInMarkerProps) {
  const stressScore = session.acousticMetrics?.stressScore
  const fatigueScore = session.acousticMetrics?.fatigueScore

  const stressColor = useMemo(() => getScoreColor(stressScore), [stressScore])
  const fatigueColor = useMemo(() => getScoreColor(fatigueScore), [fatigueScore])

  // Fix 4: Build accessible label for screen readers
  const ariaLabel = `Check-in. Stress: ${scoreToBand(stressScore)}. Fatigue: ${scoreToBand(fatigueScore)}. Click for details.`

  return (
    <div
      // Fix 4: Keyboard accessibility - role, tabIndex, aria attributes
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-haspopup="dialog"
      className={cn(
        'h-full w-full flex items-center gap-1.5 px-2 py-1',
        'rounded bg-amber-500/20 border border-amber-500/40',
        'cursor-pointer hover:bg-amber-500/30 transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1',
        className
      )}
      // Fix 3: Removed native title attributes - Radix popover provides richer info
    >
      {/* Mic icon */}
      <Mic className="h-3 w-3 text-amber-500 flex-shrink-0" aria-hidden="true" />

      {/* Stress/fatigue indicator dots */}
      <div className="flex gap-1" aria-hidden="true">
        <div className={cn('w-2 h-2 rounded-full', stressColor)} />
        <div className={cn('w-2 h-2 rounded-full', fatigueColor)} />
      </div>
    </div>
  )
}
