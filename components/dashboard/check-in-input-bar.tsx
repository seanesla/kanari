/**
 * Check-in Input Bar
 *
 * A bottom input bar for starting new check-ins.
 * Styled like a text input but clicking it opens the AI check-in flow.
 */

"use client"

import { Mic } from "@/lib/icons"
import { useCursorGlow } from "@/hooks/use-cursor-glow"
import { CursorBorderGlow } from "@/components/ui/cursor-border-glow"
import { Deck } from "@/components/dashboard/deck"

interface CheckInInputBarProps {
  onStartNewCheckIn: () => void
}

export function CheckInInputBar({ onStartNewCheckIn }: CheckInInputBarProps) {
  const glow = useCursorGlow({ clampToBorder: true })

  return (
    <Deck
      tone="raised"
      className="mx-auto w-full max-w-2xl p-4 rounded-2xl group"
      onMouseMove={glow.onMouseMove}
      onMouseLeave={glow.onMouseLeave}
      style={glow.style}
    >
      <CursorBorderGlow
        className="rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        size={260}
        borderWidth={2}
      />
      <button
        onClick={onStartNewCheckIn}
        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-border/60 bg-muted/20 text-left text-muted-foreground hover:border-border/80 hover:bg-muted/30 transition-colors"
      >
        <Mic className="h-5 w-5 text-accent" />
        <span className="text-sm">Start a check-in...</span>
      </button>
    </Deck>
  )
}
