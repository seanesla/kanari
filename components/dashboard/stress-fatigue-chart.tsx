"use client"

import { useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ResponsiveLine, type LineSeries, type SliceTooltipProps } from "@nivo/line"

// Extended type for series with color
type ChartSeries = LineSeries & { color: string }
import { TrendingUp, TrendingDown, Minus, Mic, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { getNivoTheme, getChartColors, getAreaFillDefinitions } from "@/lib/chart-theme"
import { useSceneMode } from "@/lib/scene-context"

interface TrendDataPoint {
  day: string
  stress: number
  fatigue: number
}

interface StressFatigueChartProps {
  data: TrendDataPoint[]
  height?: number
  showLegend?: boolean
  showTrendIndicator?: boolean
  emptyStateMessage?: string
  className?: string
  expanded?: boolean
  onExpandChange?: (expanded: boolean) => void
  aggregatedFeatures?: {
    speechRate: number
    rms: number
    pauseRatio: number
    spectralCentroid: number
    spectralFlux: number
    zcr: number
  } | null
}

// Calculate trend direction based on data slope
function calculateTrend(data: TrendDataPoint[]): "improving" | "stable" | "worsening" {
  if (data.length < 2) return "stable"

  const firstHalf = data.slice(0, Math.ceil(data.length / 2))
  const secondHalf = data.slice(Math.floor(data.length / 2))

  const firstAvg = firstHalf.reduce((sum, d) => sum + (d.stress + d.fatigue) / 2, 0) / firstHalf.length
  const secondAvg = secondHalf.reduce((sum, d) => sum + (d.stress + d.fatigue) / 2, 0) / secondHalf.length

  const diff = secondAvg - firstAvg

  // Lower scores are better, so negative diff means improving
  if (diff < -5) return "improving"
  if (diff > 5) return "worsening"
  return "stable"
}

// Analyze stress biomarkers based on aggregated features
function analyzeStressBiomarkers(features: NonNullable<StressFatigueChartProps['aggregatedFeatures']>) {
  const contributors: Array<{ name: string; status: 'elevated' | 'normal'; description: string }> = []

  // Speech rate (stressed: >5.5 high, >4.5 moderate)
  if (features.speechRate > 5.5) {
    contributors.push({ name: 'Speech Rate', status: 'elevated', description: 'Speaking faster than normal' })
  } else if (features.speechRate > 4.5) {
    contributors.push({ name: 'Speech Rate', status: 'elevated', description: 'Slightly elevated pace' })
  }

  // RMS energy (stressed: >0.3 high, >0.2 moderate)
  if (features.rms > 0.3) {
    contributors.push({ name: 'Voice Energy', status: 'elevated', description: 'Higher vocal intensity' })
  } else if (features.rms > 0.2) {
    contributors.push({ name: 'Voice Energy', status: 'elevated', description: 'Moderately increased energy' })
  }

  // Spectral flux (stressed: >0.15 high, >0.1 moderate)
  if (features.spectralFlux > 0.15) {
    contributors.push({ name: 'Vocal Dynamics', status: 'elevated', description: 'More rapid voice changes' })
  } else if (features.spectralFlux > 0.1) {
    contributors.push({ name: 'Vocal Dynamics', status: 'elevated', description: 'Increased vocal variation' })
  }

  // ZCR (stressed: >0.08 high, >0.05 moderate)
  if (features.zcr > 0.08) {
    contributors.push({ name: 'Voice Tension', status: 'elevated', description: 'Higher vocal tension detected' })
  } else if (features.zcr > 0.05) {
    contributors.push({ name: 'Voice Tension', status: 'elevated', description: 'Slight tension in voice' })
  }

  if (contributors.length === 0) {
    contributors.push({ name: 'All Biomarkers', status: 'normal', description: 'Within healthy ranges' })
  }

  return contributors
}

// Analyze fatigue biomarkers based on aggregated features
function analyzeFatigueBiomarkers(features: NonNullable<StressFatigueChartProps['aggregatedFeatures']>) {
  const contributors: Array<{ name: string; status: 'low' | 'normal'; description: string }> = []

  // Speech rate (fatigued: <3 high, <3.5 moderate)
  if (features.speechRate < 3) {
    contributors.push({ name: 'Speech Rate', status: 'low', description: 'Speaking slower than normal' })
  } else if (features.speechRate < 3.5) {
    contributors.push({ name: 'Speech Rate', status: 'low', description: 'Slightly reduced pace' })
  }

  // RMS energy (fatigued: <0.1 high, <0.15 moderate)
  if (features.rms < 0.1) {
    contributors.push({ name: 'Voice Energy', status: 'low', description: 'Lower vocal energy' })
  } else if (features.rms < 0.15) {
    contributors.push({ name: 'Voice Energy', status: 'low', description: 'Reduced voice strength' })
  }

  // Pause ratio (fatigued: >0.4 high, >0.3 moderate)
  if (features.pauseRatio > 0.4) {
    contributors.push({ name: 'Pause Frequency', status: 'low', description: 'More frequent pauses' })
  } else if (features.pauseRatio > 0.3) {
    contributors.push({ name: 'Pause Frequency', status: 'low', description: 'Increased pausing' })
  }

  // Spectral centroid (fatigued: <0.3 high, <0.45 moderate)
  if (features.spectralCentroid < 0.3) {
    contributors.push({ name: 'Voice Brightness', status: 'low', description: 'Duller voice tone' })
  } else if (features.spectralCentroid < 0.45) {
    contributors.push({ name: 'Voice Brightness', status: 'low', description: 'Less bright tone' })
  }

  if (contributors.length === 0) {
    contributors.push({ name: 'All Biomarkers', status: 'normal', description: 'Within healthy ranges' })
  }

  return contributors
}

// Custom tooltip component matching glassmorphism style
function CustomTooltip({ slice }: SliceTooltipProps<ChartSeries>) {
  return (
    <div className="rounded-lg bg-card/95 backdrop-blur-xl border border-border/50 px-4 py-3 shadow-xl">
      <p className="text-sm font-medium text-foreground mb-2">{String(slice.points[0]?.data.x ?? '')}</p>
      <div className="space-y-1.5">
        {slice.points.map((point) => (
          <div key={point.id} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: point.seriesColor }}
            />
            <span className="text-xs text-muted-foreground">{point.seriesId}:</span>
            <span className="text-sm font-medium" style={{ color: point.seriesColor }}>
              {point.data.yFormatted}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function StressFatigueChart({
  data,
  height = 350,
  showLegend = true,
  showTrendIndicator = true,
  emptyStateMessage = "No recordings yet",
  className,
  expanded = false,
  onExpandChange,
  aggregatedFeatures,
}: StressFatigueChartProps) {
  const { accentColor } = useSceneMode()

  // Get dynamic theme and colors based on accent color
  const nivoTheme = useMemo(() => getNivoTheme(accentColor), [accentColor])
  const chartColors = useMemo(() => getChartColors(accentColor), [accentColor])
  const areaFillDefinitions = useMemo(() => getAreaFillDefinitions(accentColor), [accentColor])

  // Transform data to Nivo format
  const chartData: ChartSeries[] = useMemo(() => {
    if (data.length === 0) return []

    return [
      {
        id: "Stress",
        color: chartColors.stress,
        data: data.map((d) => ({ x: d.day, y: d.stress })),
      },
      {
        id: "Fatigue",
        color: chartColors.fatigue,
        data: data.map((d) => ({ x: d.day, y: d.fatigue })),
      },
    ]
  }, [data, chartColors])

  const trend = useMemo(() => calculateTrend(data), [data])

  // Memoize biomarker analysis to avoid recalculating on every render
  const stressBiomarkers = useMemo(
    () => aggregatedFeatures ? analyzeStressBiomarkers(aggregatedFeatures) : [],
    [aggregatedFeatures]
  )

  const fatigueBiomarkers = useMemo(
    () => aggregatedFeatures ? analyzeFatigueBiomarkers(aggregatedFeatures) : [],
    [aggregatedFeatures]
  )

  const trendConfig = {
    improving: {
      label: "Improving",
      icon: TrendingDown,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    stable: {
      label: "Stable",
      icon: Minus,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    worsening: {
      label: "Worsening",
      icon: TrendingUp,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
  }

  const currentTrend = trendConfig[trend]
  const TrendIcon = currentTrend.icon

  // Empty state
  if (data.length === 0) {
    return (
      <div className={cn("flex items-center justify-center", className)} style={{ height }}>
        <div className="text-center">
          <Mic className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-muted-foreground">{emptyStateMessage}</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Start recording to see your trends</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("relative", className)}>
      {/* Header with legend and trend */}
      <div className="flex items-center justify-between mb-4">
        {showLegend && (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColors.stress }} />
              <span className="text-xs text-muted-foreground">Stress</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColors.fatigue }} />
              <span className="text-xs text-muted-foreground">Fatigue</span>
            </div>
          </div>
        )}

        {showTrendIndicator && data.length >= 2 && (
          <div className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
            currentTrend.bgColor,
            currentTrend.color
          )}>
            <TrendIcon className="h-3.5 w-3.5" />
            <span>{currentTrend.label}</span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div style={{ height }}>
        <ResponsiveLine
          data={chartData}
          theme={nivoTheme}
          colors={[chartColors.stress, chartColors.fatigue]}
          margin={{ top: 10, right: 20, bottom: 40, left: 45 }}
          xScale={{ type: "point" }}
          yScale={{ type: "linear", min: 0, max: 100, stacked: false }}
          curve="monotoneX"
          axisTop={null}
          axisRight={null}
          axisBottom={{
            tickSize: 0,
            tickPadding: 12,
            tickRotation: 0,
          }}
          axisLeft={{
            tickSize: 0,
            tickPadding: 12,
            tickRotation: 0,
            tickValues: [0, 25, 50, 75, 100],
          }}
          enableGridX={false}
          enableGridY={true}
          enablePoints={true}
          pointSize={10}
          pointColor={{ from: "seriesColor" }}
          pointBorderWidth={2}
          pointBorderColor={{ from: "seriesColor" }}
          pointLabelYOffset={-12}
          enableArea={true}
          areaOpacity={0.15}
          areaBlendMode="normal"
          defs={areaFillDefinitions}
          fill={[
            { match: { id: "Stress" }, id: "stressGradient" },
            { match: { id: "Fatigue" }, id: "fatigueGradient" },
          ]}
          useMesh={true}
          enableSlices="x"
          sliceTooltip={CustomTooltip}
          animate={true}
          motionConfig="gentle"
          crosshairType="x"
        />
      </div>

      {/* Score summary below chart */}
      {data.length > 0 && (
        <div className="mt-4 flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Avg Stress:</span>
            <span className="font-medium" style={{ color: chartColors.stress }}>
              {Math.round(data.reduce((sum, d) => sum + d.stress, 0) / data.length)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Avg Fatigue:</span>
            <span className="font-medium" style={{ color: chartColors.fatigue }}>
              {Math.round(data.reduce((sum, d) => sum + d.fatigue, 0) / data.length)}
            </span>
          </div>
        </div>
      )}

      {/* Expand indicator - only show if we have data */}
      {data.length > 0 && (
        <div className="flex items-center justify-center gap-1 mt-2 text-xs text-muted-foreground/70">
          <span>Tap for details</span>
          <ChevronDown className={cn("h-3 w-3 transition-transform duration-300", expanded && "rotate-180")} />
        </div>
      )}

      {/* Expanded content with Framer Motion */}
      <AnimatePresence>
        {expanded && aggregatedFeatures && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pt-6 mt-6 border-t border-border/50 space-y-6 text-sm">
              {/* Contributing Biomarkers */}
              <div>
                <p className="font-medium text-foreground mb-3">Contributing Biomarkers</p>

                {/* Stress Contributors */}
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-2">Stress Indicators:</p>
                  <div className="space-y-2">
                    {stressBiomarkers.map((biomarker, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full mt-1 flex-shrink-0",
                            biomarker.status === "elevated" ? "bg-destructive" : "bg-muted"
                          )}
                        />
                        <div>
                          <span className="font-medium">{biomarker.name}:</span>{" "}
                          <span className="text-muted-foreground">{biomarker.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fatigue Contributors */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Fatigue Indicators:</p>
                  <div className="space-y-2">
                    {fatigueBiomarkers.map((biomarker, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full mt-1 flex-shrink-0",
                            biomarker.status === "low" ? "bg-accent" : "bg-muted"
                          )}
                        />
                        <div>
                          <span className="font-medium">{biomarker.name}:</span>{" "}
                          <span className="text-muted-foreground">{biomarker.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Score Interpretation Legend */}
              <div>
                <p className="font-medium text-foreground mb-2">Score Ranges</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Stress:</p>
                    <ul className="text-muted-foreground text-xs space-y-1">
                      <li className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-success" /> 0-30: Low
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-accent" /> 31-60: Moderate
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-orange-500" /> 61-80: Elevated
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-destructive" /> 81-100: High
                      </li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Fatigue:</p>
                    <ul className="text-muted-foreground text-xs space-y-1">
                      <li className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-success" /> 0-30: Rested
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-accent" /> 31-60: Normal
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-orange-500" /> 61-80: Tired
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-destructive" /> 81-100: Exhausted
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Biomarker Explanations */}
              <div>
                <p className="font-medium text-foreground mb-2">What we measure</p>
                <ul className="text-muted-foreground text-xs space-y-1.5 leading-relaxed">
                  <li>
                    <span className="font-medium text-foreground">Speech Rate:</span> How quickly you speak (syllables/second)
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Voice Energy:</span> Loudness and intensity of your voice
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Pause Patterns:</span> Frequency and duration of pauses in speech
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Voice Tone:</span> Brightness and spectral qualities of your voice
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Vocal Dynamics:</span> How much your voice changes over time
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
