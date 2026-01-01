"use client"

import { useTransitionRouter } from "next-view-transitions"
import { useSceneMode } from "@/lib/scene-context"
import { ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface EnterButtonProps {
  className?: string
  variant?: "hero" | "nav" | "cta"
  children?: React.ReactNode
}

export function EnterButton({ className, variant = "hero", children }: EnterButtonProps) {
  const { setMode } = useSceneMode()
  const router = useTransitionRouter()

  const handleClick = () => {
    // Trigger the 3D transition and navigate immediately
    // The scene will animate during page transition (like dashboard→landing does)
    setMode("transitioning")
    router.push("/dashboard")
  }

  if (variant === "nav") {
    return (
      <button
        onClick={handleClick}
        className={cn(
          "text-sm border border-foreground/20 px-4 py-2 hover:bg-foreground hover:text-background transition-all cursor-pointer",
          className
        )}
      >
        {children || "Enter"}
      </button>
    )
  }

  if (variant === "cta") {
    return (
      <button
        onClick={handleClick}
        className={cn(
          "inline-flex items-center gap-2 bg-foreground text-background px-8 py-4 text-lg hover:bg-accent hover:scale-105 transition-all cursor-pointer",
          className
        )}
      >
        {children || "Try kanari"}
        <ArrowUpRight className="h-5 w-5" />
      </button>
    )
  }

  // Hero variant (default)
  return (
    <button
      onClick={handleClick}
      className={cn(
        "group inline-flex items-center gap-3 text-lg border-b border-foreground pb-2 hover:text-accent hover:border-accent transition-all cursor-pointer",
        className
      )}
    >
      {children || "Start check-in"}
      <ArrowUpRight className="h-5 w-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
    </button>
  )
}
