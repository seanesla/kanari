"use client"

import { Badge } from "@/components/ui/badge"
import { Sparkles, MessageSquare, AlertTriangle, Battery, TrendingUp } from "lucide-react"
import type {
  GeminiSemanticAnalysis,
  TranscriptSegment,
  SemanticObservation,
  EmotionType,
  ObservationType,
  ObservationRelevance,
} from "@/lib/types"

interface SemanticAnalysisProps {
  analysis: GeminiSemanticAnalysis
}

/**
 * Display Gemini's semantic analysis of audio recording
 *
 * Shows transcription, emotion detection, and qualitative observations
 * about stress and fatigue indicators.
 */
export function SemanticAnalysis({ analysis }: SemanticAnalysisProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold">Gemini Semantic Analysis</h2>
        </div>
        <Badge variant="outline" className="border-accent/30 bg-accent/10 text-accent">
          Analyzed by Gemini 3 Flash
        </Badge>
      </div>

      {/* Transcript Timeline */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Transcript Timeline</h3>
        </div>

        <div className="space-y-3">
          {analysis.segments.map((segment, index) => (
            <TranscriptSegmentItem key={index} segment={segment} />
          ))}
        </div>

        {/* Overall emotion summary */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Overall emotion:</span>
            <div className="flex items-center gap-2">
              <EmotionBadge emotion={analysis.overallEmotion} />
              <span className="text-sm text-muted-foreground">
                ({Math.round(analysis.emotionConfidence * 100)}% confidence)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Observations */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Semantic Observations</h3>
        </div>

        {analysis.observations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No significant observations detected.</p>
        ) : (
          <div className="space-y-2">
            {analysis.observations.map((observation, index) => (
              <ObservationItem key={index} observation={observation} />
            ))}
          </div>
        )}
      </div>

      {/* Interpretations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Stress Interpretation */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            <h3 className="font-medium text-sm">Stress Interpretation</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{analysis.stressInterpretation}</p>
        </div>

        {/* Fatigue Interpretation */}
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Battery className="h-4 w-4 text-blue-500" />
            <h3 className="font-medium text-sm">Fatigue Interpretation</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{analysis.fatigueInterpretation}</p>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-lg border border-accent/30 bg-accent/5 p-5">
        <h3 className="font-medium text-sm mb-2">Overall Assessment</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{analysis.summary}</p>
      </div>
    </div>
  )
}

/**
 * Individual transcript segment with timestamp and emotion
 */
function TranscriptSegmentItem({ segment }: { segment: TranscriptSegment }) {
  return (
    <div className="flex gap-3">
      <span className="text-xs text-muted-foreground font-mono mt-0.5 min-w-[3rem]">{segment.timestamp}</span>
      <div className="flex-1">
        <div className="flex items-start gap-2">
          <p className="text-sm flex-1">{segment.content}</p>
          <EmotionBadge emotion={segment.emotion} />
        </div>
      </div>
    </div>
  )
}

/**
 * Emotion badge with appropriate styling
 */
function EmotionBadge({ emotion }: { emotion: EmotionType }) {
  const styles = {
    happy: "bg-green-500/10 text-green-600 border-green-500/30",
    sad: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    angry: "bg-red-500/10 text-red-600 border-red-500/30",
    neutral: "bg-gray-500/10 text-gray-600 border-gray-500/30",
  }

  const icons = {
    happy: "😊",
    sad: "😔",
    angry: "😠",
    neutral: "😐",
  }

  return (
    <Badge variant="outline" className={`${styles[emotion]} text-xs`}>
      <span className="mr-1">{icons[emotion]}</span>
      {emotion}
    </Badge>
  )
}

/**
 * Observation item with type badge and relevance indicator
 */
function ObservationItem({ observation }: { observation: SemanticObservation }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-secondary/30 p-3">
      <div className="flex items-center gap-2">
        <ObservationTypeBadge type={observation.type} />
        <RelevanceIndicator relevance={observation.relevance} />
      </div>
      <p className="text-sm flex-1">{observation.observation}</p>
    </div>
  )
}

/**
 * Badge for observation type
 */
function ObservationTypeBadge({ type }: { type: ObservationType }) {
  const styles = {
    stress_cue: {
      className: "bg-orange-500/10 text-orange-600 border-orange-500/30",
      label: "Stress",
      icon: AlertTriangle,
    },
    fatigue_cue: {
      className: "bg-blue-500/10 text-blue-600 border-blue-500/30",
      label: "Fatigue",
      icon: Battery,
    },
    positive_cue: {
      className: "bg-green-500/10 text-green-600 border-green-500/30",
      label: "Positive",
      icon: TrendingUp,
    },
  }

  const config = styles[type]
  const Icon = config.icon

  return (
    <Badge variant="outline" className={`${config.className} text-xs gap-1`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}

/**
 * Relevance indicator (dots)
 */
function RelevanceIndicator({ relevance }: { relevance: ObservationRelevance }) {
  const dots = {
    high: 3,
    medium: 2,
    low: 1,
  }

  const dotCount = dots[relevance]

  return (
    <div className="flex items-center gap-0.5" title={`${relevance} relevance`}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${i < dotCount ? "bg-accent" : "bg-muted"}`}
        />
      ))}
    </div>
  )
}
