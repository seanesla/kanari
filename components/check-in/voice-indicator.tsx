"use client"

/**
 * Voice Indicator Component
 *
 * Animated visual indicator showing listening/speaking states
 * with audio level visualization.
 */

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import type { CheckInState } from "@/lib/types"

interface VoiceIndicatorProps {
  state: CheckInState
  audioLevel?: number // 0-1
  className?: string
}

const stateConfig: Record<CheckInState, { color: string; pulseDelay: number }> = {
  idle: { color: "bg-muted", pulseDelay: 0 },
  initializing: { color: "bg-accent/50", pulseDelay: 0 },
  connecting: { color: "bg-accent/50", pulseDelay: 0 },
  ready: { color: "bg-accent", pulseDelay: 0 },
  ai_greeting: { color: "bg-blue-500", pulseDelay: 0 },
  listening: { color: "bg-accent", pulseDelay: 0 },
  user_speaking: { color: "bg-green-500", pulseDelay: 0 },
  processing: { color: "bg-yellow-500", pulseDelay: 0 },
  assistant_speaking: { color: "bg-blue-500", pulseDelay: 0 },
  ending: { color: "bg-muted", pulseDelay: 0 },
  complete: { color: "bg-muted", pulseDelay: 0 },
  error: { color: "bg-red-500", pulseDelay: 0 },
}

export function VoiceIndicator({
  state,
  audioLevel = 0,
  className,
}: VoiceIndicatorProps) {
  const config = stateConfig[state]
  const isActive = ["listening", "user_speaking", "ai_greeting", "assistant_speaking"].includes(state)
  const isPulsing = ["connecting", "processing"].includes(state)

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
        <motion.div
          className={cn(
            "absolute inset-0 rounded-full blur-xl opacity-30",
            config.color
          )}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Main indicator - audio bars */}
      <div className="relative flex items-center justify-center gap-0.5 h-8 w-12">
        {barHeights.map((height, i) => (
          <motion.div
            key={i}
            className={cn(
              "w-1 rounded-full transition-colors duration-300",
              config.color
            )}
            animate={
              isActive
                ? {
                    height: [
                      `${height * 100}%`,
                      `${Math.max(20, height * 100 * (0.5 + audioLevel))}%`,
                      `${height * 100}%`,
                    ],
                  }
                : isPulsing
                  ? {
                      height: ["30%", "60%", "30%"],
                    }
                  : { height: "30%" }
            }
            transition={
              isActive || isPulsing
                ? {
                    duration: 0.5 + i * 0.1,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.1,
                  }
                : { duration: 0.2 }
            }
          />
        ))}
      </div>
    </div>
  )
}
