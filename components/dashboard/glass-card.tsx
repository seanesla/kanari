"use client"

import { forwardRef } from "react"
import { cn } from "@/lib/utils"

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  gradient?: boolean
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, hover = false, gradient = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl",
          hover &&
            "transition-all duration-300 hover:border-accent/40 hover:bg-card/40 hover:shadow-lg hover:shadow-accent/5",
          gradient && "gradient-overlay-accent",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

GlassCard.displayName = "GlassCard"
