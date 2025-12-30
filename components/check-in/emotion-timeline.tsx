"use client"

/**
 * Emotion Timeline Component
 *
 * Visualizes emotion segments detected by Gemini semantic analysis.
 * Each segment shows a timestamp, transcribed speech, and detected emotion.
 *
 * Features:
 * - Color-coded emotion indicators (happy=green, sad=blue, angry=red, neutral=gray)
 * - Timeline visualization showing emotion flow throughout the recording
 * - Expandable segment details with full transcript
 * - Overall emotion summary with confidence score
 * - Animated transitions using Framer Motion
 *
 * Usage:
 * ```tsx
 * <EmotionTimeline
 *   analysis={recording.semanticAnalysis}
 *   onSegmentClick={(segment) => console.log('Clicked:', segment)}
 * />
 * ```
 */

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight, Info, MessageSquare } from "lucide-react"
import type { GeminiSemanticAnalysis, SemanticSegment, EmotionType } from "@/lib/types"

// ============================================
// Emotion Configuration
// ============================================

/**
 * Configuration for each emotion type including:
 * - emoji: Visual representation
 * - label: Human-readable name
 * - color: Tailwind text color class
 * - bgColor: Tailwind background color class
 * - borderColor: Tailwind border color class
 */
const EMOTION_CONFIG: Record<EmotionType, {
  emoji: string
  label: string
  color: string
  bgColor: string
  borderColor: string
}> = {
  happy: {
    emoji: "😊",
    label: "Happy",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
  },
  sad: {
    emoji: "😢",
    label: "Sad",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
  },
  angry: {
    emoji: "😤",
    label: "Frustrated",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
  },
  neutral: {
    emoji: "😐",
    label: "Neutral",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    borderColor: "border-muted-foreground/30",
  },
}

// ============================================
// Component Props
// ============================================

interface EmotionTimelineProps {
  /** The semantic analysis data from Gemini */
  analysis: GeminiSemanticAnalysis
  /** Optional callback when a segment is clicked */
  onSegmentClick?: (segment: SemanticSegment) => void
  /** Whether to show the observations section */
  showObservations?: boolean
  /** Whether to start expanded */
  defaultExpanded?: boolean
  /** Additional CSS classes */
  className?: string
}

// ============================================
// Sub-Components
// ============================================

/**
 * EmotionBadge - Small badge showing emotion emoji and label
 *
 * Used in the overall emotion header and inline with segments.
 */
function EmotionBadge({
  emotion,
  size = "default",
  showLabel = true,
  className,
}: {
  emotion: EmotionType
  size?: "small" | "default" | "large"
  showLabel?: boolean
  className?: string
}) {
  const config = EMOTION_CONFIG[emotion]

  const sizeClasses = {
    small: "px-1.5 py-0.5 text-xs gap-1",
    default: "px-2 py-1 text-sm gap-1.5",
    large: "px-3 py-1.5 text-base gap-2",
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        config.bgColor,
        config.color,
        sizeClasses[size],
        className
      )}
    >
      <span>{config.emoji}</span>
      {showLabel && <span className="capitalize">{config.label}</span>}
    </span>
  )
}

/**
 * SegmentCard - Individual segment in the timeline
 *
 * Shows timestamp, emotion indicator, and transcript content.
 * Can be expanded to show full text if truncated.
 */
function SegmentCard({
  segment,
  isLast,
  onClick,
}: {
  segment: SemanticSegment
  isLast: boolean
  onClick?: () => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const config = EMOTION_CONFIG[segment.emotion]

  // Check if content is long enough to need truncation
  const needsTruncation = segment.content.length > 100
  const displayContent = isExpanded || !needsTruncation
    ? segment.content
    : segment.content.slice(0, 100) + "..."

  return (
    <motion.div
      className="relative flex gap-3"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Timeline connector line */}
      {!isLast && (
        <div
          className={cn(
            "absolute left-[11px] top-6 bottom-0 w-0.5",
            config.bgColor
          )}
        />
      )}

      {/* Emotion dot indicator */}
      <div className="relative z-10 flex-shrink-0">
        <div
          className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center text-sm",
            config.bgColor,
            config.borderColor,
            "border-2"
          )}
        >
          {config.emoji}
        </div>
      </div>

      {/* Segment content */}
      <div
        className={cn(
          "flex-1 pb-4 cursor-pointer group",
          onClick && "hover:opacity-80"
        )}
        onClick={() => {
          if (needsTruncation) {
            setIsExpanded(!isExpanded)
          }
          onClick?.()
        }}
      >
        {/* Header row: timestamp and emotion */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono text-muted-foreground">
            {segment.timestamp}
          </span>
          <EmotionBadge emotion={segment.emotion} size="small" />
        </div>

        {/* Transcript content */}
        <div
          className={cn(
            "text-sm rounded-lg p-3 border",
            config.bgColor,
            config.borderColor
          )}
        >
          <p className="text-foreground leading-relaxed">{displayContent}</p>

          {/* Expand/collapse hint */}
          {needsTruncation && (
            <button
              className="mt-2 text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                setIsExpanded(!isExpanded)
              }}
            >
              {isExpanded ? (
                <>
                  <ChevronDown className="w-3 h-3" />
                  <span>Show less</span>
                </>
              ) : (
                <>
                  <ChevronRight className="w-3 h-3" />
                  <span>Show more</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

/**
 * ObservationItem - Displays a single observation from the analysis
 *
 * Shows observation type (stress_cue, fatigue_cue, positive_cue),
 * the observation text, and relevance level.
 */
function ObservationItem({
  observation,
}: {
  observation: {
    type: "stress_cue" | "fatigue_cue" | "positive_cue"
    observation: string
    relevance: "high" | "medium" | "low"
  }
}) {
  // Map observation types to visual styles
  const typeConfig = {
    stress_cue: {
      label: "Stress Indicator",
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    fatigue_cue: {
      label: "Fatigue Indicator",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    positive_cue: {
      label: "Positive Sign",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
  }

  // Map relevance to opacity/emphasis
  const relevanceConfig = {
    high: "font-medium",
    medium: "font-normal",
    low: "font-normal text-muted-foreground",
  }

  const config = typeConfig[observation.type]

  return (
    <div className="flex items-start gap-2 text-sm">
      <span
        className={cn(
          "flex-shrink-0 px-2 py-0.5 rounded text-xs",
          config.bgColor,
          config.color
        )}
      >
        {config.label}
      </span>
      <p className={relevanceConfig[observation.relevance]}>
        {observation.observation}
      </p>
    </div>
  )
}

// ============================================
// Main Component
// ============================================

/**
 * EmotionTimeline - Main timeline visualization component
 *
 * Displays:
 * 1. Overall emotion header with confidence score
 * 2. Expandable timeline of emotion segments
 * 3. Optional observations section with stress/fatigue cues
 * 4. Summary interpretation from Gemini
 */
export function EmotionTimeline({
  analysis,
  onSegmentClick,
  showObservations = true,
  defaultExpanded = false,
  className,
}: EmotionTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  // Calculate emotion distribution for mini-chart
  const emotionDistribution = useMemo(() => {
    const counts: Record<EmotionType, number> = {
      happy: 0,
      sad: 0,
      angry: 0,
      neutral: 0,
    }

    analysis.segments.forEach((segment) => {
      counts[segment.emotion]++
    })

    const total = analysis.segments.length || 1
    return Object.entries(counts).map(([emotion, count]) => ({
      emotion: emotion as EmotionType,
      count,
      percentage: Math.round((count / total) * 100),
    }))
  }, [analysis.segments])

  // Filter observations by relevance for display
  const sortedObservations = useMemo(() => {
    const relevanceOrder = { high: 0, medium: 1, low: 2 }
    return [...analysis.observations].sort(
      (a, b) => relevanceOrder[a.relevance] - relevanceOrder[b.relevance]
    )
  }, [analysis.observations])

  return (
    <div className={cn("rounded-lg border bg-card/50", className)}>
      {/* Header section - always visible */}
      <button
        className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors rounded-t-lg"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-label="Toggle emotion timeline details"
      >
        <div className="flex items-center gap-3">
          {/* Overall emotion badge */}
          <EmotionBadge emotion={analysis.overallEmotion} size="large" />

          {/* Confidence indicator */}
          <div className="text-left">
            <p className="text-xs text-muted-foreground">
              Confidence: {Math.round(analysis.emotionConfidence * 100)}%
            </p>
            <p className="text-xs text-muted-foreground">
              {analysis.segments.length} segment
              {analysis.segments.length !== 1 ? "s" : ""} analyzed
            </p>
          </div>
        </div>

        {/* Expand/collapse icon */}
        <div className="flex items-center gap-2">
          {/* Mini emotion distribution bar */}
          <div className="hidden sm:flex h-2 w-20 rounded-full overflow-hidden bg-muted">
            {emotionDistribution
              .filter((d) => d.percentage > 0)
              .map((d) => (
                <div
                  key={d.emotion}
                  className={cn(
                    "h-full",
                    EMOTION_CONFIG[d.emotion].bgColor.replace("/10", "/60")
                  )}
                  style={{ width: `${d.percentage}%` }}
                  title={`${EMOTION_CONFIG[d.emotion].label}: ${d.percentage}%`}
                />
              ))}
          </div>

          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          </motion.div>
        </div>
      </button>

      {/* Expandable content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              {/* Divider */}
              <div className="border-t border-border/50" />

              {/* Summary section */}
              {analysis.summary && (
                <div className="rounded-lg bg-muted/30 p-3">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground italic">
                      "{analysis.summary}"
                    </p>
                  </div>
                </div>
              )}

              {/* Segment timeline */}
              {analysis.segments.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                    Emotion Timeline
                  </p>
                  <div className="space-y-0">
                    {analysis.segments.map((segment, index) => (
                      <SegmentCard
                        key={`${segment.timestamp}-${index}`}
                        segment={segment}
                        isLast={index === analysis.segments.length - 1}
                        onClick={() => onSegmentClick?.(segment)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Interpretations section */}
              {(analysis.stressInterpretation || analysis.fatigueInterpretation) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {analysis.stressInterpretation && (
                    <div className="rounded-lg bg-orange-500/5 border border-orange-500/20 p-3">
                      <p className="text-xs font-medium text-orange-500 mb-1">
                        Stress Analysis
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {analysis.stressInterpretation}
                      </p>
                    </div>
                  )}
                  {analysis.fatigueInterpretation && (
                    <div className="rounded-lg bg-purple-500/5 border border-purple-500/20 p-3">
                      <p className="text-xs font-medium text-purple-500 mb-1">
                        Fatigue Analysis
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {analysis.fatigueInterpretation}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Observations section */}
              {showObservations && sortedObservations.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4 text-muted-foreground" />
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Key Observations
                    </p>
                  </div>
                  <div className="space-y-2">
                    {sortedObservations.map((obs, index) => (
                      <ObservationItem key={index} observation={obs} />
                    ))}
                  </div>
                </div>
              )}

              {/* Emotion distribution legend */}
              <div className="flex flex-wrap gap-3 pt-2 border-t border-border/50">
                {emotionDistribution
                  .filter((d) => d.count > 0)
                  .map((d) => (
                    <div
                      key={d.emotion}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      <span>{EMOTION_CONFIG[d.emotion].emoji}</span>
                      <span className="capitalize">
                        {EMOTION_CONFIG[d.emotion].label}:
                      </span>
                      <span className="font-medium text-foreground">
                        {d.count} ({d.percentage}%)
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * EmotionTimelineCompact - Simplified inline version
 *
 * Shows just the overall emotion and segment count.
 * Useful for displaying in cards or list items.
 */
export function EmotionTimelineCompact({
  analysis,
  className,
}: {
  analysis: GeminiSemanticAnalysis
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <EmotionBadge emotion={analysis.overallEmotion} size="small" />
      <span className="text-xs text-muted-foreground">
        {analysis.segments.length} segment
        {analysis.segments.length !== 1 ? "s" : ""}
      </span>
      <span className="text-xs text-muted-foreground">
        ({Math.round(analysis.emotionConfidence * 100)}% confident)
      </span>
    </div>
  )
}

// Export EMOTION_CONFIG for use in other components
export { EMOTION_CONFIG }
export type { EmotionTimelineProps }
