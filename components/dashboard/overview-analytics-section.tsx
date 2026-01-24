"use client"

import { useMemo, useState } from "react"
import { TrendingUp, AlertTriangle, TrendingDown, Minus, ChevronDown } from "@/lib/icons"
import { AnimatePresence, motion } from "framer-motion"
import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from "recharts"
import { cn } from "@/lib/utils"
import { useDashboardStats } from "@/hooks/use-storage"
import { useSceneMode } from "@/lib/scene-context"
import { useTimeZone } from "@/lib/timezone-context"
import { Deck } from "@/components/dashboard/deck"
import { StressFatigueChart } from "@/components/dashboard/stress-fatigue-chart"
import { EngagementTracker } from "@/components/dashboard/engagement-tracker"
import { InsightsPanel } from "@/components/dashboard/insights-panel"
import { AnalyticsInsightsSection } from "@/components/dashboard/analytics-insights"
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
  const dashboardStats = useDashboardStats()
  const [wellnessExpanded, setWellnessExpanded] = useState(false)
  const [stressChartExpanded, setStressChartExpanded] = useState(false)

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

  const trendData = useMemo(() => {
    if (storedTrendData.length === 0) {
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      return days.map((day) => ({ day, stress: 0, fatigue: 0 }))
    }

    return storedTrendData.map((data) => {
      const date = new Date(data.date)
      const day = date.toLocaleDateString("en-US", { weekday: "short", timeZone })
      return {
        day,
        stress: data.stressScore,
        fatigue: data.fatigueScore,
      }
    })
  }, [storedTrendData, timeZone])

  const wellnessScore = useMemo(() => {
    if (dashboardStats.totalRecordings === 0) return 0
    const avgNegative = (dashboardStats.averageStress + dashboardStats.averageFatigue) / 2
    return Math.max(0, Math.round(100 - avgNegative))
  }, [dashboardStats])

  const wellnessColor = useMemo(() => {
    if (wellnessScore <= 40) return "#ef4444"
    if (wellnessScore <= 70) return accentColor
    return "#22c55e"
  }, [wellnessScore, accentColor])

  const wellnessData = useMemo(
    () => [{ name: "wellness", value: wellnessScore, fill: wellnessColor }],
    [wellnessScore, wellnessColor]
  )

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

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const recentEntries = entries.filter((entry) => new Date(entry.date) >= sevenDaysAgo)
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
  }, [recordings, sessions])

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px] items-start">
        <div className="space-y-4 min-w-0">
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

          {/* Trend charts */}
          <div data-demo-id="demo-trend-charts" className="grid md:grid-cols-2 gap-4 items-start">
            <Deck
              className={cn(
                "group p-4 md:p-6 transition-colors duration-300",
                dashboardStats.totalRecordings > 0 && "hover:border-accent/50 cursor-pointer"
              )}
              onClick={() => dashboardStats.totalRecordings > 0 && setStressChartExpanded(!stressChartExpanded)}
            >
              <h3 className="text-sm font-medium mb-2">Stress & fatigue (7 days)</h3>
              <StressFatigueChart
                data={dashboardStats.totalRecordings > 0 ? trendData : []}
                height={280}
                showLegend
                showTrendIndicator
                expanded={stressChartExpanded}
                onExpandChange={setStressChartExpanded}
                aggregatedFeatures={aggregatedFeatures}
              />
            </Deck>

            <Deck
              className={cn(
                "group p-4 md:p-6 transition-colors duration-300",
                dashboardStats.totalRecordings > 0 && "hover:border-accent/50 cursor-pointer"
              )}
              onClick={() => dashboardStats.totalRecordings > 0 && setWellnessExpanded(!wellnessExpanded)}
            >
              <h3 className="text-sm font-medium mb-3">Wellness score</h3>
              {dashboardStats.totalRecordings === 0 ? (
                <div className="h-[280px] flex items-center justify-center">
                  <div className="text-center">
                    <TrendingUp className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-muted-foreground">No data yet</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">Check in to calculate your score</p>
                  </div>
                </div>
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      data={wellnessData}
                      innerRadius="70%"
                      outerRadius="100%"
                      startAngle={90}
                      endAngle={-270}
                    >
                      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                      <RadialBar
                        dataKey="value"
                        cornerRadius={10}
                        fill={wellnessColor}
                        background={{ fill: "hsl(var(--muted))" }}
                      />
                      <text
                        x="50%"
                        y="50%"
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={30}
                        fontFamily="serif"
                        fontWeight="600"
                        fill={wellnessColor}
                      >
                        {wellnessScore}%
                      </text>
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <p className="text-center text-xs text-muted-foreground mt-3">
                {dashboardStats.totalRecordings === 0
                  ? "Start a check-in to see your wellness score"
                  : wellnessScore > 70
                    ? "Healthy range"
                    : wellnessScore > 40
                      ? "Monitor closely"
                      : "Take action"}
              </p>

              {dashboardStats.totalRecordings > 0 ? (
                <>
                  <div className="flex items-center justify-center gap-1 mt-2 text-xs text-muted-foreground/70">
                    <span>Tap for details</span>
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 transition-transform duration-300",
                        wellnessExpanded && "rotate-180"
                      )}
                    />
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
                        <div className="pt-4 mt-4 border-t border-border/50 space-y-3 text-sm">
                          <div>
                            <p className="font-medium text-foreground mb-1">How it's calculated</p>
                            <p className="text-muted-foreground text-xs">Wellness = 100 - (Stress + Fatigue) / 2</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                              <p className="text-muted-foreground mb-1">Avg stress</p>
                              <p className="font-semibold text-base">{dashboardStats.averageStress}%</p>
                            </div>
                            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                              <p className="text-muted-foreground mb-1">Avg fatigue</p>
                              <p className="font-semibold text-base">{dashboardStats.averageFatigue}%</p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </>
              ) : null}
            </Deck>
          </div>
        </div>

        <div className="space-y-4 min-w-0">
          <InsightsPanel session={latestSynthesisSession} />
          <AnalyticsInsightsSection />
        </div>
      </div>

      <EngagementTracker />
    </div>
  )
}
