"use client"

import { useState } from "react"
import type { StressLevel, FatigueLevel } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown } from "lucide-react"

/**
 * ScoreCard Component
 *
 * Displays a single stress or fatigue score with:
 * - Large numeric score (0-100)
 * - Circular gauge visualization
 * - Categorical level badge
 * - Analysis method indicator
 * - Expandable sections for detailed breakdowns
 */

interface ScoreCardProps {
  score: number // 0-100
  level: StressLevel | FatigueLevel
  type: "stress" | "fatigue"
  analysisMethod: "hybrid" | "acoustic_only"
  className?: string
}

export function ScoreCard({
  score,
  level,
  type,
  analysisMethod,
  className,
}: ScoreCardProps) {
  const [acousticOpen, setAcousticOpen] = useState(false)
  const [semanticOpen, setSemanticOpen] = useState(false)

  const isStress = type === "stress"
  const label = isStress ? "Stress" : "Fatigue"
  const isElevated = score >= 50

  // Color mapping for levels
  const levelColor = getLevelColor(level)
  const scoreColor = isElevated ? "text-accent" : "text-muted-foreground"

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-6 space-y-4",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-medium text-foreground">{label} Level</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Based on voice biomarkers
          </p>
        </div>
        <Badge
          variant="outline"
          className="text-xs font-mono bg-background/50"
        >
          {analysisMethod === "hybrid" ? "Hybrid" : "Local Only"}
        </Badge>
      </div>

      {/* Score Visualization */}
      <div className="flex items-center gap-6">
        {/* Circular Gauge */}
        <div className="relative">
          <CircularGauge score={score} size={120} isElevated={isElevated} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("text-3xl font-bold", scoreColor)}>
              {score}
            </span>
            <span className="text-xs text-muted-foreground">/ 100</span>
          </div>
        </div>

        {/* Level Badge and Details */}
        <div className="flex-1 space-y-3">
          <Badge
            className={cn(
              "text-sm px-3 py-1 capitalize",
              levelColor
            )}
          >
            {level}
          </Badge>
          <p className="text-sm text-muted-foreground">
            {getLevelDescription(level, type)}
          </p>
        </div>
      </div>

      {/* Expandable Sections */}
      <div className="space-y-2 pt-2 border-t border-border">
        {/* Acoustic Breakdown */}
        <Collapsible open={acousticOpen} onOpenChange={setAcousticOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium text-foreground hover:text-accent transition-colors py-2">
            <span>View acoustic breakdown</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                acousticOpen && "rotate-180"
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 pb-1">
            <div className="rounded-md bg-muted/30 p-4 text-sm text-muted-foreground">
              {/* Placeholder for AcousticBreakdown component */}
              <p className="text-center italic">
                Acoustic feature breakdown will be displayed here
              </p>
              <p className="text-xs text-center mt-2 opacity-70">
                (Speech rate, voice energy, spectral analysis, etc.)
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Gemini Analysis (only show if hybrid) */}
        {analysisMethod === "hybrid" && (
          <Collapsible open={semanticOpen} onOpenChange={setSemanticOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium text-foreground hover:text-accent transition-colors py-2">
              <span>View Gemini analysis</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  semanticOpen && "rotate-180"
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 pb-1">
              <div className="rounded-md bg-muted/30 p-4 text-sm text-muted-foreground">
                {/* Placeholder for SemanticAnalysis component */}
                <p className="text-center italic">
                  Gemini semantic analysis will be displayed here
                </p>
                <p className="text-xs text-center mt-2 opacity-70">
                  (Transcript, emotions, stress/fatigue cues, etc.)
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  )
}

// ============================================
// Circular Gauge Component
// ============================================

interface CircularGaugeProps {
  score: number // 0-100
  size: number // Diameter in pixels
  isElevated: boolean
}

function CircularGauge({ score, size, isElevated }: CircularGaugeProps) {
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={strokeWidth}
        opacity={0.2}
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={isElevated ? "hsl(var(--accent))" : "hsl(var(--muted-foreground))"}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500 ease-out"
        opacity={isElevated ? 1 : 0.6}
      />
    </svg>
  )
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get Tailwind classes for level badge colors
 */
function getLevelColor(level: StressLevel | FatigueLevel): string {
  // Stress levels
  if (level === "low") return "bg-green-500/20 text-green-400 border-green-500/30"
  if (level === "moderate") return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
  if (level === "elevated") return "bg-amber-500/20 text-amber-400 border-amber-500/30"
  if (level === "high") return "bg-red-500/20 text-red-400 border-red-500/30"

  // Fatigue levels
  if (level === "rested") return "bg-green-500/20 text-green-400 border-green-500/30"
  if (level === "normal") return "bg-blue-500/20 text-blue-400 border-blue-500/30"
  if (level === "tired") return "bg-amber-500/20 text-amber-400 border-amber-500/30"
  if (level === "exhausted") return "bg-red-500/20 text-red-400 border-red-500/30"

  return "bg-muted text-muted-foreground"
}

/**
 * Get human-readable description for each level
 */
function getLevelDescription(
  level: StressLevel | FatigueLevel,
  type: "stress" | "fatigue"
): string {
  if (type === "stress") {
    const descriptions: Record<StressLevel, string> = {
      low: "Your voice shows minimal stress indicators. Keep up the good work.",
      moderate: "Some stress signals detected. Consider a short break soon.",
      elevated: "Significant stress indicators present. Time to pause and recharge.",
      high: "High stress levels detected. Please prioritize self-care.",
    }
    return descriptions[level as StressLevel]
  } else {
    const descriptions: Record<FatigueLevel, string> = {
      rested: "Your voice shows good energy levels. You're well-rested.",
      normal: "Normal energy levels detected. Stay balanced.",
      tired: "Signs of fatigue appearing. Consider rest or a lighter workload.",
      exhausted: "Significant fatigue detected. Rest is strongly recommended.",
    }
    return descriptions[level as FatigueLevel]
  }
}
