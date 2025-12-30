"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { TrendingUp, AlertTriangle, TrendingDown, Minus, ChevronDown } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts"
import { useDashboardAnimation } from "../layout"
import { cn } from "@/lib/utils"
import { predictBurnoutRisk } from "@/lib/ml/forecasting"
import { useDashboardStats, useTrendData, useScheduledSuggestions, useRecordings } from "@/hooks/use-storage"
import { StressFatigueChart } from "@/components/dashboard/stress-fatigue-chart"
import { JourneyProgress } from "@/components/dashboard/journey-progress"
import { useSceneMode } from "@/lib/scene-context"
import { DecorativeGrid } from "@/components/ui/decorative-grid"
import type { BurnoutPrediction } from "@/lib/types"

export default function AnalyticsPage() {
  const { accentColor } = useSceneMode()
  const { shouldAnimate } = useDashboardAnimation()
  const [visible, setVisible] = useState(!shouldAnimate)
  const [wellnessExpanded, setWellnessExpanded] = useState(false)
  const [stressChartExpanded, setStressChartExpanded] = useState(false)
  const chartsRef = useRef<HTMLDivElement>(null)
  const [chartsVisible, setChartsVisible] = useState(false)

  // Trigger entry animation
  useEffect(() => {
    if (shouldAnimate) {
      const timer = setTimeout(() => setVisible(true), 100)
      return () => clearTimeout(timer)
    }
  }, [shouldAnimate])

  // Scroll reveal for charts section
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setChartsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    )

    if (chartsRef.current) observer.observe(chartsRef.current)
    return () => observer.disconnect()
  }, [])

  // Real data from IndexedDB
  const dashboardStats = useDashboardStats()
  const storedTrendData = useTrendData(7)
  const scheduledSuggestions = useScheduledSuggestions()
  const allRecordings = useRecordings()

  const stats = {
    totalRecordings: dashboardStats.totalRecordings,
    currentStreak: dashboardStats.currentStreak,
    avgStress: dashboardStats.averageStress,
    avgFatigue: dashboardStats.averageFatigue,
    suggestionsAccepted: dashboardStats.suggestionsAccepted,
  }

  // Calculate burnout prediction from historical data
  const burnoutPrediction: BurnoutPrediction | null = useMemo(() => {
    if (storedTrendData.length < 2) return null
    return predictBurnoutRisk(storedTrendData)
  }, [storedTrendData])

  // Risk level styling
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
  }

  // Transform stored trend data for chart display
  const trendData = useMemo(() => {
    if (storedTrendData.length === 0) {
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      return days.map((day) => ({ day, stress: 0, fatigue: 0 }))
    }

    return storedTrendData.map((data) => {
      const date = new Date(data.date)
      const day = date.toLocaleDateString("en-US", { weekday: "short" })
      return {
        day,
        stress: data.stressScore,
        fatigue: data.fatigueScore,
      }
    })
  }, [storedTrendData])

  // Wellness score calculated from average stress and fatigue (inverse)
  const wellnessScore = useMemo(() => {
    if (dashboardStats.totalRecordings === 0) return 0
    const avgNegative = (dashboardStats.averageStress + dashboardStats.averageFatigue) / 2
    return Math.max(0, Math.round(100 - avgNegative))
  }, [dashboardStats])

  // Determine wellness color based on score thresholds
  const wellnessColor = useMemo(() => {
    if (wellnessScore <= 40) return "#ef4444"
    if (wellnessScore <= 70) return accentColor
    return "#22c55e"
  }, [wellnessScore, accentColor])

  const wellnessData = useMemo(
    () => [{ name: "wellness", value: wellnessScore, fill: wellnessColor }],
    [wellnessScore, wellnessColor]
  )

  // Aggregate AudioFeatures from last 7 days for biomarker analysis
  const aggregatedFeatures = useMemo(() => {
    if (!allRecordings || allRecordings.length === 0) return null

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const recentRecordings = allRecordings.filter(r => {
      const recordingDate = new Date(r.createdAt)
      return recordingDate >= sevenDaysAgo && r.features
    })

    if (recentRecordings.length === 0) return null

    const avg = {
      speechRate: 0,
      rms: 0,
      pauseRatio: 0,
      spectralCentroid: 0,
      spectralFlux: 0,
      zcr: 0,
    }

    recentRecordings.forEach(r => {
      avg.speechRate += r.features!.speechRate
      avg.rms += r.features!.rms
      avg.pauseRatio += r.features!.pauseRatio
      avg.spectralCentroid += r.features!.spectralCentroid
      avg.spectralFlux += r.features!.spectralFlux
      avg.zcr += r.features!.zcr
    })

    const count = recentRecordings.length
    Object.keys(avg).forEach(key => {
      avg[key as keyof typeof avg] /= count
    })

    return avg
  }, [allRecordings])

  return (
    <div className="min-h-screen bg-transparent relative overflow-hidden">
      <main className="px-4 md:px-8 lg:px-16 xl:px-20 pt-28 pb-12 relative z-10">
        {/* Header */}
        <div className="relative mb-12 overflow-hidden rounded-lg p-6">
          <DecorativeGrid />
          <div
            className={cn(
              "relative transition-all duration-1000 delay-100",
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
            )}
          >
            <h1 className="text-3xl md:text-4xl font-serif leading-[0.95] mb-3">
              Wellness <span className="text-accent">insights</span>
            </h1>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-xl">
              Detailed analysis of your stress, fatigue trends, and burnout risk over time.
            </p>
          </div>
        </div>

        {/* Journey Progress */}
        <div
          className={cn(
            "mb-16 transition-all duration-1000 delay-200",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          <JourneyProgress
            hasRecordings={stats.totalRecordings > 0}
            hasAnalysis={dashboardStats.averageStress > 0 || dashboardStats.averageFatigue > 0}
            hasSuggestions={stats.suggestionsAccepted > 0}
            hasScheduledRecovery={scheduledSuggestions.length > 0}
          />
        </div>

        {/* Burnout Prediction */}
        {burnoutPrediction && (
          <div
            className={cn(
              "relative mb-16 transition-all duration-1000 delay-300",
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
            )}
          >
            <div
              className={cn(
                "rounded-lg border p-4 md:p-8 lg:p-12 backdrop-blur-xl",
                riskLevelConfig[burnoutPrediction.riskLevel].bg,
                riskLevelConfig[burnoutPrediction.riskLevel].border
              )}
            >
              <div className="flex items-start gap-6">
                <div
                  className={cn(
                    "h-14 w-14 rounded-lg flex items-center justify-center",
                    riskLevelConfig[burnoutPrediction.riskLevel].bg
                  )}
                >
                  {(() => {
                    const Icon = riskLevelConfig[burnoutPrediction.riskLevel].icon
                    return <Icon className={cn("h-7 w-7", riskLevelConfig[burnoutPrediction.riskLevel].color)} />
                  })()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl font-serif">Burnout Risk Forecast</h3>
                    <span
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider",
                        riskLevelConfig[burnoutPrediction.riskLevel].bg,
                        riskLevelConfig[burnoutPrediction.riskLevel].color
                      )}
                    >
                      {burnoutPrediction.riskLevel}
                    </span>
                  </div>
                  <p className="text-muted-foreground mb-6">
                    {burnoutPrediction.riskLevel === "low" && "Your wellness patterns look stable. Keep up the good work!"}
                    {burnoutPrediction.riskLevel === "moderate" && "Your stress levels are elevated. Consider taking some recovery time soon."}
                    {burnoutPrediction.riskLevel === "high" && "Your patterns indicate increasing risk. Prioritize rest and recovery."}
                    {burnoutPrediction.riskLevel === "critical" && "Urgent attention needed. Please schedule recovery time immediately."}
                  </p>

                  <div className="grid md:grid-cols-3 gap-6 mb-6">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Risk Score</p>
                      <p className="text-3xl font-serif tabular-nums">{burnoutPrediction.riskScore}/100</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Forecast Window</p>
                      <p className="text-3xl font-serif tabular-nums">{burnoutPrediction.predictedDays} days</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Trend</p>
                      <p className="text-3xl font-serif capitalize">{burnoutPrediction.trend}</p>
                    </div>
                  </div>

                  {burnoutPrediction.factors.length > 0 && (
                    <div className="mb-6">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Contributing Factors</p>
                      <ul className="space-y-2">
                        {burnoutPrediction.factors.map((factor, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <span className="text-muted-foreground">•</span>
                            <span>{factor}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Confidence: {Math.round(burnoutPrediction.confidence * 100)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Charts Section */}
        <div ref={chartsRef} className="relative">
          <div className="pointer-events-none absolute top-0 right-0 h-96 w-96 rounded-full bg-success/5 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-80 w-80 rounded-full bg-accent/5 blur-3xl" />

          <div className="relative">
            <div
              className={cn(
                "mb-8 transition-all duration-1000 delay-300",
                chartsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
              )}
            >
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Trends</p>
              <h2 className="text-3xl md:text-4xl font-serif">Wellness Metrics</h2>
            </div>

            {/* Charts Grid */}
            <div className="grid md:grid-cols-2 gap-8 items-start">
              {/* Chart 1: 7-Day Trend */}
              <div
                className={cn(
                  "group relative rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl p-4 md:p-8 transition-all duration-500 hover:border-accent/50 hover:bg-card/40 cursor-pointer",
                  chartsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
                )}
                style={{ transitionDelay: chartsVisible ? "400ms" : "0ms" }}
                onClick={() => stats.totalRecordings > 0 && setStressChartExpanded(!stressChartExpanded)}
              >
                <h3 className="text-lg font-semibold mb-2">Stress & Fatigue (7 days)</h3>
                <StressFatigueChart
                  data={stats.totalRecordings > 0 ? trendData : []}
                  height={350}
                  showLegend={true}
                  showTrendIndicator={true}
                  expanded={stressChartExpanded}
                  onExpandChange={setStressChartExpanded}
                  aggregatedFeatures={aggregatedFeatures}
                />
              </div>

              {/* Chart 2: Wellness Score Gauge */}
              <div
                className={cn(
                  "group relative rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl p-4 md:p-8 transition-all duration-500 hover:border-accent/50 hover:bg-card/40 cursor-pointer",
                  chartsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
                )}
                style={{ transitionDelay: chartsVisible ? "500ms" : "0ms" }}
                onClick={() => stats.totalRecordings > 0 && setWellnessExpanded(!wellnessExpanded)}
              >
                <h3 className="text-lg font-semibold mb-4">Wellness Score</h3>
                {stats.totalRecordings === 0 ? (
                  <div className="h-[350px] flex items-center justify-center">
                    <div className="text-center">
                      <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                      <p className="text-muted-foreground">No data yet</p>
                      <p className="text-sm text-muted-foreground/70 mt-1">Record to calculate your score</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadialBarChart
                        data={wellnessData}
                        innerRadius="70%"
                        outerRadius="100%"
                        startAngle={90}
                        endAngle={-270}
                      >
                        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                        <RadialBar dataKey="value" cornerRadius={10} fill={wellnessColor} background={{ fill: "hsl(var(--muted))" }} />
                        <text
                          x="50%"
                          y="50%"
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={32}
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
                <p className="text-center text-xs text-muted-foreground mt-4">
                  {stats.totalRecordings === 0
                    ? "Start recording to see your wellness score"
                    : wellnessScore > 70
                    ? "You're doing great!"
                    : wellnessScore > 40
                    ? "Room for improvement"
                    : "Consider taking a break"}
                </p>
                {stats.totalRecordings > 0 && (
                  <>
                    <div className="flex items-center justify-center gap-1 mt-2 text-xs text-muted-foreground/70">
                      <span>Tap for details</span>
                      <ChevronDown className={cn("h-3 w-3 transition-transform duration-300", wellnessExpanded && "rotate-180")} />
                    </div>
                    <AnimatePresence>
                      {wellnessExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <div className="pt-4 mt-4 border-t border-border/50 space-y-4 text-sm">
                            <div>
                              <p className="font-medium text-foreground mb-1">How it's calculated</p>
                              <p className="text-muted-foreground text-xs">
                                Wellness = 100 - (Stress + Fatigue) / 2
                              </p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                                <p className="text-muted-foreground mb-1">Avg Stress</p>
                                <p className="font-semibold text-base">{stats.avgStress}%</p>
                              </div>
                              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                                <p className="text-muted-foreground mb-1">Avg Fatigue</p>
                                <p className="font-semibold text-base">{stats.avgFatigue}%</p>
                              </div>
                            </div>
                            <div>
                              <p className="font-medium text-foreground mb-2">Score meaning</p>
                              <ul className="text-muted-foreground text-xs space-y-1.5">
                                <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-green-500" /> 71-100: Healthy range</li>
                                <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-accent" /> 41-70: Monitor closely</li>
                                <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-500" /> 0-40: Take action</li>
                              </ul>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
