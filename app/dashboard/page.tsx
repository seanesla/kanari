"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { Link } from "next-view-transitions"
import { Mic, TrendingUp, Calendar as CalendarIcon, Lightbulb, AlertTriangle, TrendingDown, Minus, ChevronDown, ArrowRight } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts"
import { useSceneMode } from "@/lib/scene-context"
import { predictBurnoutRisk, recordingsToTrendData } from "@/lib/ml/forecasting"
import { cn } from "@/lib/utils"
import { DecorativeGrid } from "@/components/ui/decorative-grid"
import { Button } from "@/components/ui/button"
import { StressFatigueChart } from "@/components/dashboard/stress-fatigue-chart"
import { useDashboardStats, useTrendData, useScheduledSuggestions, useRecordings } from "@/hooks/use-storage"
import { WeekCalendar } from "@/components/dashboard/calendar"
import { SuggestionDetailDialog } from "@/components/dashboard/suggestions"
import { JourneyProgress } from "@/components/dashboard/journey-progress"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import type { BurnoutPrediction, Suggestion } from "@/lib/types"

export default function DashboardPage() {
  const { setMode, accentColor } = useSceneMode()
  const [visible, setVisible] = useState(false)
  const [chartsVisible, setChartsVisible] = useState(false)
  const [calendarVisible, setCalendarVisible] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null)
  const [isCalendarSheetOpen, setIsCalendarSheetOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [wellnessExpanded, setWellnessExpanded] = useState(false)
  const [stressChartExpanded, setStressChartExpanded] = useState(false)
  const chartsRef = useRef<HTMLDivElement>(null)
  const calendarRef = useRef<HTMLDivElement>(null)

  // Set scene to dashboard mode
  useEffect(() => {
    setMode("dashboard")
  }, [setMode])

  // Trigger entry animation
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

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

  // Scroll reveal for calendar section
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setCalendarVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    )

    if (calendarRef.current) observer.observe(calendarRef.current)
    return () => observer.disconnect()
  }, [])

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
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

  // Helper function to get threshold label and color for stress/fatigue scores
  const getScoreThreshold = (score: number) => {
    if (score === 0) return { label: "N/A", color: "text-muted-foreground", bgColor: "bg-muted/20" }
    if (score <= 30) return { label: "Low", color: "text-success", bgColor: "bg-success/10" }
    if (score <= 60) return { label: "Moderate", color: "text-accent", bgColor: "bg-accent/10" }
    if (score <= 80) return { label: "Elevated", color: "text-orange-500", bgColor: "bg-orange-500/10" }
    return { label: "High", color: "text-destructive", bgColor: "bg-destructive/10" }
  }

  const stressThreshold = getScoreThreshold(stats.avgStress)
  const fatigueThreshold = getScoreThreshold(stats.avgFatigue)

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
      // Show empty days if no data
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      return days.map((day) => ({ day, stress: 0, fatigue: 0 }))
    }

    // Convert stored data to chart format
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
    // Wellness = 100 - average of stress and fatigue
    const avgNegative = (dashboardStats.averageStress + dashboardStats.averageFatigue) / 2
    return Math.max(0, Math.round(100 - avgNegative))
  }, [dashboardStats])

  // Determine wellness color based on score thresholds
  const wellnessColor = useMemo(() => {
    if (wellnessScore <= 40) return "#ef4444" // Red/destructive for low wellness
    if (wellnessScore <= 70) return accentColor // Accent color for medium wellness
    return "#22c55e" // Green/success for high wellness
  }, [wellnessScore, accentColor])

  const wellnessData = useMemo(
    () => [{ name: "wellness", value: wellnessScore, fill: wellnessColor }],
    [wellnessScore, wellnessColor]
  )

  // Aggregate AudioFeatures from last 7 days for biomarker analysis
  const aggregatedFeatures = useMemo(() => {
    if (!allRecordings || allRecordings.length === 0) return null

    // Get last 7 days recordings with features
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const recentRecordings = allRecordings.filter(r => {
      const recordingDate = new Date(r.createdAt)
      return recordingDate >= sevenDaysAgo && r.features
    })

    if (recentRecordings.length === 0) return null

    // Average key features
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
      <main className="px-8 md:px-16 lg:px-20 pt-28 pb-12 relative z-10">
        {/* HERO SECTION */}
        <div className="relative mb-24 md:mb-28">
          {/* Grid background */}
          <DecorativeGrid />

          {/* Decorative blur accents */}
          <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-accent/5 blur-3xl" />

          {/* Content */}
          <div
            className={cn(
              "relative transition-all duration-1000 delay-100",
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
            )}
          >
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-6">Overview</p>
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-serif leading-[0.95] mb-6">
              Your <span className="text-accent">wellness</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mb-8">
              Track your vocal biomarkers, monitor stress and fatigue trends, and receive personalized recovery suggestions.
            </p>
            <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link href="/dashboard/recordings">
                Go to Recordings
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* JOURNEY PROGRESS */}
        <div
          className={cn(
            "mb-16 md:mb-20 transition-all duration-1000 delay-200",
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

        {/* QUICK STATS BAR */}
        <div
          className={cn(
            "grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-16 md:mb-20 transition-all duration-1000 delay-200",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          <div className="text-center p-4 md:p-5 rounded-lg border border-border/70 bg-card/20 backdrop-blur-xl">
            <Mic className="h-5 w-5 mx-auto mb-2 text-accent" />
            <p className="text-3xl md:text-4xl font-serif tabular-nums">{stats.totalRecordings}</p>
            <p className="text-xs text-muted-foreground mt-2">Recordings</p>
          </div>
          <div className="text-center p-4 md:p-5 rounded-lg border border-border/70 bg-card/20 backdrop-blur-xl">
            <TrendingUp className="h-5 w-5 mx-auto mb-2 text-success" />
            <p className="text-3xl md:text-4xl font-serif tabular-nums">{stats.currentStreak}</p>
            <p className="text-xs text-muted-foreground mt-2">Day streak</p>
          </div>
          <div className="text-center p-4 md:p-5 rounded-lg border border-border/70 bg-card/20 backdrop-blur-xl">
            <CalendarIcon className="h-5 w-5 mx-auto mb-2 text-accent" />
            <div className="flex items-center justify-center gap-2 mb-1">
              <p className="text-3xl md:text-4xl font-serif tabular-nums">{stats.avgStress}</p>
              {stats.avgStress > 0 && (
                <span
                  className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full",
                    stressThreshold.color,
                    stressThreshold.bgColor
                  )}
                >
                  {stressThreshold.label}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Avg stress</p>
          </div>
          <div className="text-center p-4 md:p-5 rounded-lg border border-border/70 bg-card/20 backdrop-blur-xl">
            <Lightbulb className="h-5 w-5 mx-auto mb-2 text-success" />
            <p className="text-3xl md:text-4xl font-serif tabular-nums">{stats.suggestionsAccepted}</p>
            <p className="text-xs text-muted-foreground mt-2">Suggestions taken</p>
          </div>
        </div>

        {/* BURNOUT PREDICTION */}
        {burnoutPrediction && (
          <div
            className={cn(
              "relative mb-16 transition-all duration-1000 delay-300",
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
            )}
          >
            <div
              className={cn(
                "rounded-lg border p-8 md:p-12 backdrop-blur-xl",
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

              {burnoutPrediction.riskLevel !== "low" && (
                <div className="mt-8 pt-8 border-t border-border/50">
                  <div className="flex flex-wrap gap-4">
                    <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
                      <Link href="/dashboard/suggestions">
                        <Lightbulb className="mr-2 h-4 w-4" />
                        View Suggestions
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/dashboard/recordings?newRecording=true">
                        <Mic className="mr-2 h-4 w-4" />
                        Record Check-in
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CHARTS SECTION */}
        <div ref={chartsRef} className="relative mb-20 md:mb-24">
          {/* Decorative blur accents */}
          <div className="pointer-events-none absolute top-0 right-0 h-96 w-96 rounded-full bg-success/5 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-80 w-80 rounded-full bg-accent/5 blur-3xl" />

          <div className="relative">
            {/* Section heading */}
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
                  "group relative rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl p-8 transition-all duration-500 hover:border-accent/50 hover:bg-card/40 cursor-pointer",
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
                  "group relative rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl p-8 transition-all duration-500 hover:border-accent/50 hover:bg-card/40 cursor-pointer",
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
                                Wellness = 100 − (Stress + Fatigue) ÷ 2
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
                                <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" /> 41-70: Monitor closely</li>
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

        {/* CALENDAR SECTION */}
        <div ref={calendarRef} className="relative mb-20 md:mb-24">
          {/* Decorative blur accents */}
          <div className="pointer-events-none absolute top-0 left-0 h-80 w-80 rounded-full bg-accent/5 blur-3xl" />

          <div className="relative">
            {/* Section heading */}
            <div
              className={cn(
                "mb-8 transition-all duration-1000 delay-300",
                calendarVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
              )}
            >
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Schedule</p>
              <h2 className="text-3xl md:text-4xl font-serif">Your Recovery</h2>
            </div>

            {/* Calendar */}
            <div
              className={cn(
                "transition-all duration-500",
                calendarVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
              )}
              style={{ transitionDelay: calendarVisible ? "400ms" : "0ms" }}
            >
              {isMobile ? (
                <>
                  {/* Mobile: Show compact message with button to open sheet */}
                  <div className="rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl p-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Scheduled Recovery</h3>
                        <p className="text-sm text-muted-foreground">
                          {scheduledSuggestions.length === 0
                            ? "No recovery blocks scheduled"
                            : `${scheduledSuggestions.length} recovery block${scheduledSuggestions.length === 1 ? "" : "s"} scheduled`}
                        </p>
                      </div>
                      <Sheet open={isCalendarSheetOpen} onOpenChange={setIsCalendarSheetOpen}>
                        <SheetTrigger asChild>
                          <Button variant="outline" size="icon">
                            <CalendarIcon className="h-5 w-5" />
                          </Button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="h-[70vh]">
                          <div className="h-full pt-4">
                            <WeekCalendar
                              scheduledSuggestions={scheduledSuggestions}
                              onEventClick={setSelectedSuggestion}
                              className="h-full"
                            />
                          </div>
                        </SheetContent>
                      </Sheet>
                    </div>
                  </div>
                </>
              ) : (
                /* Desktop: Full calendar */
                <WeekCalendar
                  scheduledSuggestions={scheduledSuggestions}
                  onEventClick={setSelectedSuggestion}
                  className="min-h-[500px]"
                />
              )}

              {/* Empty state for desktop */}
              {!isMobile && scheduledSuggestions.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center bg-background/80 backdrop-blur-sm rounded-lg p-8">
                    <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                    <p className="text-muted-foreground">No recovery blocks scheduled</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                      Schedule suggestions from the{" "}
                      <Link href="/dashboard/suggestions" className="text-accent hover:underline pointer-events-auto">
                        Suggestions page
                      </Link>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Suggestion Detail Dialog */}
        <SuggestionDetailDialog
          suggestion={selectedSuggestion}
          open={!!selectedSuggestion}
          onOpenChange={(open) => !open && setSelectedSuggestion(null)}
        />

        {/* GETTING STARTED */}
        <div
          className={cn(
            "relative rounded-lg border border-border/70 bg-card/20 backdrop-blur-xl p-8 md:p-12 transition-all duration-1000 delay-400",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
          )}
        >
          <div className="max-w-2xl">
            <h2 className="text-2xl md:text-3xl font-serif mb-4">Get started</h2>
            <p className="text-muted-foreground mb-6">
              Record a 30-60 second voice sample to analyze your stress and fatigue levels. The more you record, the
              better kanari understands your patterns.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link href="/dashboard/recordings?newRecording=true">
                  <Mic className="mr-2 h-4 w-4" />
                  Record Now
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/settings">Configure Settings</Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
