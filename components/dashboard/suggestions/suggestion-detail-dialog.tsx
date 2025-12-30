"use client"

import { useState } from "react"
import { Clock, Calendar, Coffee, Dumbbell, Brain, Users, Moon, CheckCircle2, X, CalendarPlus, ChevronDown, Info, AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { formatScheduledTime } from "@/lib/date-utils"
import type { Suggestion, SuggestionCategory, VoicePatterns, HistoricalContext, BurnoutPrediction, AudioFeatures } from "@/lib/types"

const categoryIcons: Record<SuggestionCategory, typeof Coffee> = {
  break: Coffee,
  exercise: Dumbbell,
  mindfulness: Brain,
  social: Users,
  rest: Moon,
}

const categoryColors: Record<SuggestionCategory, { text: string; bg: string }> = {
  break: { text: "text-accent", bg: "bg-accent/10" },
  exercise: { text: "text-green-500", bg: "bg-green-500/10" },
  mindfulness: { text: "text-purple-500", bg: "bg-purple-500/10" },
  social: { text: "text-blue-500", bg: "bg-blue-500/10" },
  rest: { text: "text-indigo-500", bg: "bg-indigo-500/10" },
}

interface SuggestionDetailDialogProps {
  suggestion: Suggestion | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSchedule?: (suggestion: Suggestion) => void
  onAccept?: (suggestion: Suggestion) => void
  onDismiss?: (suggestion: Suggestion) => void
  onComplete?: (suggestion: Suggestion) => void
  isCalendarConnected?: boolean
  // Enriched context for "Why this suggestion?"
  voicePatterns?: VoicePatterns
  history?: HistoricalContext
  burnoutPrediction?: BurnoutPrediction
  features?: AudioFeatures
}

export function SuggestionDetailDialog({
  suggestion,
  open,
  onOpenChange,
  onSchedule,
  onAccept,
  onDismiss,
  onComplete,
  isCalendarConnected = false,
  voicePatterns,
  history,
  burnoutPrediction,
  features,
}: SuggestionDetailDialogProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showRawValues, setShowRawValues] = useState(false)

  if (!suggestion) return null

  const Icon = categoryIcons[suggestion.category]
  const colors = categoryColors[suggestion.category]
  const isPending = suggestion.status === "pending"
  const isScheduled = suggestion.status === "scheduled"
  const isCompleted = suggestion.status === "accepted" || suggestion.status === "completed"
  const isDismissed = suggestion.status === "dismissed"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/70 bg-card/95 backdrop-blur-xl max-w-lg">
        <DialogHeader>
          {/* Category badge */}
          <div className="flex items-center gap-3 mb-2">
            <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", colors.bg)}>
              <Icon className={cn("h-5 w-5", colors.text)} />
            </div>
            <div>
              <Badge variant="secondary" className={cn("capitalize", colors.text)}>
                {suggestion.category}
              </Badge>
            </div>
          </div>

          <DialogTitle className="text-lg leading-snug pr-8">
            {suggestion.content}
          </DialogTitle>

          <DialogDescription className="text-sm text-muted-foreground mt-2">
            {suggestion.rationale}
          </DialogDescription>
        </DialogHeader>

        {/* Why this suggestion? */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full">
            <Info className="h-4 w-4" />
            Why this suggestion?
            <ChevronDown className={cn("h-4 w-4 transition-transform", showAdvanced && "rotate-180")} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3 text-sm">
            {/* Voice patterns detected */}
            {voicePatterns ? (
              <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Voice patterns detected</p>
                <p className="text-foreground">
                  {voicePatterns.speechRate === "fast" ? "Fast" : voicePatterns.speechRate === "slow" ? "Slow" : "Normal"} speech, {voicePatterns.energyLevel} energy, {voicePatterns.pauseFrequency} pauses, {voicePatterns.voiceTone} tone
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Voice patterns detected</p>
                <p className="text-muted-foreground">Analysis based on your voice biomarkers</p>
              </div>
            )}

            {/* Historical comparison */}
            {history && history.recordingCount > 1 && (
              <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Compared to your baseline</p>
                <div className="text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <span>Stress:</span>
                    <span className={cn(
                      history.stressChange.startsWith("+") ? "text-destructive" :
                      history.stressChange.startsWith("-") ? "text-success" :
                      "text-muted-foreground"
                    )}>
                      {history.stressChange}
                    </span>
                    {history.stressChange.startsWith("+") && <TrendingUp className="h-3 w-3 text-destructive" />}
                    {history.stressChange.startsWith("-") && <TrendingDown className="h-3 w-3 text-success" />}
                    {history.stressChange === "stable" && <Minus className="h-3 w-3 text-muted-foreground" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Fatigue:</span>
                    <span className={cn(
                      history.fatigueChange.startsWith("+") ? "text-destructive" :
                      history.fatigueChange.startsWith("-") ? "text-success" :
                      "text-muted-foreground"
                    )}>
                      {history.fatigueChange}
                    </span>
                    {history.fatigueChange.startsWith("+") && <TrendingUp className="h-3 w-3 text-destructive" />}
                    {history.fatigueChange.startsWith("-") && <TrendingDown className="h-3 w-3 text-success" />}
                    {history.fatigueChange === "stable" && <Minus className="h-3 w-3 text-muted-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Based on {history.recordingCount} recordings over {history.daysOfData} days
                  </p>
                </div>
              </div>
            )}

            {/* Burnout warning */}
            {burnoutPrediction && (burnoutPrediction.riskLevel === "moderate" || burnoutPrediction.riskLevel === "high" || burnoutPrediction.riskLevel === "critical") && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 space-y-1">
                <p className="font-medium text-xs uppercase tracking-wide text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Burnout risk: {burnoutPrediction.riskLevel}
                </p>
                <p className="text-sm">Predicted in {burnoutPrediction.predictedDays} days if patterns continue</p>
                {burnoutPrediction.factors.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {burnoutPrediction.factors.map((factor, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs border-destructive/50 text-destructive">
                        {factor}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Advanced: Raw values toggle */}
            {features && (
              <>
                <button
                  onClick={() => setShowRawValues(!showRawValues)}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  {showRawValues ? "Hide" : "Show"} raw values
                </button>
                {showRawValues && (
                  <div className="rounded-lg bg-muted/30 p-3 font-mono text-xs space-y-1">
                    <div>Speech rate: {features.speechRate.toFixed(2)} syl/s</div>
                    <div>RMS energy: {features.rms.toFixed(4)}</div>
                    <div>Pause ratio: {(features.pauseRatio * 100).toFixed(1)}%</div>
                    <div>Avg pause: {features.avgPauseDuration.toFixed(0)} ms</div>
                    <div>Spectral centroid: {features.spectralCentroid.toFixed(4)}</div>
                    <div>Spectral flux: {features.spectralFlux.toFixed(4)}</div>
                    <div>ZCR: {features.zcr.toFixed(4)}</div>
                  </div>
                )}
              </>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-4 py-4 border-y border-border/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{suggestion.duration} minutes</span>
          </div>

          {isScheduled && suggestion.scheduledFor && (
            <div className="flex items-center gap-2 text-sm text-blue-500">
              <Calendar className="h-4 w-4" />
              <span>{formatScheduledTime(suggestion.scheduledFor)}</span>
            </div>
          )}

          {isCompleted && (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" />
              <span>Completed</span>
            </div>
          )}

          {isDismissed && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <X className="h-4 w-4" />
              <span>Dismissed</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isPending && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDismiss?.(suggestion)}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4 mr-2" />
                Dismiss
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAccept?.(suggestion)}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Accept
              </Button>
              <Button
                size="sm"
                onClick={() => onSchedule?.(suggestion)}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <CalendarPlus className="h-4 w-4 mr-2" />
                Schedule
              </Button>
            </>
          )}

          {isScheduled && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDismiss?.(suggestion)}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => onComplete?.(suggestion)}
                className="bg-success text-success-foreground hover:bg-success/90"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark Complete
              </Button>
            </>
          )}

          {(isCompleted || isDismissed) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
