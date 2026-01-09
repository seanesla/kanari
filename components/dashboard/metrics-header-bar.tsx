"use client"

import { useMemo } from "react"
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Flame } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDashboardStats, useTrendData } from "@/hooks/use-storage"
import { predictBurnoutRisk } from "@/lib/ml/forecasting"
// Unified check-in button replaces separate entry points
import { CheckInButton } from "@/components/dashboard/check-in-button"
import type { BurnoutPrediction } from "@/lib/types"

export function MetricsHeaderBar() {
  const dashboardStats = useDashboardStats()
  const storedTrendData = useTrendData(7)

  // Calculate wellness score (100 - average of stress and fatigue)
  const wellnessScore = useMemo(() => {
    if (dashboardStats.totalRecordings === 0) return null
    const avgNegative = (dashboardStats.averageStress + dashboardStats.averageFatigue) / 2
    return Math.max(0, Math.round(100 - avgNegative))
  }, [dashboardStats])

  // Calculate burnout prediction
  const burnoutPrediction: BurnoutPrediction | null = useMemo(() => {
    if (storedTrendData.length < 2) return null
    return predictBurnoutRisk(storedTrendData)
  }, [storedTrendData])

  // Risk level styling
  const riskConfig = {
    low: { color: "text-success", bg: "bg-success/10", icon: TrendingUp },
    moderate: { color: "text-accent", bg: "bg-accent/10", icon: Minus },
    high: { color: "text-orange-500", bg: "bg-orange-500/10", icon: TrendingDown },
    critical: { color: "text-destructive", bg: "bg-destructive/10", icon: AlertTriangle },
  }

  // Wellness score color
  const wellnessColor = useMemo(() => {
    if (wellnessScore === null) return "text-muted-foreground"
    if (wellnessScore <= 40) return "text-destructive"
    if (wellnessScore <= 70) return "text-accent"
    return "text-success"
  }, [wellnessScore])

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl px-4 py-3 md:px-6 md:py-4">
      {/* Metrics */}
      <div className="flex flex-wrap items-center gap-4 md:gap-6">
        {/* Wellness Score */}
        <div className="flex items-center gap-2">
          <div className={cn("text-2xl md:text-3xl font-serif tabular-nums", wellnessColor)}>
            {wellnessScore !== null ? wellnessScore : "--"}
          </div>
          <div className="text-xs text-muted-foreground leading-tight">
            <div>Wellness</div>
            <div>Score</div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-border/70 hidden md:block" />

        {/* Burnout Risk */}
        {burnoutPrediction ? (
          <div className="flex items-center gap-2">
            {(() => {
              const config = riskConfig[burnoutPrediction.riskLevel]
              const Icon = config.icon
              return (
                <>
                  <div className={cn("p-1.5 rounded-md", config.bg)}>
                    <Icon className={cn("h-4 w-4", config.color)} />
                  </div>
                  <div>
                    <div className={cn("text-sm font-medium capitalize", config.color)}>
                      {burnoutPrediction.riskLevel}
                    </div>
                    <div className="text-xs text-muted-foreground">Burnout risk</div>
                  </div>
                </>
              )
            })()}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-muted/20">
              <Minus className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">N/A</div>
              <div className="text-xs text-muted-foreground">Burnout risk</div>
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="h-8 w-px bg-border/70 hidden md:block" />

        {/* Streak */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-orange-500/10">
            <Flame className="h-4 w-4 text-orange-500" />
          </div>
          <div>
            <div className="text-sm font-medium">
              {dashboardStats.currentStreak} day{dashboardStats.currentStreak !== 1 ? "s" : ""}
            </div>
            <div className="text-xs text-muted-foreground">Streak</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/*
          Unified Check-in Button
          Single entry point for AI chat check-ins with live biomarker capture.
          Uses the user's custom accent color from SceneContext.
        */}
        <CheckInButton />
      </div>
    </div>
  )
}
