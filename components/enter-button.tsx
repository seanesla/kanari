"use client"

import { ArrowUpRight } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { TransitionLink } from "@/components/transition-link"

interface EnterButtonProps {
  className?: string
  variant?: "hero" | "nav" | "cta"
  children?: React.ReactNode
}

export function EnterButton({ className, variant = "hero", children }: EnterButtonProps) {
  if (variant === "nav") {
    return (
      <TransitionLink
        href="/overview"
        className={cn(
          "text-sm border border-foreground/20 px-4 py-2 hover:bg-foreground hover:text-background transition-all cursor-pointer",
          className
        )}
      >
        {children || "Enter"}
      </TransitionLink>
    )
  }

  if (variant === "cta") {
    return (
      <TransitionLink
        href="/overview"
        className={cn(
          "inline-flex items-center gap-2 bg-foreground text-background px-8 py-4 text-lg hover:bg-accent hover:scale-105 transition-all cursor-pointer",
          className
        )}
      >
        {children || "Try kanari"}
        <ArrowUpRight className="h-5 w-5" />
      </TransitionLink>
    )
  }

  // Hero variant (default)
  return (
    <TransitionLink
      href="/overview"
      className={cn(
        "group inline-flex items-center gap-3 text-lg border-b border-foreground pb-2 hover:text-accent hover:border-accent transition-all cursor-pointer",
        className
      )}
    >
      {children || "Start check-in"}
      <ArrowUpRight className="h-5 w-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
    </TransitionLink>
  )
}
