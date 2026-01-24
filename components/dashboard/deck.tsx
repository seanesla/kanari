"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export type DeckProps = React.HTMLAttributes<HTMLDivElement> & {
  tone?: "default" | "quiet" | "raised"
}

export const Deck = React.forwardRef<HTMLDivElement, DeckProps>(
  ({ className, tone = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-deck
        className={cn(
          "relative rounded-xl border border-border/60",
          "bg-card/70",
          "shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_30px_80px_-70px_rgba(0,0,0,0.9)]",
          "ring-1 ring-white/5",
          tone === "quiet" && "bg-card/55 border-border/50",
          tone === "raised" && "bg-card/80 border-border/70",
          className
        )}
        {...props}
      />
    )
  }
)

Deck.displayName = "Deck"
