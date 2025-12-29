"use client"

import { Check, Circle } from "lucide-react"
import { cn } from "@/lib/utils"

interface JourneyProgressProps {
  hasRecordings: boolean
  hasAnalysis: boolean
  hasSuggestions: boolean
  hasScheduledRecovery: boolean
  className?: string
}

interface StepProps {
  label: string
  isComplete: boolean
  isLast?: boolean
}

function Step({ label, isComplete, isLast = false }: StepProps) {
  return (
    <div className="flex items-center flex-1">
      <div className="flex items-center gap-3">
        {/* Step circle */}
        <div
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition-colors",
            isComplete
              ? "bg-accent text-accent-foreground"
              : "bg-muted border border-border text-muted-foreground"
          )}
        >
          {isComplete ? (
            <Check className="h-4 w-4" />
          ) : (
            <Circle className="h-4 w-4 fill-current opacity-30" />
          )}
        </div>

        {/* Label */}
        <span
          className={cn(
            "text-sm font-medium transition-colors whitespace-nowrap",
            isComplete ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {label}
        </span>
      </div>

      {/* Connector line */}
      {!isLast && (
        <div className="flex-1 h-px mx-4 bg-border relative min-w-8">
          <div
            className={cn(
              "absolute inset-0 bg-accent transition-all duration-500",
              isComplete ? "w-full" : "w-0"
            )}
          />
        </div>
      )}
    </div>
  )
}

export function JourneyProgress({
  hasRecordings,
  hasAnalysis,
  hasSuggestions,
  hasScheduledRecovery,
  className,
}: JourneyProgressProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/70 bg-card/20 backdrop-blur-xl p-6",
        className
      )}
    >
      <div className="flex items-center">
        <Step label="Recorded" isComplete={hasRecordings} />
        <Step label="Analyzed" isComplete={hasAnalysis} />
        <Step label="Get Suggestions" isComplete={hasSuggestions} />
        <Step label="Schedule Recovery" isComplete={hasScheduledRecovery} isLast />
      </div>
    </div>
  )
}
