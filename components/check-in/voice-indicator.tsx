"use client"

/**
 * Voice Indicator Component
 *
 * Animated visual indicator showing listening/speaking states
 * with audio level visualization.
 */

import { cn } from "@/lib/utils"
import type { CheckInState } from "@/lib/types"

interface VoiceIndicatorProps {
  state: CheckInState
  audioLevel?: number // 0-1
  className?: string
}

const stateConfig: Record<CheckInState, { color: string }> = {
  idle: { color: "bg-muted" },
  initializing: { color: "bg-accent/50" },
  connecting: { color: "bg-accent/50" },
  ready: { color: "bg-accent" },
  ai_greeting: { color: "bg-blue-500" },
  listening: { color: "bg-accent" },
  user_speaking: { color: "bg-green-500" },
  processing: { color: "bg-yellow-500" },
  assistant_speaking: { color: "bg-blue-500" },
  ending: { color: "bg-muted" },
  complete: { color: "bg-muted" },
  error: { color: "bg-red-500" },
}

export function VoiceIndicator({
  state,
  audioLevel = 0,
  className,
}: VoiceIndicatorProps) {
  const config = stateConfig[state]
  const isActive = ["listening", "user_speaking", "ai_greeting", "assistant_speaking"].includes(state)

  // Scale bars based on audio level
  const barHeights = [0.3, 0.5, 0.7, 0.5, 0.3].map((base) =>
    Math.max(base, base + audioLevel * (1 - base))
  )

  return (
    <div
      className={cn(
        "relative flex items-center justify-center gap-1",
        className
      )}
    >
      {/* Outer glow for active states */}
      {isActive && (
        <div
          className={cn("absolute inset-0 rounded-full blur-xl", config.color)}
          style={{ opacity: 0.15 + audioLevel * 0.25 }}
        />
      )}

      {/* Main indicator - audio bars */}
      <div className="relative flex items-center justify-center gap-0.5 h-8 w-12">
        {barHeights.map((height, i) => (
          <div
            key={i}
            className={cn(
              "w-1 rounded-full transition-colors duration-300",
              config.color
            )}
            style={{ height: `${Math.max(25, height * 100)}%` }}
          />
        ))}
      </div>
    </div>
  )
}
