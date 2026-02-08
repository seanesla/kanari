"use client"

import { useEffect, useState } from "react"
import { Clock, Calendar, Coffee, Dumbbell, Brain, Users, Moon, CheckCircle2, X, CalendarPlus, ChevronDown, Info, AlertTriangle, TrendingUp, TrendingDown, Minus } from "@/lib/icons"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { formatScheduledTime } from "@/lib/date-utils"
import { useTimeZone } from "@/lib/timezone-context"
import { EffectivenessFeedbackDialog } from "./effectiveness-feedback-dialog"
import type {
  AudioFeatures,
  BurnoutPrediction,
  EffectivenessFeedback,
  HistoricalContext,
  RecurringMutationScope,
  Suggestion,
  SuggestionCategory,
  VoicePatterns,
} from "@/lib/types"

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
  onDismiss?: (suggestion: Suggestion, scope?: RecurringMutationScope) => void
  /** @deprecated Use onCompleteWithFeedback instead for the full flow with feedback collection */
  onComplete?: (suggestion: Suggestion) => void
  /**
   * Called when a suggestion is marked complete with effectiveness feedback.
   * This is the preferred completion flow - shows a feedback dialog after the user clicks "Mark Complete".
   */
  onCompleteWithFeedback?: (suggestion: Suggestion, feedback: EffectivenessFeedback) => void
  isCalendarConnected?: boolean
  // Enriched context for "Why this suggestion?"
  voicePatterns?: VoicePatterns
  history?: HistoricalContext
  burnoutPrediction?: BurnoutPrediction
  features?: AudioFeatures
  allSuggestions?: Suggestion[]
}

export function SuggestionDetailDialog({
  suggestion,
  open,
  onOpenChange,
  onSchedule,
  onAccept,
  onDismiss,
  onComplete,
  onCompleteWithFeedback,
  isCalendarConnected: _isCalendarConnected = false,
  voicePatterns,
  history,
  burnoutPrediction,
  features,
  allSuggestions = [],
}: SuggestionDetailDialogProps) {
  const { timeZone } = useTimeZone()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showRawValues, setShowRawValues] = useState(false)

  // State for tracking the feedback dialog flow
  // When user clicks "Mark Complete", we first show the feedback dialog
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false)
  // Store the suggestion being completed while feedback dialog is open
  const [completingSuggestion, setCompletingSuggestion] = useState<Suggestion | null>(null)
  const [showCancelEventConfirm, setShowCancelEventConfirm] = useState(false)
  const [cancelScope, setCancelScope] = useState<RecurringMutationScope>("single")

  const Icon = suggestion ? categoryIcons[suggestion.category] : Coffee
  const colors = suggestion ? categoryColors[suggestion.category] : categoryColors.break
  const isPending = suggestion?.status === "pending"
  const isScheduled = suggestion?.status === "scheduled"
  const isCompleted = suggestion?.status === "accepted" || suggestion?.status === "completed"
  const isDismissed = suggestion?.status === "dismissed"

  const seriesSuggestions = suggestion?.seriesId
    ? allSuggestions.filter((candidate) => candidate.seriesId === suggestion.seriesId)
    : []

  const hasRecurringSeries = suggestion != null && seriesSuggestions.length > 1
  const futureSeriesOccurrences = hasRecurringSeries && suggestion?.scheduledFor
    ? seriesSuggestions.filter((candidate) => {
        if (candidate.id === suggestion.id) return false
        if (candidate.status === "dismissed") return false
        if (!candidate.scheduledFor) return false
        return new Date(candidate.scheduledFor).getTime() > new Date(suggestion.scheduledFor!).getTime()
      }).length
    : 0
  const canCancelFuture = futureSeriesOccurrences > 0

  /**
   * Handle the "Mark Complete" button click.
   * If onCompleteWithFeedback is provided, show the feedback dialog first.
   * Otherwise, fall back to the legacy onComplete callback.
   */
  const handleMarkComplete = () => {
    if (!suggestion) return
    if (onCompleteWithFeedback) {
      // New flow: close the detail dialog and show feedback dialog
      setCompletingSuggestion(suggestion)
      onOpenChange(false) // Close the detail dialog
      setShowFeedbackDialog(true) // Show feedback dialog
    } else if (onComplete) {
      // Legacy flow: complete without feedback
      onComplete(suggestion)
    }
  }

  /**
   * Handle feedback submission from the effectiveness dialog.
   * Completes the suggestion with the user's feedback.
   */
  const handleFeedbackSubmit = (feedback: EffectivenessFeedback) => {
    if (completingSuggestion && onCompleteWithFeedback) {
      onCompleteWithFeedback(completingSuggestion, feedback)
    }
    // Reset state
    setCompletingSuggestion(null)
    setShowFeedbackDialog(false)
  }

  /**
   * Handle feedback dialog close/skip.
   * Resets the feedback flow state.
   */
  const handleFeedbackDialogClose = (open: boolean) => {
    if (!open) {
      setShowFeedbackDialog(false)
      setCompletingSuggestion(null)
    }
  }

  useEffect(() => {
    if (!open) {
      setShowCancelEventConfirm(false)
      setCancelScope("single")
    }
  }, [open])

  const handleRequestCancelEvent = () => {
    setCancelScope("single")
    setShowCancelEventConfirm(true)
  }

  const handleConfirmCancelEvent = () => {
    if (!suggestion) return
    onDismiss?.(suggestion, cancelScope)
  }

  // IMPORTANT: Don't early-return on `!suggestion` while the feedback dialog is open.
  // The parent clears `suggestion` to close the detail dialog, but we still need to
  // render the feedback dialog immediately (otherwise it appears only after a second click).
  // Pattern doc: docs/error-patterns/suggestion-complete-feedback-dialog-hidden.md
  if (!suggestion && !showFeedbackDialog) return null

  return (
  <>
    {suggestion ? (
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
                      Based on {history.recordingCount} check-ins over {history.daysOfData} days
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
              <span>{formatScheduledTime(suggestion.scheduledFor, timeZone)}</span>
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
                onClick={() => {
                  // Accept = schedule immediately (parent decides exact scheduling behavior).
                  onOpenChange(false)
                  onAccept?.(suggestion)
                }}
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
                onClick={() => onSchedule?.(suggestion)}
              >
                <CalendarPlus className="h-4 w-4 mr-2" />
                Reschedule
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRequestCancelEvent}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel Event
              </Button>
              <Button
                size="sm"
                onClick={handleMarkComplete}
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
    ) : null}

    <AlertDialog open={showCancelEventConfirm} onOpenChange={setShowCancelEventConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{hasRecurringSeries ? "Cancel recurring event?" : "Cancel this event?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {hasRecurringSeries
              ? "Choose how broadly this cancellation should apply."
              : "This will remove the scheduled activity from your calendar timeline."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasRecurringSeries ? (
          <RadioGroup
            value={cancelScope}
            onValueChange={(value) => setCancelScope(value as RecurringMutationScope)}
            className="gap-3"
          >
            <label className="flex items-start gap-3 rounded-md border border-border/70 p-3 cursor-pointer">
              <RadioGroupItem value="single" id="cancel-scope-single" className="mt-0.5" />
              <div>
                <p className="text-sm font-medium">This event only</p>
                <p className="text-xs text-muted-foreground">Cancel just this occurrence.</p>
              </div>
            </label>

            {canCancelFuture ? (
              <label className="flex items-start gap-3 rounded-md border border-border/70 p-3 cursor-pointer">
                <RadioGroupItem value="future" id="cancel-scope-future" className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">This and future</p>
                  <p className="text-xs text-muted-foreground">
                    Cancel this occurrence and {futureSeriesOccurrences} upcoming one{futureSeriesOccurrences === 1 ? "" : "s"}.
                  </p>
                </div>
              </label>
            ) : null}

            <label className="flex items-start gap-3 rounded-md border border-border/70 p-3 cursor-pointer">
              <RadioGroupItem value="all" id="cancel-scope-all" className="mt-0.5" />
              <div>
                <p className="text-sm font-medium">Entire series</p>
                <p className="text-xs text-muted-foreground">Cancel every remaining occurrence in this series.</p>
              </div>
            </label>
          </RadioGroup>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel>Keep Event</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmCancelEvent}
            className="bg-destructive text-white hover:bg-destructive/92"
          >
            {cancelScope === "single"
              ? "Yes, cancel event"
              : cancelScope === "future"
                ? "Yes, cancel future"
                : "Yes, cancel series"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Effectiveness Feedback Dialog - shown after user clicks "Mark Complete" */}
    <EffectivenessFeedbackDialog
      suggestion={completingSuggestion}
      open={showFeedbackDialog}
      onOpenChange={handleFeedbackDialogClose}
      onSubmit={handleFeedbackSubmit}
    />
  </>
  )
}
