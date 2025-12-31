/**
 * Check-in Input Bar
 *
 * A bottom input bar for starting new check-ins.
 * Styled like a text input but clicking it opens the Voice Note vs AI Chat mode selector.
 */

"use client"

import { Mic } from "lucide-react"

interface CheckInInputBarProps {
  onStartNewCheckIn: () => void
}

export function CheckInInputBar({ onStartNewCheckIn }: CheckInInputBarProps) {
  return (
    <div className="border-t border-border/50 bg-background/80 backdrop-blur-sm p-4">
      <button
        onClick={onStartNewCheckIn}
        className="flex items-center gap-3 w-full max-w-2xl mx-auto px-4 py-3 rounded-xl border border-border/70 bg-card/30 text-left text-muted-foreground hover:border-accent/50 hover:bg-card/50 transition-all"
      >
        <Mic className="h-5 w-5 text-accent" />
        <span className="text-sm">Start a check-in...</span>
      </button>
    </div>
  )
}
