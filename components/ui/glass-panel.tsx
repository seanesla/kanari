"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { useSceneMode } from "@/lib/scene-context"

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Enable the accent-colored glow effect on the border */
  glow?: boolean
  /** Intensity of the glow (0-1, default 0.15) */
  glowIntensity?: number
  /** Backdrop blur amount */
  blur?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl"
}

/**
 * A glassmorphism panel component with optional accent-colored glow.
 * Designed to be very transparent so particles show through.
 */
export function GlassPanel({
  className,
  glow = false,
  glowIntensity = 0.15,
  blur = "xl",
  style,
  ...props
}: GlassPanelProps) {
  const { accentColor } = useSceneMode()

  // Convert intensity (0-1) to hex opacity (00-FF)
  const opacityHex = Math.round(glowIntensity * 255)
    .toString(16)
    .padStart(2, "0")

  const glowStyle = glow
    ? {
        boxShadow: `0 0 15px ${accentColor}${opacityHex}`,
        ...style,
      }
    : style

  const blurClass = {
    sm: "backdrop-blur-sm",
    md: "backdrop-blur-md",
    lg: "backdrop-blur-lg",
    xl: "backdrop-blur-xl",
    "2xl": "backdrop-blur-2xl",
    "3xl": "backdrop-blur-3xl",
  }[blur]

  return (
    <div
      className={cn(
        // Very transparent background
        "bg-foreground/5",
        // Backdrop blur
        blurClass,
        // Border with accent or default color
        glow ? "border border-accent/30" : "border border-border/30",
        // Rounded corners
        "rounded-lg",
        className
      )}
      style={glowStyle}
      {...props}
    />
  )
}
