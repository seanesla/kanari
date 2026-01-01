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
import type { InitPhase } from "@/hooks/check-in/state"

interface VoiceIndicatorProps {
  state: CheckInState
  audioLevel?: number // 0-1
  className?: string
  /** Current initialization phase for enhanced feedback during startup */
  initPhase?: InitPhase
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

/**
 * Larger version with label for main dialog
 */
export function VoiceIndicatorLarge({
  state,
  audioLevel = 0,
  className,
  initPhase,
}: VoiceIndicatorProps) {
  const config = stateConfig[state]
  const isActive = ["listening", "user_speaking", "ai_greeting", "assistant_speaking"].includes(state)
  const isPulsing = ["connecting", "processing"].includes(state)
  const isInitializing = ["initializing", "connecting"].includes(state)

  const stateLabels: Record<CheckInState, string> = {
    idle: "Ready",
    initializing: "Starting...",
    connecting: "Connecting...",
    ready: "Ready to listen",
    ai_greeting: "Saying hello...",
    listening: "Listening...",
    user_speaking: "Hearing you...",
    processing: "Thinking...",
    assistant_speaking: "Speaking...",
    ending: "Finishing up...",
    complete: "Complete",
    error: "Error",
  }

  // Create more bars for larger display
  const barHeights = [0.2, 0.35, 0.5, 0.7, 0.9, 0.7, 0.5, 0.35, 0.2].map((base) =>
    Math.max(base, base + audioLevel * (1 - base))
  )

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {/* Main indicator circle with bars */}
      <div className="relative">
        {/* Outer glow - show during init or active states */}
        {(isActive || isInitializing) && (
          <motion.div
            className={cn(
              "absolute inset-[-20px] rounded-full blur-2xl",
              config.color
            )}
            animate={
              isInitializing
                ? {
                    scale: [1, 1.4, 1],
                    opacity: [0.15, 0.35, 0.15],
                  }
                : {
                    scale: [1, 1.3, 1],
                    opacity: [0.1, 0.3, 0.1],
                  }
            }
            transition={{
              duration: isInitializing ? 1.5 : 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}

        {/* Secondary shimmer ring during initialization */}
        {isInitializing && (
          <motion.div
            className="absolute inset-[-10px] rounded-full border-2 border-accent/30"
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.3, 0.6, 0.3],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        )}

        {/* Circle background */}
        <motion.div
          className={cn(
            "relative flex items-center justify-center w-32 h-32 rounded-full border-2 transition-colors duration-300",
            isActive ? "border-current" : isInitializing ? "border-accent/50" : "border-muted",
            config.color.replace("bg-", "text-")
          )}
          animate={
            isInitializing
              ? {
                  scale: [1, 1.03, 1],
                  opacity: [0.9, 1, 0.9],
                }
              : isPulsing
                ? {
                    scale: [1, 1.05, 1],
                    opacity: [0.8, 1, 0.8],
                  }
                : {}
          }
          transition={{
            duration: isInitializing ? 0.8 : 1,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {/* Audio bars */}
          <div className="flex items-center justify-center gap-1 h-16 w-24">
            {barHeights.map((height, i) => (
              <motion.div
                key={i}
                className={cn(
                  "w-1.5 rounded-full transition-colors duration-300",
                  config.color
                )}
                animate={
                  isActive
                    ? {
                        height: [
                          `${height * 100}%`,
                          `${Math.max(15, height * 100 * (0.3 + audioLevel * 0.7))}%`,
                          `${height * 100}%`,
                        ],
                      }
                    : isInitializing
                      ? {
                          // Wave-like animation during init - bars move in sequence
                          height: ["20%", "45%", "20%"],
                        }
                      : isPulsing
                        ? {
                            height: ["25%", "50%", "25%"],
                          }
                        : { height: "20%" }
                }
                transition={
                  isActive
                    ? {
                        duration: 0.4 + i * 0.05,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.05,
                      }
                    : isInitializing
                      ? {
                          // Staggered wave effect - each bar slightly delayed
                          duration: 0.6,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: i * 0.08,
                        }
                      : isPulsing
                        ? {
                            duration: 0.4 + i * 0.05,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: i * 0.05,
                          }
                        : { duration: 0.2 }
                }
              />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
