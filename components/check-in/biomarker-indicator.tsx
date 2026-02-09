"use client"

import { cn } from "@/lib/utils"
import type { CheckInSession } from "@/lib/types"

interface BiomarkerIndicatorProps {
  metrics?: CheckInSession["acousticMetrics"] | null
  className?: string
  compact?: boolean
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function getStressColor(score: number): string {
  if (score >= 70) return "bg-destructive"
  if (score >= 50) return "bg-orange-500"
  return "bg-success"
}

function getFatigueColor(score: number): string {
  if (score >= 70) return "bg-[color:var(--accent-light)]"
  if (score >= 50) return "bg-accent"
  return "bg-success"
}

function MetricBar({
  label,
  value,
  level,
  colorClass,
  showNumbers,
}: {
  label: string
  value: number
  level?: string
  colorClass: string
  showNumbers: boolean
}) {
  const score = clampScore(value)

  return (
    <div className="min-w-0 flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="min-w-0 truncate pr-2">{label}</span>
        <span className="tabular-nums">{showNumbers ? score : ""}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted/40 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", colorClass)} style={{ width: `${score}%` }} />
      </div>
      {level ? (
        <div className="text-[11px] text-muted-foreground capitalize">{level}</div>
      ) : null}
    </div>
  )
}

export function BiomarkerIndicator({ metrics, className, compact = false }: BiomarkerIndicatorProps) {
  if (!metrics) {
    return (
      <div className={cn("rounded-lg border border-border/50 bg-background/50 px-4 py-3", className)}>
        <p className="text-xs text-muted-foreground">Listening for voice biomarkers...</p>
      </div>
    )
  }

  const stressScore = clampScore(metrics.stressScore)
  const fatigueScore = clampScore(metrics.fatigueScore)
  const displayConfidence = metrics.acousticConfidence ?? metrics.confidence ?? 0
  const confidencePct = Math.round(displayConfidence * 100)
  const showNumbers = displayConfidence >= 0.65

  const qualityReasons = (metrics.quality?.reasons ?? []).slice(0, 2)
  const stressDrivers = (metrics.explanations?.stress ?? []).slice(0, compact ? 2 : 3)
  const fatigueDrivers = (metrics.explanations?.fatigue ?? []).slice(0, compact ? 2 : 3)

  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border border-border/50 bg-background/60 px-4 py-3",
        compact ? "text-xs" : "text-sm",
        className
      )}
    >
      <div className={cn("grid gap-3", compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
        <MetricBar
          label="Stress"
          value={stressScore}
          level={metrics.stressLevel}
          colorClass={getStressColor(stressScore)}
          showNumbers={showNumbers}
        />
        <MetricBar
          label="Fatigue"
          value={fatigueScore}
          level={metrics.fatigueLevel}
          colorClass={getFatigueColor(fatigueScore)}
          showNumbers={showNumbers}
        />
      </div>

      <div className="mt-2 text-[11px] text-muted-foreground">Confidence {confidencePct}%</div>

      {!showNumbers && qualityReasons.length > 0 ? (
        <div className="mt-1 text-[11px] text-muted-foreground">
          Low confidence: {qualityReasons.join(" • ")}
        </div>
      ) : null}

      {stressDrivers.length > 0 || fatigueDrivers.length > 0 ? (
        <div className="mt-2 text-[11px] text-muted-foreground">
          {metrics.explanations?.mode === "baseline" ? "Compared to your baseline:" : "What Kanari noticed:"}
          {stressDrivers.length > 0 ? (
            <div className="mt-1">
              <span className="text-foreground/70">Stress:</span> {stressDrivers.join(" • ")}
            </div>
          ) : null}
          {fatigueDrivers.length > 0 ? (
            <div className="mt-1">
              <span className="text-foreground/70">Fatigue:</span> {fatigueDrivers.join(" • ")}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
