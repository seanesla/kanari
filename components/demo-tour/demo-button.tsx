"use client"

import { useCallback, useState } from "react"
import { useTourSafe } from "@/lib/demo-tour/tour-context"
import { Play } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { preloadTourOverlay } from "./tour-overlay-lazy"

interface DemoButtonProps {
  className?: string
  variant?: "hero" | "nav" | "cta"
}

export function DemoButton({ className, variant = "hero" }: DemoButtonProps) {
  const tour = useTourSafe()
  const [isStarting, setIsStarting] = useState(false)

  const preload = useCallback(() => {
    void preloadTourOverlay()
  }, [])

  const handleStart = useCallback(async () => {
    if (isStarting || !tour) return
    setIsStarting(true)
    try {
      await preloadTourOverlay()
      tour.startTour()
    } finally {
      setIsStarting(false)
    }
  }, [isStarting, tour])

  // Don't render if tour context is not available (SSR) or tour is active
  if (!tour) return null
  if (tour.isActive) return null

  const label = isStarting ? "Loading demo…" : variant === "cta" ? "Watch Demo" : variant === "nav" ? "Show Demo" : "Show demo"

  if (variant === "nav") {
    return (
      <button
        onClick={handleStart}
        onPointerEnter={preload}
        onFocus={preload}
        disabled={isStarting}
        aria-busy={isStarting}
        className={cn(
          "text-sm border border-foreground/20 px-4 py-2 hover:bg-foreground hover:text-background transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed",
          className
        )}
      >
        {label}
      </button>
    )
  }

  if (variant === "cta") {
    return (
      <button
        onClick={handleStart}
        onPointerEnter={preload}
        onFocus={preload}
        disabled={isStarting}
        aria-busy={isStarting}
        className={cn(
          "inline-flex items-center gap-2 border border-foreground/20 px-8 py-4 text-lg hover:border-accent hover:text-accent transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed",
          className
        )}
      >
        <Play className="h-5 w-5" />
        {label}
      </button>
    )
  }

  // Hero variant (default) - styled to complement EnterButton
  return (
    <button
      onClick={handleStart}
      onPointerEnter={preload}
      onFocus={preload}
      disabled={isStarting}
      aria-busy={isStarting}
      className={cn(
        "group inline-flex items-center gap-3 text-lg text-muted-foreground hover:text-accent transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed",
        className
      )}
    >
      <Play className="h-5 w-5" />
      {label}
    </button>
  )
}
