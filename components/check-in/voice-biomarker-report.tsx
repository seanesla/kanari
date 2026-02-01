"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown, Mic, Sparkles, TrendingUp } from "@/lib/icons"
import { cn } from "@/lib/utils"
import type { AudioFeatures, BiomarkerCalibration, CheckInSession } from "@/lib/types"
import { db } from "@/lib/storage/db"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { BiomarkerIndicator } from "@/components/check-in/biomarker-indicator"
import { blendAcousticAndSemanticBiomarkers } from "@/lib/ml/biomarker-fusion"
import { FATIGUE, SCORING_WEIGHTS, STRESS, shouldIncludeInTrends } from "@/lib/ml/thresholds"

type ReportState = "live" | "final"

export interface VoiceBiomarkerReportProps {
  metrics?: CheckInSession["acousticMetrics"] | null
  state?: ReportState
  className?: string
  defaultExpanded?: boolean
  title?: string
}

type NumericFeatureKey = Exclude<keyof AudioFeatures, "mfcc">

type HeuristicBreakdownRow = {
  label: string
  value: string
  rule: string
  points: number
  weight: number
  contributionPct: number
}

type FeatureDef = {
  key: NumericFeatureKey
  label: string
  unit?: string
  description: string
  format?: (value: number) => string
  deltaFormat?: (delta: number) => string
}

function formatNumber(value: number, digits: number = 2): string {
  if (!Number.isFinite(value)) return "—"
  return value.toFixed(digits)
}

function formatSigned(value: number, digits: number = 2): string {
  if (!Number.isFinite(value)) return "—"
  const sign = value > 0 ? "+" : value < 0 ? "-" : "±"
  return `${sign}${Math.abs(value).toFixed(digits)}`
}

function formatPercent01(value: number): string {
  if (!Number.isFinite(value)) return "—"
  return `${Math.round(value * 100)}%`
}

function formatSignedPercent01(delta: number): string {
  if (!Number.isFinite(delta)) return "—"
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "±"
  return `${sign}${Math.abs(Math.round(delta * 100))}%`
}

function clipMfcc(mfcc: number[], count: number): number[] {
  if (!Array.isArray(mfcc)) return []
  return mfcc.slice(0, count).map((v) => (Number.isFinite(v) ? v : 0))
}

function computeHeuristicStressBreakdown(features: AudioFeatures): { rows: HeuristicBreakdownRow[]; totalPoints: number; totalWeight: number; score: number } {
  const rows: HeuristicBreakdownRow[] = []
  const totalWeight =
    SCORING_WEIGHTS.SPEECH_RATE +
    SCORING_WEIGHTS.RMS_ENERGY +
    SCORING_WEIGHTS.SPECTRAL_FLUX +
    SCORING_WEIGHTS.ZCR

  const speechRate = features.speechRate
  const speechRatePoints =
    speechRate > STRESS.SPEECH_RATE_HIGH
      ? SCORING_WEIGHTS.SPEECH_RATE
      : speechRate > STRESS.SPEECH_RATE_MODERATE
        ? SCORING_WEIGHTS.MODERATE_INDICATOR
        : 0
  rows.push({
    label: "Speech rate",
    value: `${formatNumber(speechRate, 2)} syll/s`,
    rule:
      speechRatePoints === 0
        ? `<= ${STRESS.SPEECH_RATE_MODERATE}`
        : speechRatePoints === SCORING_WEIGHTS.SPEECH_RATE
          ? `> ${STRESS.SPEECH_RATE_HIGH} (high)`
          : `> ${STRESS.SPEECH_RATE_MODERATE} (moderate)`,
    points: speechRatePoints,
    weight: SCORING_WEIGHTS.SPEECH_RATE,
    contributionPct: Math.round((speechRatePoints / totalWeight) * 100),
  })

  const rms = features.rms
  const rmsPoints =
    rms > STRESS.RMS_HIGH
      ? SCORING_WEIGHTS.RMS_ENERGY
      : rms > STRESS.RMS_MODERATE
        ? SCORING_WEIGHTS.MODERATE_SECONDARY
        : 0
  rows.push({
    label: "Voice energy (RMS)",
    value: formatNumber(rms, 3),
    rule:
      rmsPoints === 0
        ? `<= ${STRESS.RMS_MODERATE}`
        : rmsPoints === SCORING_WEIGHTS.RMS_ENERGY
          ? `> ${STRESS.RMS_HIGH} (high)`
          : `> ${STRESS.RMS_MODERATE} (moderate)`,
    points: rmsPoints,
    weight: SCORING_WEIGHTS.RMS_ENERGY,
    contributionPct: Math.round((rmsPoints / totalWeight) * 100),
  })

  const flux = features.spectralFlux
  const fluxPoints =
    flux > STRESS.SPECTRAL_FLUX_HIGH
      ? SCORING_WEIGHTS.SPECTRAL_FLUX
      : flux > STRESS.SPECTRAL_FLUX_MODERATE
        ? SCORING_WEIGHTS.MODERATE_SECONDARY
        : 0
  rows.push({
    label: "Spectral flux",
    value: formatNumber(flux, 3),
    rule:
      fluxPoints === 0
        ? `<= ${STRESS.SPECTRAL_FLUX_MODERATE}`
        : fluxPoints === SCORING_WEIGHTS.SPECTRAL_FLUX
          ? `> ${STRESS.SPECTRAL_FLUX_HIGH} (high)`
          : `> ${STRESS.SPECTRAL_FLUX_MODERATE} (moderate)`,
    points: fluxPoints,
    weight: SCORING_WEIGHTS.SPECTRAL_FLUX,
    contributionPct: Math.round((fluxPoints / totalWeight) * 100),
  })

  const zcr = features.zcr
  const zcrPoints =
    zcr > STRESS.ZCR_HIGH
      ? SCORING_WEIGHTS.ZCR
      : zcr > STRESS.ZCR_MODERATE
        ? SCORING_WEIGHTS.MODERATE_TERTIARY
        : 0
  rows.push({
    label: "Tension (ZCR)",
    value: formatNumber(zcr, 3),
    rule:
      zcrPoints === 0
        ? `<= ${STRESS.ZCR_MODERATE}`
        : zcrPoints === SCORING_WEIGHTS.ZCR
          ? `> ${STRESS.ZCR_HIGH} (high)`
          : `> ${STRESS.ZCR_MODERATE} (moderate)`,
    points: zcrPoints,
    weight: SCORING_WEIGHTS.ZCR,
    contributionPct: Math.round((zcrPoints / totalWeight) * 100),
  })

  const totalPoints = rows.reduce((sum, r) => sum + r.points, 0)
  const score = totalWeight > 0 ? Math.round((totalPoints / totalWeight) * 100) : 0
  return { rows, totalPoints, totalWeight, score }
}

function computeHeuristicFatigueBreakdown(features: AudioFeatures): { rows: HeuristicBreakdownRow[]; totalPoints: number; totalWeight: number; score: number } {
  const rows: HeuristicBreakdownRow[] = []
  const totalWeight =
    SCORING_WEIGHTS.SPEECH_RATE +
    SCORING_WEIGHTS.RMS_ENERGY +
    SCORING_WEIGHTS.PAUSE_RATIO +
    SCORING_WEIGHTS.SPECTRAL_CENTROID

  const speechRate = features.speechRate
  const speechRatePoints =
    speechRate < FATIGUE.SPEECH_RATE_LOW
      ? SCORING_WEIGHTS.SPEECH_RATE
      : speechRate < FATIGUE.SPEECH_RATE_MODERATE
        ? SCORING_WEIGHTS.MODERATE_INDICATOR
        : 0
  rows.push({
    label: "Speech rate",
    value: `${formatNumber(speechRate, 2)} syll/s`,
    rule:
      speechRatePoints === 0
        ? `>= ${FATIGUE.SPEECH_RATE_MODERATE}`
        : speechRatePoints === SCORING_WEIGHTS.SPEECH_RATE
          ? `< ${FATIGUE.SPEECH_RATE_LOW} (high)`
          : `< ${FATIGUE.SPEECH_RATE_MODERATE} (moderate)`,
    points: speechRatePoints,
    weight: SCORING_WEIGHTS.SPEECH_RATE,
    contributionPct: Math.round((speechRatePoints / totalWeight) * 100),
  })

  const rms = features.rms
  const rmsPoints =
    rms < FATIGUE.RMS_LOW
      ? SCORING_WEIGHTS.RMS_ENERGY
      : rms < FATIGUE.RMS_MODERATE
        ? SCORING_WEIGHTS.MODERATE_SECONDARY
        : 0
  rows.push({
    label: "Voice energy (RMS)",
    value: formatNumber(rms, 3),
    rule:
      rmsPoints === 0
        ? `>= ${FATIGUE.RMS_MODERATE}`
        : rmsPoints === SCORING_WEIGHTS.RMS_ENERGY
          ? `< ${FATIGUE.RMS_LOW} (high)`
          : `< ${FATIGUE.RMS_MODERATE} (moderate)`,
    points: rmsPoints,
    weight: SCORING_WEIGHTS.RMS_ENERGY,
    contributionPct: Math.round((rmsPoints / totalWeight) * 100),
  })

  const pauseRatio = features.pauseRatio
  const pausePoints =
    pauseRatio > FATIGUE.PAUSE_RATIO_HIGH
      ? SCORING_WEIGHTS.PAUSE_RATIO
      : pauseRatio > FATIGUE.PAUSE_RATIO_MODERATE
        ? SCORING_WEIGHTS.MODERATE_SECONDARY
        : 0
  rows.push({
    label: "Pause ratio",
    value: formatPercent01(pauseRatio),
    rule:
      pausePoints === 0
        ? `<= ${FATIGUE.PAUSE_RATIO_MODERATE}`
        : pausePoints === SCORING_WEIGHTS.PAUSE_RATIO
          ? `> ${FATIGUE.PAUSE_RATIO_HIGH} (high)`
          : `> ${FATIGUE.PAUSE_RATIO_MODERATE} (moderate)`,
    points: pausePoints,
    weight: SCORING_WEIGHTS.PAUSE_RATIO,
    contributionPct: Math.round((pausePoints / totalWeight) * 100),
  })

  const centroid = features.spectralCentroid
  const centroidPoints =
    centroid < FATIGUE.SPECTRAL_CENTROID_LOW
      ? SCORING_WEIGHTS.SPECTRAL_CENTROID
      : centroid < FATIGUE.SPECTRAL_CENTROID_MODERATE
        ? SCORING_WEIGHTS.MODERATE_TERTIARY
        : 0
  rows.push({
    label: "Brightness (centroid)",
    value: formatNumber(centroid, 2),
    rule:
      centroidPoints === 0
        ? `>= ${FATIGUE.SPECTRAL_CENTROID_MODERATE}`
        : centroidPoints === SCORING_WEIGHTS.SPECTRAL_CENTROID
          ? `< ${FATIGUE.SPECTRAL_CENTROID_LOW} (high)`
          : `< ${FATIGUE.SPECTRAL_CENTROID_MODERATE} (moderate)`,
    points: centroidPoints,
    weight: SCORING_WEIGHTS.SPECTRAL_CENTROID,
    contributionPct: Math.round((centroidPoints / totalWeight) * 100),
  })

  const totalPoints = rows.reduce((sum, r) => sum + r.points, 0)
  const score = totalWeight > 0 ? Math.round((totalPoints / totalWeight) * 100) : 0
  return { rows, totalPoints, totalWeight, score }
}

const FEATURE_DEFS: FeatureDef[] = [
  {
    key: "speechRate",
    label: "Speech rate",
    unit: "syll/s",
    description: "How quickly you speak. Changes can correlate with stress or fatigue.",
    format: (v) => formatNumber(v, 2),
    deltaFormat: (d) => formatSigned(d, 2),
  },
  {
    key: "pauseRatio",
    label: "Pause ratio",
    unit: "%",
    description: "How much of the time is silence vs speech.",
    format: formatPercent01,
    deltaFormat: formatSignedPercent01,
  },
  {
    key: "rms",
    label: "Voice energy",
    unit: "0-1",
    description: "Average vocal intensity (loudness proxy).",
    format: (v) => formatNumber(v, 3),
    deltaFormat: (d) => formatSigned(d, 3),
  },
  {
    key: "pitchMean",
    label: "Pitch mean",
    unit: "Hz",
    description: "Average fundamental frequency (F0).",
    format: (v) => formatNumber(v, 0),
    deltaFormat: (d) => formatSigned(d, 0),
  },
  {
    key: "pitchStdDev",
    label: "Pitch variability",
    unit: "Hz",
    description: "How much pitch fluctuates; can rise under stress.",
    format: (v) => formatNumber(v, 0),
    deltaFormat: (d) => formatSigned(d, 0),
  },
  {
    key: "pitchRange",
    label: "Pitch range",
    unit: "Hz",
    description: "Max-min pitch. Low range can indicate a flatter/monotone tone.",
    format: (v) => formatNumber(v, 0),
    deltaFormat: (d) => formatSigned(d, 0),
  },
  {
    key: "spectralCentroid",
    label: "Brightness",
    unit: "0-1",
    description: "Spectral centroid (normalized). Lower can sound duller.",
    format: (v) => formatNumber(v, 2),
    deltaFormat: (d) => formatSigned(d, 2),
  },
  {
    key: "spectralFlux",
    label: "Dynamics",
    unit: "0-1",
    description: "Spectral flux (normalized). Higher can indicate agitation/instability.",
    format: (v) => formatNumber(v, 3),
    deltaFormat: (d) => formatSigned(d, 3),
  },
  {
    key: "zcr",
    label: "Tension (ZCR)",
    unit: "0-1",
    description: "Zero-crossing rate (rough tension/noisiness proxy).",
    format: (v) => formatNumber(v, 3),
    deltaFormat: (d) => formatSigned(d, 3),
  },
]

export function VoiceBiomarkerReport({
  metrics,
  state = "final",
  className,
  defaultExpanded = false,
  title = "Voice biomarker report",
}: VoiceBiomarkerReportProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [baseline, setBaseline] = useState<AudioFeatures | null>(null)
  const [calibration, setCalibration] = useState<BiomarkerCalibration | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadBaseline() {
      try {
        const settings = await db.settings.get("default")
        const features = (settings?.voiceBaseline?.features as AudioFeatures | undefined) ?? null
        const calibration = (settings?.voiceBiomarkerCalibration as BiomarkerCalibration | undefined) ?? null
        if (cancelled) return
        setBaseline(features)
        setCalibration(calibration)
      } catch {
        // ignore
      }
    }

    void loadBaseline()
    return () => {
      cancelled = true
    }
  }, [])

  const features = metrics?.features ?? null
  const mfcc = useMemo(() => clipMfcc(features?.mfcc ?? [], 12), [features?.mfcc])

  const breakdown = useMemo(() => {
    if (!features) return null

    const acousticStressScore = metrics?.acousticStressScore ?? metrics?.stressScore ?? 0
    const acousticFatigueScore = metrics?.acousticFatigueScore ?? metrics?.fatigueScore ?? 0
    const acousticConfidence = metrics?.acousticConfidence ?? metrics?.confidence ?? 0

    const semanticStressScore = metrics?.semanticStressScore
    const semanticFatigueScore = metrics?.semanticFatigueScore
    const semanticConfidence = metrics?.semanticConfidence

    const blended =
      typeof semanticStressScore === "number" &&
      typeof semanticFatigueScore === "number" &&
      typeof semanticConfidence === "number"
        ? blendAcousticAndSemanticBiomarkers({
            acoustic: {
              stressScore: acousticStressScore,
              fatigueScore: acousticFatigueScore,
              confidence: acousticConfidence,
            },
            semantic: {
              stressScore: semanticStressScore,
              fatigueScore: semanticFatigueScore,
              confidence: semanticConfidence,
            },
          })
        : null

    const quality = metrics?.quality
    const affectsTrend = shouldIncludeInTrends(quality)
    const qualityScore = typeof quality?.quality === "number" ? quality.quality : null
    const hasFiniteQuality = qualityScore !== null && Number.isFinite(qualityScore)

      return {
      acousticStressScore,
      acousticFatigueScore,
      acousticConfidence,
      semanticStressScore,
      semanticFatigueScore,
      semanticConfidence,
      semanticSource: metrics?.semanticSource,
      blended,
      quality,
      hasFiniteQuality,
      affectsTrend,
      stressHeuristic: computeHeuristicStressBreakdown(features),
      fatigueHeuristic: computeHeuristicFatigueBreakdown(features),
    }
  }, [features, metrics])

  const evidence = useMemo(() => {
    const speechSeconds = metrics?.quality?.speechSeconds
    const pauseCount = features?.pauseCount
    const avgPauseMs = features?.avgPauseDuration

    const chips: Array<{ label: string; title?: string }> = []
    if (typeof speechSeconds === "number" && Number.isFinite(speechSeconds)) {
      chips.push({ label: `Speech ${Math.round(speechSeconds)}s`, title: "Detected clear speech" })
    }
    if (typeof pauseCount === "number" && Number.isFinite(pauseCount)) {
      chips.push({ label: `Pauses ${Math.round(pauseCount)}`, title: "Detected pause events" })
    }
    if (typeof avgPauseMs === "number" && Number.isFinite(avgPauseMs) && avgPauseMs > 0) {
      chips.push({ label: `Avg pause ${Math.round(avgPauseMs)}ms`, title: "Average pause duration" })
    }

    chips.push({ label: "On-device", title: "Acoustic features are computed in your browser" })
    chips.push({ label: baseline ? "Baseline on" : "Baseline off", title: "Personal comparisons use your baseline" })
    return chips
  }, [baseline, features?.avgPauseDuration, features?.pauseCount, metrics?.quality?.speechSeconds])

  if (!metrics) {
    if (state === "live") {
      return (
        <div className={cn("rounded-lg border border-border/50 bg-background/50 px-4 py-3", className)}>
          <p className="text-xs text-muted-foreground">Listening for voice biomarkers...</p>
        </div>
      )
    }

    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/40 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Not enough speech captured to analyze stress/fatigue. Try speaking for about 1-2 seconds.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground/80">
            Acoustic features are computed on-device from rhythm, energy, and tone shifts.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-border/60",
            "bg-muted/15 px-3 py-1 text-xs text-muted-foreground",
            "transition-colors hover:bg-muted/25"
          )}
          aria-expanded={expanded}
        >
          <span>{expanded ? "Hide" : "Show"} technical details</span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-300", expanded && "rotate-180")} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {evidence.map((chip) => (
          <Tooltip key={chip.label}>
            <TooltipTrigger asChild>
              <span>
                <Badge
                  variant="outline"
                  className="bg-muted/15 border-border/60 text-muted-foreground"
                >
                  {chip.label}
                </Badge>
              </span>
            </TooltipTrigger>
            {chip.title ? <TooltipContent>{chip.title}</TooltipContent> : null}
          </Tooltip>
        ))}
      </div>

      <BiomarkerIndicator metrics={metrics} className="border-border/60 bg-background/40" />

      <AnimatePresence>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pt-4 mt-4 border-t border-border/50 space-y-4">
              {/* Pipeline */}
              <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
                <p className="text-xs font-medium text-muted-foreground">Pipeline</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/30 px-2 py-1">
                    <Mic className="h-3.5 w-3.5 text-muted-foreground" />
                    mic
                  </span>
                  <span className="text-muted-foreground/70">→</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/30 px-2 py-1">
                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                    features in-browser
                  </span>
                  <span className="text-muted-foreground/70">→</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/30 px-2 py-1">
                    <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                    stress + fatigue
                  </span>
                  <span className="text-muted-foreground/70">→</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/30 px-2 py-1">
                    trends + forecast
                  </span>
                </div>
                <p className="mt-3 text-xs text-muted-foreground/80">
                  Acoustic features stay on this device. During the check-in, audio is streamed to Gemini for the conversation.
                </p>
              </div>

              {/* Score breakdown */}
              {breakdown ? (
                <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
                  <p className="text-xs font-medium text-muted-foreground">Score breakdown</p>

                  <div className="mt-3 rounded-lg border border-border/60 bg-background/30 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/60">
                          <TableHead className="text-xs text-muted-foreground">Signal</TableHead>
                          <TableHead className="text-xs text-muted-foreground">Value</TableHead>
                          <TableHead className="text-xs text-muted-foreground">Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className="border-border/60">
                          <TableCell className="py-2 text-xs font-medium">Final stress</TableCell>
                          <TableCell className="py-2 text-xs tabular-nums">{Math.round(metrics?.stressScore ?? 0)}/100</TableCell>
                          <TableCell className="py-2 text-xs text-muted-foreground">
                            {breakdown.blended
                              ? `Blend: ${Math.round(breakdown.blended.debug.stress.acousticWeight * 100)}% acoustic / ${Math.round(breakdown.blended.debug.stress.semanticWeight * 100)}% semantic`
                              : "Acoustic-only (no semantic blend)"}
                          </TableCell>
                        </TableRow>

                        <TableRow className="border-border/60">
                          <TableCell className="py-2 text-xs font-medium">Final fatigue</TableCell>
                          <TableCell className="py-2 text-xs tabular-nums">{Math.round(metrics?.fatigueScore ?? 0)}/100</TableCell>
                          <TableCell className="py-2 text-xs text-muted-foreground">
                            {breakdown.blended
                              ? `Blend: ${Math.round(breakdown.blended.debug.fatigue.acousticWeight * 100)}% acoustic / ${Math.round(breakdown.blended.debug.fatigue.semanticWeight * 100)}% semantic`
                              : "Acoustic-only (no semantic blend)"}
                          </TableCell>
                        </TableRow>

                        <TableRow className="border-border/60">
                          <TableCell className="py-2 text-xs font-medium">Acoustic</TableCell>
                          <TableCell className="py-2 text-xs tabular-nums">
                            {Math.round(breakdown.acousticStressScore)}/100 • {Math.round(breakdown.acousticFatigueScore)}/100
                          </TableCell>
                          <TableCell className="py-2 text-xs text-muted-foreground">
                            Confidence {Math.round(breakdown.acousticConfidence * 100)}%
                          </TableCell>
                        </TableRow>

                        {typeof breakdown.semanticStressScore === "number" && typeof breakdown.semanticFatigueScore === "number" ? (
                          <TableRow className="border-border/60">
                            <TableCell className="py-2 text-xs font-medium">Semantic</TableCell>
                            <TableCell className="py-2 text-xs tabular-nums">
                              {Math.round(breakdown.semanticStressScore)}/100 • {Math.round(breakdown.semanticFatigueScore)}/100
                            </TableCell>
                            <TableCell className="py-2 text-xs text-muted-foreground">
                              {typeof breakdown.semanticConfidence === "number"
                                ? `Confidence ${Math.round(breakdown.semanticConfidence * 100)}%${breakdown.semanticSource ? ` (${breakdown.semanticSource})` : ""}`
                                : ""}
                            </TableCell>
                          </TableRow>
                        ) : null}

                          <TableRow className="border-border/60">
                            <TableCell className="py-2 text-xs font-medium">Data quality</TableCell>
                            <TableCell className="py-2 text-xs tabular-nums">
                            {breakdown.quality && breakdown.hasFiniteQuality
                              ? `${Math.round(breakdown.quality.quality * 100)}%`
                              : "—"}
                            </TableCell>
                            <TableCell className="py-2 text-xs text-muted-foreground">
                            {breakdown.affectsTrend
                              ? "Included in trends"
                              : breakdown.quality && !breakdown.hasFiniteQuality
                                ? "Excluded from trends (invalid quality)"
                                : "Excluded from trends (low quality)"}
                            </TableCell>
                          </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-border/60 bg-background/30 p-3">
                      <p className="text-xs font-medium text-muted-foreground">Heuristic stress (feature contributions)</p>
                      <div className="mt-2 rounded-md border border-border/60 overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-border/60">
                              <TableHead className="text-xs text-muted-foreground">Feature</TableHead>
                              <TableHead className="text-xs text-muted-foreground">Rule</TableHead>
                              <TableHead className="text-xs text-muted-foreground text-right">+%</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {breakdown.stressHeuristic.rows.map((row) => (
                              <TableRow key={row.label} className="border-border/60">
                                <TableCell className="py-2 text-xs">
                                  <div className="font-medium text-foreground/90">{row.label}</div>
                                  <div className="text-[11px] text-muted-foreground tabular-nums">{row.value}</div>
                                </TableCell>
                                <TableCell className="py-2 text-xs text-muted-foreground tabular-nums">{row.rule}</TableCell>
                                <TableCell className="py-2 text-xs tabular-nums text-right">
                                  <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/15 px-2 py-0.5 text-muted-foreground">
                                    {row.contributionPct}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground/80">
                        Heuristic score: {breakdown.stressHeuristic.score}/100 (from thresholds + weights)
                      </p>
                    </div>

                    <div className="rounded-lg border border-border/60 bg-background/30 p-3">
                      <p className="text-xs font-medium text-muted-foreground">Heuristic fatigue (feature contributions)</p>
                      <div className="mt-2 rounded-md border border-border/60 overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-border/60">
                              <TableHead className="text-xs text-muted-foreground">Feature</TableHead>
                              <TableHead className="text-xs text-muted-foreground">Rule</TableHead>
                              <TableHead className="text-xs text-muted-foreground text-right">+%</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {breakdown.fatigueHeuristic.rows.map((row) => (
                              <TableRow key={row.label} className="border-border/60">
                                <TableCell className="py-2 text-xs">
                                  <div className="font-medium text-foreground/90">{row.label}</div>
                                  <div className="text-[11px] text-muted-foreground tabular-nums">{row.value}</div>
                                </TableCell>
                                <TableCell className="py-2 text-xs text-muted-foreground tabular-nums">{row.rule}</TableCell>
                                <TableCell className="py-2 text-xs tabular-nums text-right">
                                  <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/15 px-2 py-0.5 text-muted-foreground">
                                    {row.contributionPct}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground/80">
                        Heuristic score: {breakdown.fatigueHeuristic.score}/100 (from thresholds + weights)
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {metrics?.explanations?.mode === "baseline" ? (
                      <span className="inline-flex items-center rounded-full border border-border/60 bg-background/30 px-2 py-1">
                        Baseline blend: stress 65% / 35%, fatigue 70% / 30%
                      </span>
                    ) : null}
                    {calibration ? (
                      <span className="inline-flex items-center rounded-full border border-border/60 bg-background/30 px-2 py-1">
                        Calibration: stress bias {calibration.stressBias >= 0 ? "+" : ""}
                        {calibration.stressBias}, scale {formatNumber(calibration.stressScale, 2)} • fatigue bias {calibration.fatigueBias >= 0 ? "+" : ""}
                        {calibration.fatigueBias}, scale {formatNumber(calibration.fatigueScale, 2)}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Feature table */}
              {features ? (
                <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Measured features (this check-in)</p>
                      <p className="mt-1 text-xs text-muted-foreground/80">
                        Values are raw-ish signals; comparisons are most meaningful.
                      </p>
                    </div>
                    {!baseline ? (
                      <Badge variant="outline" className="bg-muted/10 border-border/60 text-muted-foreground">
                        No baseline
                      </Badge>
                    ) : null}
                  </div>

                  <div className="mt-3 rounded-lg border border-border/60 bg-background/30 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border/60">
                          <TableHead className="text-xs text-muted-foreground">Biomarker</TableHead>
                          <TableHead className="text-xs text-muted-foreground">This check-in</TableHead>
                          <TableHead className="text-xs text-muted-foreground">Vs baseline</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {FEATURE_DEFS.map((def) => {
                          const current = features[def.key]
                          const base = baseline?.[def.key]
                          const delta = typeof base === "number" ? current - base : null
                          const formatted = def.format ? def.format(current) : formatNumber(current)
                          const formattedDelta =
                            delta === null
                              ? "—"
                              : def.deltaFormat
                                ? def.deltaFormat(delta)
                                : formatSigned(delta)

                          return (
                            <TableRow key={def.key} className="border-border/60">
                              <TableCell className="py-2">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="text-left text-xs font-medium text-foreground/90 hover:text-foreground"
                                    >
                                      {def.label}
                                      <span className="ml-2 text-[11px] text-muted-foreground/70">{def.unit ?? ""}</span>
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>{def.description}</TooltipContent>
                                </Tooltip>
                              </TableCell>
                              <TableCell className="py-2 text-xs tabular-nums text-foreground/90">
                                {formatted}
                              </TableCell>
                              <TableCell className="py-2 text-xs tabular-nums">
                                <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/15 px-2 py-0.5 text-muted-foreground">
                                  {formattedDelta}
                                </span>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {!baseline ? (
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        Want personal “vs you” comparisons? Set a baseline.
                      </p>
                      <Badge
                        asChild
                        variant="outline"
                        className="bg-muted/10 border-border/60 text-muted-foreground hover:bg-muted/20"
                      >
                        <Link href="/settings">Calibrate baseline</Link>
                      </Badge>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* MFCC signature */}
              {mfcc.length > 0 ? (
                <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
                  <p className="text-xs font-medium text-muted-foreground">Timbre signature (MFCC)</p>
                  <p className="mt-1 text-xs text-muted-foreground/80">
                    A compact fingerprint of voice timbre. Shown as coefficient magnitudes (1–12).
                  </p>

                  <div className="mt-3 rounded-lg border border-border/60 bg-background/30 p-3">
                    <div className="grid grid-cols-12 gap-1 items-end h-14">
                      {(() => {
                        const mags = mfcc.map((v) => Math.abs(v))
                        const max = Math.max(0.001, ...mags)
                        return mfcc.map((v, idx) => {
                          const h = Math.max(0.12, Math.abs(v) / max)
                          return (
                            <div
                              key={idx}
                              className="rounded-sm bg-accent/50"
                              style={{ height: `${Math.round(h * 100)}%` }}
                              aria-hidden
                            />
                          )
                        })
                      })()}
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground/70">Not diagnostic. Used for pattern tracking.</p>
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
