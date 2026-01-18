"use client"

/**
 * Coach Avatar Component
 *
 * Displays the AI-generated coach avatar as a circular image.
 * Falls back to a styled icon when no avatar is available.
 */

import { useState } from "react"
import { Sparkles } from "@/lib/icons"
import { cn } from "@/lib/utils"

interface CoachAvatarProps {
  /** Base64-encoded PNG image data (no data: prefix) */
  base64?: string | null
  /** Size variant */
  size?: "sm" | "md" | "lg" | "xl"
  /** Additional CSS classes */
  className?: string
  /** Alt text for accessibility */
  alt?: string
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
}

const iconSizeClasses = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-8 w-8",
}

export function CoachAvatar({
  base64,
  size = "md",
  className,
  alt = "AI Coach",
}: CoachAvatarProps) {
  const [hasError, setHasError] = useState(false)

  // Show fallback if no base64 or if image failed to load
  const showFallback = !base64 || hasError

  if (showFallback) {
    return (
      <div
        className={cn(
          "rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0",
          sizeClasses[size],
          className
        )}
        role="img"
        aria-label={alt}
      >
        <Sparkles className={cn("text-accent", iconSizeClasses[size])} />
      </div>
    )
  }

  return (
    <img
      src={`data:image/png;base64,${base64}`}
      alt={alt}
      className={cn(
        "rounded-full object-cover flex-shrink-0",
        sizeClasses[size],
        className
      )}
      onError={() => setHasError(true)}
    />
  )
}

/**
 * Loading state variant of the coach avatar.
 * Shows a pulsing placeholder while avatar is being generated.
 */
export function CoachAvatarLoading({
  size = "md",
  className,
}: Pick<CoachAvatarProps, "size" | "className">) {
  return (
    <div
      className={cn(
        "rounded-full bg-accent/20 animate-pulse flex-shrink-0",
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label="Loading avatar..."
    />
  )
}
