/**
 * Check-in Input Bar
 *
 * A bottom input bar for starting new check-ins.
 * Styled like a text input but clicking it opens the AI check-in flow.
 */

"use client"

import { Mic } from "lucide-react"
import { useCursorGlow } from "@/hooks/use-cursor-glow"
import { CursorBorderGlow } from "@/components/ui/cursor-border-glow"

interface CheckInInputBarProps {
  onStartNewCheckIn: () => void
}

export function CheckInInputBar({ onStartNewCheckIn }: CheckInInputBarProps) {
  const glow = useCursorGlow({ clampToBorder: true })

  return (
    <div
      className="relative mx-auto w-full max-w-2xl p-4 rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.02)] backdrop-blur-2xl backdrop-saturate-200 group"
      onMouseMove={glow.onMouseMove}
      onMouseLeave={glow.onMouseLeave}
      style={{
        ...glow.style,
        boxShadow:
          "inset 0 1px 0 0 rgba(255, 255, 255, 0.06), inset 0 -1px 0 0 rgba(0, 0, 0, 0.02), 0 8px 32px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.1)",
      }}
    >
      <CursorBorderGlow
        className="rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        size={260}
        borderWidth={2}
      />
      <button
        onClick={onStartNewCheckIn}
        className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-white/10 bg-[rgba(255,255,255,0.02)] text-left text-muted-foreground hover:border-white/20 hover:bg-[rgba(255,255,255,0.04)] transition-all"
      >
        <Mic className="h-5 w-5 text-accent" />
        <span className="text-sm">Start a check-in...</span>
      </button>
    </div>
  )
}
