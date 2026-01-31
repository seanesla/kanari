"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { TrendingUp, AlertTriangle, TrendingDown, Minus, ChevronDown, Calendar } from "@/lib/icons"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { useSceneMode } from "@/lib/scene-context"
import { useTimeZone } from "@/lib/timezone-context"
import { Deck } from "@/components/dashboard/deck"
import { StressFatigueChart } from "@/components/dashboard/stress-fatigue-chart"
import { InsightsPanel } from "@/components/dashboard/insights-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import type { BurnoutPrediction, CheckInSession, Recording, TrendData } from "@/lib/types"

interface OverviewAnalyticsSectionProps {
  burnoutPrediction: BurnoutPrediction | null
  storedTrendData: TrendData[]
  recordings: Recording[]
  sessions: CheckInSession[]
}

export function OverviewAnalyticsSection({
  burnoutPrediction,
  storedTrendData,
  recordings,
  sessions,
}: OverviewAnalyticsSectionProps) {
  const { accentColor } = useSceneMode()
  const { timeZone } = useTimeZone()
  const [stressChartExpanded, setStressChartExpanded] = useState(false)
  const [wellnessExpanded, setWellnessExpanded] = useState(false)

  type RangeDays = 7 | 14 | 30
  const [rangeDays, setRangeDays] = useState<RangeDays>(14)

  const latestSynthesisSession = useMemo(() => {
    return sessions.find((s) => !!s.synthesis) ?? null
  }, [sessions])

  const riskLevelConfig = {
    low: {
      color: "text-success",
      bg: "bg-success/10",
      border: "border-success/50",
      icon: TrendingUp,
    },
    moderate: {
      color: "text-accent",
      bg: "bg-accent/10",
      border: "border-accent/50",
      icon: Minus,
    },
    high: {
      color: "text-destructive",
      bg: "bg-destructive/10",
      border: "border-destructive/50",
      icon: TrendingDown,
    },
    critical: {
      color: "text-destructive",
      bg: "bg-destructive/20",
      border: "border-destructive",
      icon: AlertTriangle,
    },
  } satisfies Record<NonNullable<BurnoutPrediction>["riskLevel"], {
    color: string
    bg: string
    border: string
    icon: typeof TrendingUp
  }>

  const trendDataSorted = useMemo(() => {
    // `TrendData.date` is a YYYY-MM-DD string (UTC day). Sort lexicographically for stability.
    return [...storedTrendData].sort((a, b) => a.date.localeCompare(b.date))
  }, [storedTrendData])

  const currentTrendWindow = useMemo(() => {
    return trendDataSorted.slice(-rangeDays)
  }, [trendDataSorted, rangeDays])

  const previousTrendWindow = useMemo(() => {
    const end = Math.max(0, trendDataSorted.length - rangeDays)
    const start = Math.max(0, end - rangeDays)
    return trendDataSorted.slice(start, end)
  }, [trendDataSorted, rangeDays])

  const chartData = useMemo(() => {
    return currentTrendWindow.map((data) => {
      // Use a stable midday UTC timestamp to avoid off-by-one when formatting in local time zones.
      const date = new Date(`${data.date}T12:00:00.000Z`)
      const day = rangeDays <= 10
        ? date.toLocaleDateString("en-US", { weekday: "short", timeZone })
        : date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone })
      return {
        day,
        stress: data.stressScore,
        fatigue: data.fatigueScore,
      }
    })
  }, [currentTrendWindow, rangeDays, timeZone])

  const summarizeWindow = useMemo(() => {
    const sum = (arr: TrendData[], key: "stressScore" | "fatigueScore") =>
      arr.reduce((acc, d) => acc + d[key], 0)

    const avg = (arr: TrendData[], key: "stressScore" | "fatigueScore") => {
      if (arr.length === 0) return null
      return Math.round(sum(arr, key) / arr.length)
    }

    const currentAvgStress = avg(currentTrendWindow, "stressScore")
    const currentAvgFatigue = avg(currentTrendWindow, "fatigueScore")
    const prevAvgStress = avg(previousTrendWindow, "stressScore")
    const prevAvgFatigue = avg(previousTrendWindow, "fatigueScore")

    const currentWellness = currentAvgStress === null || currentAvgFatigue === null
      ? 0
      : Math.max(0, Math.round(100 - (currentAvgStress + currentAvgFatigue) / 2))

    const prevWellness = prevAvgStress === null || prevAvgFatigue === null
      ? null
      : Math.max(0, Math.round(100 - (prevAvgStress + prevAvgFatigue) / 2))

    const deltaStress = currentAvgStress === null || prevAvgStress === null ? null : currentAvgStress - prevAvgStress
    const deltaFatigue = currentAvgFatigue === null || prevAvgFatigue === null ? null : currentAvgFatigue - prevAvgFatigue
    const deltaWellness = prevWellness === null ? null : currentWellness - prevWellness

    const checkInCount = currentTrendWindow.reduce((acc, d) => acc + (d.recordingCount ?? 1), 0)
    const coverageDays = currentTrendWindow.length

    const lastDateISO = currentTrendWindow.at(-1)?.date ?? null
    const lastUpdatedLabel = lastDateISO
      ? new Date(`${lastDateISO}T12:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone })
      : null

    return {
      currentAvgStress,
      currentAvgFatigue,
      currentWellness,
      prevWellness,
      deltaStress,
      deltaFatigue,
      deltaWellness,
      checkInCount,
      coverageDays,
      lastUpdatedLabel,
    }
  }, [currentTrendWindow, previousTrendWindow, timeZone])

  const wellnessScore = summarizeWindow.currentWellness

  const wellnessColor = useMemo(() => {
    if (wellnessScore <= 40) return "#ef4444"
    if (wellnessScore <= 70) return accentColor
    return "#22c55e"
  }, [wellnessScore, accentColor])

  const aggregatedFeatures = useMemo(() => {
    const entries = [
      ...recordings
        .filter((r) => r.features)
        .map((r) => ({ date: r.createdAt, features: r.features! })),
      ...sessions
        .filter((s) => s.acousticMetrics?.features)
        .map((s) => ({ date: s.startedAt, features: s.acousticMetrics!.features })),
    ]

    if (entries.length === 0) return null

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - rangeDays)

    const recentEntries = entries.filter((entry) => new Date(entry.date) >= cutoff)
    if (recentEntries.length === 0) return null

    const avg = {
      speechRate: 0,
      rms: 0,
      pauseRatio: 0,
      spectralCentroid: 0,
      spectralFlux: 0,
      zcr: 0,
    }

    for (const entry of recentEntries) {
      avg.speechRate += entry.features.speechRate
      avg.rms += entry.features.rms
      avg.pauseRatio += entry.features.pauseRatio
      avg.spectralCentroid += entry.features.spectralCentroid
      avg.spectralFlux += entry.features.spectralFlux
      avg.zcr += entry.features.zcr
    }

    const count = recentEntries.length
    avg.speechRate /= count
    avg.rms /= count
    avg.pauseRatio /= count
    avg.spectralCentroid /= count
    avg.spectralFlux /= count
    avg.zcr /= count

    return avg
  }, [recordings, rangeDays, sessions])

  const recentSessions = useMemo(() => {
    return sessions
      .filter((s) => !!s.acousticMetrics)
      .slice(0, 6)
  }, [sessions])

  const wellnessDaily = useMemo(() => {
    const points = currentTrendWindow.map((d) => ({
      date: d.date,
      wellness: Math.max(0, Math.round(100 - (d.stressScore + d.fatigueScore) / 2)),
      stress: d.stressScore,
      fatigue: d.fatigueScore,
      count: d.recordingCount ?? 1,
    }))

    const recent = points.slice(-Math.min(points.length, 8))

    const best = points.length > 0
      ? points.reduce((acc, p) => (p.wellness > acc.wellness ? p : acc), points[0]!)
      : null
    const worst = points.length > 0
      ? points.reduce((acc, p) => (p.wellness < acc.wellness ? p : acc), points[0]!)
      : null

    // Simple volatility (std dev) for the current window.
    const mean = points.length > 0 ? points.reduce((acc, p) => acc + p.wellness, 0) / points.length : 0
    const variance = points.length > 0
      ? points.reduce((acc, p) => acc + Math.pow(p.wellness - mean, 2), 0) / points.length
      : 0
    const volatility = points.length > 0 ? Math.round(Math.sqrt(variance)) : null

    const labelForISO = (iso: string) =>
      new Date(`${iso}T12:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone })

    return {
      recent: recent.map((p) => ({ ...p, label: labelForISO(p.date) })),
      best: best ? { ...best, label: labelForISO(best.date) } : null,
      worst: worst ? { ...worst, label: labelForISO(worst.date) } : null,
      volatility,
    }
  }, [currentTrendWindow, timeZone])

  const scoreTone = (score: number) => {
    if (score >= 75) return "destructive"
    if (score >= 55) return "accent"
    if (score >= 35) return "secondary"
    return "success"
  }

  const deltaBadge = (delta: number | null, mode: "lower-is-better" | "higher-is-better") => {
    if (delta === null || delta === 0) return null
    const improving = mode === "lower-is-better" ? delta < 0 : delta > 0
    const worsening = mode === "lower-is-better" ? delta > 0 : delta < 0
    const variant = improving ? "secondary" : worsening ? "destructive" : "outline"
    const label = `${delta > 0 ? "+" : ""}${delta}`
    return (
      <Badge
        variant={variant}
        className={cn(
          "ml-2 tabular-nums",
          improving && "bg-success/15 text-success border-success/40",
          worsening && "bg-destructive/15 text-destructive border-destructive/40"
        )}
      >
        {label}
      </Badge>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl md:text-3xl font-serif tracking-tight">Trends</h2>
            {summarizeWindow.coverageDays > 0 ? (
              <Badge variant="outline" className="text-xs">
                {summarizeWindow.coverageDays}/{rangeDays} days
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Voice biomarker history, risk forecast, and what to do next.
            {summarizeWindow.lastUpdatedLabel ? (
              <span className="ml-2 text-muted-foreground/70">Updated {summarizeWindow.lastUpdatedLabel}</span>
            ) : null}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <ButtonGroup className="rounded-md">
            <Button
              size="sm"
              variant={rangeDays === 7 ? "default" : "outline"}
              onClick={() => setRangeDays(7)}
            >
              7d
            </Button>
            <Button
              size="sm"
              variant={rangeDays === 14 ? "default" : "outline"}
              onClick={() => setRangeDays(14)}
            >
              14d
            </Button>
            <Button
              size="sm"
              variant={rangeDays === 30 ? "default" : "outline"}
              onClick={() => setRangeDays(30)}
            >
              30d
            </Button>
          </ButtonGroup>

          <Button
            asChild
            size="sm"
            variant="outline"
            className="bg-muted/20 text-foreground border-white/10 hover:bg-muted/30 hover:text-foreground"
          >
            <Link href="/check-ins?newCheckIn=true" className="inline-flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Check in
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_420px] items-start">
        <div className="space-y-4 min-w-0">
          <div
            className={cn(
              "grid gap-4 md:grid-cols-2 items-start",
              // Keep cards equal-height in the collapsed state, but don't force
              // the Burnout card to stretch when Wellness expands.
              !wellnessExpanded && "md:items-stretch"
            )}
          >
            {/* Burnout Forecast */}
            <div data-demo-id="demo-burnout-prediction">
              {burnoutPrediction ? (
                <Deck
                  className={cn(
                    "overflow-hidden p-4 md:p-6",
                    riskLevelConfig[burnoutPrediction.riskLevel].border
                  )}
                >
                  <div
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute inset-0",
                      riskLevelConfig[burnoutPrediction.riskLevel].bg
                    )}
                  />

                  <div className="relative flex items-start gap-4">
                    <div
                      className={cn(
                        "h-11 w-11 rounded-lg flex items-center justify-center",
                        riskLevelConfig[burnoutPrediction.riskLevel].bg
                      )}
                    >
                      {(() => {
                        const Icon = riskLevelConfig[burnoutPrediction.riskLevel].icon
                        return <Icon className={cn("h-5 w-5", riskLevelConfig[burnoutPrediction.riskLevel].color)} />
                      })()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="text-lg md:text-xl font-serif">Burnout forecast</h3>
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-full text-[11px] font-medium uppercase tracking-wider",
                            riskLevelConfig[burnoutPrediction.riskLevel].bg,
                            riskLevelConfig[burnoutPrediction.riskLevel].color
                          )}
                        >
                          {burnoutPrediction.riskLevel}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Score</p>
                          <p className="text-xl font-serif tabular-nums">{burnoutPrediction.riskScore}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Window</p>
                          <p className="text-xl font-serif tabular-nums">{burnoutPrediction.predictedDays}d</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Trend</p>
                          <p className="text-xl font-serif capitalize">{burnoutPrediction.trend}</p>
                        </div>
                      </div>

                      {burnoutPrediction.factors.length > 0 ? (
                        <div className="mt-4">
                          <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">Signals</p>
                          <ul className="space-y-1.5">
                            {burnoutPrediction.factors.slice(0, 4).map((factor, index) => (
                              <li key={index} className="flex items-start gap-2 text-sm">
                                <span className="text-muted-foreground">•</span>
                                <span className="min-w-0">{factor}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      <div className="mt-4 text-xs text-muted-foreground">
                        Confidence: {Math.round(burnoutPrediction.confidence * 100)}%
                        <span className="text-muted-foreground/70"> (uses last 7 days)</span>
                      </div>
                    </div>
                  </div>
                </Deck>
              ) : (
                <Deck tone="quiet" className="p-4 md:p-6">
                  <h3 className="text-lg font-serif">Burnout forecast</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Need at least 2 days of check-ins to predict risk.
                  </p>
                </Deck>
              )}
            </div>

            {/* Wellness */}
            <Deck
              className={cn(
                "p-4 md:p-6 transition-colors duration-300",
                summarizeWindow.coverageDays > 0 && "border-border/70"
              )}
              onClick={() => summarizeWindow.coverageDays > 0 && setWellnessExpanded(!wellnessExpanded)}
              role={summarizeWindow.coverageDays > 0 ? "button" : undefined}
              tabIndex={summarizeWindow.coverageDays > 0 ? 0 : undefined}
            >
              {summarizeWindow.coverageDays === 0 ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium">Wellness</h3>
                      <p className="text-xs text-muted-foreground mt-1">No data yet</p>
                    </div>
                  </div>
                  <div className="mt-3 text-sm text-muted-foreground">
                    Start a check-in to calculate your wellness score and unlock trend insights.
                  </div>
                  <div className="mt-4">
                    <Button asChild size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
                      <Link href="/check-ins?newCheckIn=true">Check in now</Link>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium">Wellness</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Higher is better · last {rangeDays} days
                      </p>
                    </div>
                    {deltaBadge(summarizeWindow.deltaWellness, "higher-is-better")}
                  </div>

                  <div className="mt-3 flex items-end justify-between gap-4">
                    <div className="min-w-[92px]">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-serif tabular-nums" style={{ color: wellnessColor }}>
                          {wellnessScore}
                        </span>
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {wellnessScore > 70 ? "Healthy range" : wellnessScore > 40 ? "Monitor closely" : "Take action"}
                      </p>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="h-2.5 rounded-full bg-muted/30 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-[width] duration-300"
                          style={{ width: `${wellnessScore}%`, backgroundColor: wellnessColor }}
                        />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                          <p className="text-muted-foreground">Avg stress</p>
                          <p className="mt-0.5 font-semibold tabular-nums">
                            {summarizeWindow.currentAvgStress ?? 0}%{deltaBadge(summarizeWindow.deltaStress, "lower-is-better")}
                          </p>
                        </div>
                        <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                          <p className="text-muted-foreground">Avg fatigue</p>
                          <p className="mt-0.5 font-semibold tabular-nums">
                            {summarizeWindow.currentAvgFatigue ?? 0}%{deltaBadge(summarizeWindow.deltaFatigue, "lower-is-better")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-center gap-1 text-xs text-muted-foreground/70">
                    <span>Tap for details</span>
                    <ChevronDown className={cn("h-3 w-3 transition-transform duration-300", wellnessExpanded && "rotate-180")} />
                  </div>

                  <AnimatePresence>
                    {wellnessExpanded ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="pt-4 mt-4 border-t border-border/50 space-y-4">
                          <div className="grid gap-4 md:grid-cols-2 items-start">
                            <div className="rounded-xl border border-border/60 bg-muted/15 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium">Daily wellness (recent)</p>
                                {wellnessDaily.volatility !== null ? (
                                  <Badge variant="outline" className="tabular-nums">
                                    ±{wellnessDaily.volatility}
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Each day’s score after combining stress + fatigue.
                              </p>

                              <div className="mt-4 space-y-2">
                                {wellnessDaily.recent.map((p) => (
                                  <div key={p.date} className="grid grid-cols-[56px_1fr_40px] items-center gap-3">
                                    <div className="text-xs text-muted-foreground tabular-nums">{p.label}</div>
                                    <div className="h-2.5 rounded-full bg-muted/30 overflow-hidden">
                                      <div
                                        className="h-full rounded-full transition-[width] duration-300"
                                        style={{ width: `${p.wellness}%`, backgroundColor: wellnessColor }}
                                      />
                                    </div>
                                    <div className="text-xs text-muted-foreground tabular-nums text-right">{p.wellness}</div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-xl border border-border/60 bg-muted/15 p-4 space-y-3">
                              <div>
                                <p className="text-sm font-medium">Highlights</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Best / worst days in the selected window.
                                </p>
                              </div>

                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
                                  <p className="text-muted-foreground">Best day</p>
                                  <p className="mt-1 font-semibold tabular-nums">
                                    {wellnessDaily.best ? `${wellnessDaily.best.label} · ${wellnessDaily.best.wellness}` : "—"}
                                  </p>
                                  {wellnessDaily.best ? (
                                    <p className="mt-1 text-muted-foreground tabular-nums">
                                      S {wellnessDaily.best.stress} · F {wellnessDaily.best.fatigue}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
                                  <p className="text-muted-foreground">Worst day</p>
                                  <p className="mt-1 font-semibold tabular-nums">
                                    {wellnessDaily.worst ? `${wellnessDaily.worst.label} · ${wellnessDaily.worst.wellness}` : "—"}
                                  </p>
                                  {wellnessDaily.worst ? (
                                    <p className="mt-1 text-muted-foreground tabular-nums">
                                      S {wellnessDaily.worst.stress} · F {wellnessDaily.worst.fatigue}
                                    </p>
                                  ) : null}
                                </div>
                              </div>

                              <div className="pt-3 border-t border-border/50">
                                <p className="text-xs text-muted-foreground">
                                  Wellness formula: 100 - (Stress + Fatigue) / 2.
                                  {summarizeWindow.deltaWellness !== null ? (
                                    <span className="ml-1">
                                      Change vs previous {rangeDays} days:{deltaBadge(summarizeWindow.deltaWellness, "higher-is-better")}
                                    </span>
                                  ) : (
                                    <span className="ml-1">Need a previous window to compare.</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </>
              )}
            </Deck>
          </div>

          {/* Trend charts */}
          <div data-demo-id="demo-trend-charts" className="grid gap-4 items-start">
            <Deck
              className={cn(
                "group p-4 md:p-6 transition-colors duration-300",
                summarizeWindow.coverageDays > 0 && "hover:border-accent/50 cursor-pointer"
              )}
              onClick={() => summarizeWindow.coverageDays > 0 && setStressChartExpanded(!stressChartExpanded)}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium">Stress & fatigue</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Last {rangeDays} days</p>
                </div>
                <div className="flex items-center gap-2">
                  {summarizeWindow.checkInCount > 0 ? (
                    <Badge variant="outline" className="tabular-nums">
                      {summarizeWindow.checkInCount} check-ins
                    </Badge>
                  ) : null}
                </div>
              </div>

              <StressFatigueChart
                data={summarizeWindow.coverageDays > 0 ? chartData : []}
                height={280}
                showLegend
                showTrendIndicator
                expanded={stressChartExpanded}
                onExpandChange={setStressChartExpanded}
                aggregatedFeatures={aggregatedFeatures}
              />
            </Deck>

            <div className="grid gap-4 md:grid-cols-2">
              <Deck className="p-4">
                <p className="text-xs text-muted-foreground">Avg stress</p>
                <p className="mt-1 text-2xl font-serif tabular-nums">
                  {summarizeWindow.currentAvgStress ?? "—"}
                  <span className="text-sm text-muted-foreground">%</span>
                  {deltaBadge(summarizeWindow.deltaStress, "lower-is-better")}
                </p>
                <p className="mt-2 text-xs text-muted-foreground/80">
                  {summarizeWindow.currentAvgStress === null ? "No data yet" : "Lower is better"}
                </p>
              </Deck>

              <Deck className="p-4">
                <p className="text-xs text-muted-foreground">Avg fatigue</p>
                <p className="mt-1 text-2xl font-serif tabular-nums">
                  {summarizeWindow.currentAvgFatigue ?? "—"}
                  <span className="text-sm text-muted-foreground">%</span>
                  {deltaBadge(summarizeWindow.deltaFatigue, "lower-is-better")}
                </p>
                <p className="mt-2 text-xs text-muted-foreground/80">
                  {summarizeWindow.currentAvgFatigue === null ? "No data yet" : "Lower is better"}
                </p>
              </Deck>
            </div>
          </div>
        </div>

        <div className="space-y-4 min-w-0">
          <InsightsPanel session={latestSynthesisSession} />

          <Deck className="p-4 md:p-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="min-w-0">
                <h3 className="text-sm font-medium">Recent check-ins</h3>
                <p className="text-xs text-muted-foreground mt-1">Quick view of the latest sessions</p>
              </div>
              <Badge variant="outline" className="tabular-nums">
                {recentSessions.length}
              </Badge>
            </div>

            {recentSessions.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No check-ins yet. Start one to build your trend history.
              </div>
            ) : (
              <div className="space-y-2">
                {recentSessions.map((s) => {
                  const started = new Date(s.startedAt)
                  const label = started.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone })
                  const stress = s.acousticMetrics!.stressScore
                  const fatigue = s.acousticMetrics!.fatigueScore

                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{label}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {started.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone })}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant="outline"
                          className={cn(
                            "tabular-nums",
                            scoreTone(stress) === "destructive" && "bg-destructive/10 border-destructive/40 text-destructive",
                            scoreTone(stress) === "accent" && "bg-accent/10 border-accent/40 text-accent",
                            scoreTone(stress) === "secondary" && "bg-muted/30 border-border/60 text-foreground/90",
                            scoreTone(stress) === "success" && "bg-success/10 border-success/40 text-success"
                          )}
                        >
                          S {stress}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            "tabular-nums",
                            scoreTone(fatigue) === "destructive" && "bg-destructive/10 border-destructive/40 text-destructive",
                            scoreTone(fatigue) === "accent" && "bg-accent/10 border-accent/40 text-accent",
                            scoreTone(fatigue) === "secondary" && "bg-muted/30 border-border/60 text-foreground/90",
                            scoreTone(fatigue) === "success" && "bg-success/10 border-success/40 text-success"
                          )}
                        >
                          F {fatigue}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                Tip: tap the chart to see biomarker details.
              </span>
              <Button asChild size="sm" variant="outline">
                <Link href="/check-ins">All check-ins</Link>
              </Button>
            </div>
          </Deck>
        </div>
      </div>
    </div>
  )
}
