"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { Link } from "next-view-transitions"
import { Mic, TrendingUp, Calendar, Lightbulb } from "lucide-react"
import {
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
  PolarGrid,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts"
import { useSceneMode } from "@/lib/scene-context"
import { cn } from "@/lib/utils"
import { DecorativeGrid } from "@/components/ui/decorative-grid"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

export default function DashboardPage() {
  const { setMode } = useSceneMode()
  const [visible, setVisible] = useState(false)
  const [chartsVisible, setChartsVisible] = useState(false)
  const chartsRef = useRef<HTMLDivElement>(null)

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

  // Placeholder data - will be replaced with real data from IndexedDB
  const stats = {
    totalRecordings: 0,
    currentStreak: 0,
    avgStress: 0,
    suggestionsAccepted: 0,
  }

  // Chart config
  const chartConfig: ChartConfig = {
    stress: {
      label: "Stress",
      color: "#ef4444",
    },
    fatigue: {
      label: "Fatigue",
      color: "#d4a574",
    },
  }

  // Placeholder trend data
  const trendData = useMemo(
    () => [
      { day: "Mon", stress: 0, fatigue: 0 },
      { day: "Tue", stress: 0, fatigue: 0 },
      { day: "Wed", stress: 0, fatigue: 0 },
      { day: "Thu", stress: 0, fatigue: 0 },
      { day: "Fri", stress: 0, fatigue: 0 },
      { day: "Sat", stress: 0, fatigue: 0 },
      { day: "Sun", stress: 0, fatigue: 0 },
    ],
    []
  )

  // Wellness score (placeholder)
  const wellnessScore = 0
  const wellnessData = useMemo(
    () => [{ name: "wellness", value: wellnessScore, fill: "#22c55e" }],
    [wellnessScore]
  )

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
              <Link href="/dashboard/record">
                <Mic className="mr-2 h-5 w-5" />
                Start Recording
              </Link>
            </Button>
          </div>
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
            <Calendar className="h-5 w-5 mx-auto mb-2 text-accent" />
            <p className="text-3xl md:text-4xl font-serif tabular-nums">{stats.avgStress}</p>
            <p className="text-xs text-muted-foreground mt-2">Avg stress</p>
          </div>
          <div className="text-center p-4 md:p-5 rounded-lg border border-border/70 bg-card/20 backdrop-blur-xl">
            <Lightbulb className="h-5 w-5 mx-auto mb-2 text-success" />
            <p className="text-3xl md:text-4xl font-serif tabular-nums">{stats.suggestionsAccepted}</p>
            <p className="text-xs text-muted-foreground mt-2">Suggestions taken</p>
          </div>
        </div>

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
            <div className="grid md:grid-cols-2 gap-8">
              {/* Chart 1: 7-Day Trend */}
              <div
                className={cn(
                  "group relative rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl p-8 transition-all duration-500 hover:border-accent/50 hover:bg-card/40",
                  chartsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
                )}
                style={{ transitionDelay: chartsVisible ? "400ms" : "0ms" }}
              >
                <h3 className="text-lg font-semibold mb-4">Stress & Fatigue (7 days)</h3>
                {stats.totalRecordings === 0 ? (
                  <div className="h-[350px] flex items-center justify-center">
                    <div className="text-center">
                      <Mic className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                      <p className="text-muted-foreground">No recordings yet</p>
                      <p className="text-sm text-muted-foreground/70 mt-1">Start recording to see your trends</p>
                    </div>
                  </div>
                ) : (
                  <ChartContainer config={chartConfig} className="h-[350px]">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="colorStress" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorFatigue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#d4a574" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#d4a574" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="day" stroke="#999" style={{ fontSize: "12px" }} />
                      <YAxis stroke="#999" style={{ fontSize: "12px" }} domain={[0, 100]} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area
                        type="monotone"
                        dataKey="stress"
                        stroke="#ef4444"
                        fill="url(#colorStress)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="fatigue"
                        stroke="#d4a574"
                        fill="url(#colorFatigue)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ChartContainer>
                )}
              </div>

              {/* Chart 2: Wellness Score Gauge */}
              <div
                className={cn(
                  "group relative rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl p-8 transition-all duration-500 hover:border-accent/50 hover:bg-card/40",
                  chartsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
                )}
                style={{ transitionDelay: chartsVisible ? "500ms" : "0ms" }}
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
                  <ChartContainer config={chartConfig} className="h-[350px]">
                    <RadialBarChart
                      data={wellnessData}
                      innerRadius="70%"
                      outerRadius="100%"
                      startAngle={90}
                      endAngle={-270}
                    >
                      <PolarGrid gridType="circle" stroke="#333" />
                      <RadialBar dataKey="value" cornerRadius={10} fill="#22c55e" />
                      <text
                        x="50%"
                        y="50%"
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={32}
                        fontFamily="serif"
                        fontWeight="600"
                        fill="#22c55e"
                      >
                        {wellnessScore}%
                      </text>
                    </RadialBarChart>
                  </ChartContainer>
                )}
                <p className="text-center text-xs text-muted-foreground mt-4">
                  {stats.totalRecordings === 0
                    ? "Start recording to see your wellness score"
                    : wellnessScore > 70
                    ? "You're doing great!"
                    : wellnessScore > 50
                    ? "Room for improvement"
                    : "Consider taking a break"}
                </p>
              </div>
            </div>
          </div>
        </div>

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
                <Link href="/dashboard/record">
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
