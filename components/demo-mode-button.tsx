"use client"

import { useCallback } from "react"
import { Sparkles } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { setWorkspace } from "@/lib/workspace"

type DemoModeButtonVariant = "hero" | "cta" | "nav"

interface DemoModeButtonProps {
  variant?: DemoModeButtonVariant
  className?: string
}

export function DemoModeButton({ variant = "hero", className }: DemoModeButtonProps) {
  const handleClick = useCallback(() => {
    setWorkspace("demo")
    // Hard navigation is intentional so the app boots on the demo DB cleanly.
    window.location.href = "/onboarding"
  }, [])

  if (variant === "cta") {
    return (
      <Button
        type="button"
        size="lg"
        variant="outline"
        onClick={handleClick}
        className={cn(
          "gap-2 border-border/70 bg-background/20 hover:bg-accent hover:text-accent-foreground hover:border-accent/50 dark:hover:bg-accent dark:hover:text-accent-foreground dark:hover:border-accent/50",
          className
        )}
      >
        <Sparkles className="h-4 w-4" />
        Demo Mode
      </Button>
    )
  }

  if (variant === "nav") {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleClick}
        className={cn(
          "gap-2 border-border/70 bg-background/10 hover:bg-accent hover:text-accent-foreground hover:border-accent/50 dark:hover:bg-accent dark:hover:text-accent-foreground dark:hover:border-accent/50",
          className
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        Demo Mode
      </Button>
    )
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handleClick}
      className={cn(
        "gap-2 border-border/70 bg-background/10 hover:bg-accent hover:text-accent-foreground hover:border-accent/50 dark:hover:bg-accent dark:hover:text-accent-foreground dark:hover:border-accent/50",
        className
      )}
    >
      <Sparkles className="h-3.5 w-3.5" />
      Demo Mode
    </Button>
  )
}
