"use client"

import type { AcousticBreakdown, FeatureStatus } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface AcousticBreakdownProps {
  breakdown: AcousticBreakdown
}

/**
 * Get status badge variant and label
 */
function getStatusConfig(status: FeatureStatus): {
  variant: "default" | "secondary" | "destructive" | "outline"
  label: string
  color: string
} {
  switch (status) {
    case "low":
      return { variant: "secondary", label: "Low", color: "bg-green-500/20 border-green-500/40" }
    case "normal":
      return { variant: "outline", label: "Normal", color: "bg-neutral-500/10 border-neutral-500/30" }
    case "elevated":
      return { variant: "default", label: "Elevated", color: "bg-amber-500/20 border-amber-500/40" }
    case "high":
      return { variant: "destructive", label: "High", color: "bg-red-500/20 border-red-500/40" }
  }
}

/**
 * Get progress bar color based on status
 */
function getBarColor(status: FeatureStatus): string {
  switch (status) {
    case "low":
      return "bg-green-500"
    case "normal":
      return "bg-neutral-500"
    case "elevated":
      return "bg-amber-500"
    case "high":
      return "bg-red-500"
  }
}

export function AcousticBreakdown({ breakdown }: AcousticBreakdownProps) {
  const features = [
    breakdown.speechRate,
    breakdown.rmsEnergy,
    breakdown.spectralFlux,
    breakdown.spectralCentroid,
    breakdown.pauseRatio,
    breakdown.zcr,
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Feature Contributions</h3>
        <p className="text-xs text-muted-foreground">Points contributed to scores</p>
      </div>

      <div className="space-y-3">
        {features.map((feature) => {
          const statusConfig = getStatusConfig(feature.status)
          const barColor = getBarColor(feature.status)
          const contributionPercent = (feature.contribution / feature.maxContribution) * 100

          return (
            <Tooltip key={feature.featureName}>
              <TooltipTrigger asChild>
                <div className="space-y-2 cursor-help">
                  {/* Header Row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-sm font-medium text-foreground truncate">
                        {feature.displayName}
                      </span>
                      <Badge
                        variant={statusConfig.variant}
                        className={cn(
                          "text-xs shrink-0",
                          statusConfig.color
                        )}
                      >
                        {statusConfig.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {feature.rawValue.toFixed(2)}
                      </span>
                      <span className="text-xs font-medium text-amber-500">
                        +{feature.contribution} pts
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-neutral-900/50 border border-neutral-800">
                    <div
                      className={cn(
                        "h-full transition-all duration-500 ease-out",
                        barColor
                      )}
                      style={{ width: `${contributionPercent}%` }}
                    />
                  </div>

                  {/* Max Contribution Label */}
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-muted-foreground/60">
                      {feature.contribution} / {feature.maxContribution} max
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">
                      {contributionPercent.toFixed(0)}% of max
                    </span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[280px]">
                <p className="text-xs">{feature.description}</p>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>

      {/* Legend */}
      <div className="pt-4 border-t border-neutral-800">
        <div className="flex flex-wrap gap-3 items-center justify-center">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span className="text-[10px] text-muted-foreground">Low</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-neutral-500" />
            <span className="text-[10px] text-muted-foreground">Normal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-[10px] text-muted-foreground">Elevated</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-[10px] text-muted-foreground">High</span>
          </div>
        </div>
      </div>
    </div>
  )
}
