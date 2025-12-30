"use client"

import { useEffect, useState, useMemo } from "react"
import { Link } from "next-view-transitions"
import { Lightbulb, Mic, RefreshCw, ChevronDown, Calendar } from "lucide-react"
import { useDashboardAnimation } from "../layout"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Empty } from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { useCalendar } from "@/hooks/use-calendar"
import { useSuggestions, featuresToVoicePatterns, computeHistoricalContext } from "@/hooks/use-suggestions"
import { useRecordings } from "@/hooks/use-storage"
import { predictBurnoutRisk, recordingsToTrendData } from "@/lib/ml/forecasting"
import {
  KanbanBoard,
  CategoryFilterTabs,
  SuggestionDetailDialog,
  ScheduleTimeDialog,
  filterSuggestionsByCategory,
  countSuggestionsByCategory,
  type FilterValue,
} from "@/components/dashboard/suggestions"
import type { Suggestion, TrendDirection, SuggestionStatus } from "@/lib/types"

// Deduplication helper
function deduplicateSuggestions(suggestions: Suggestion[]): Suggestion[] {
  const seen = new Set<string>()
  const deduped: Suggestion[] = []

  for (const suggestion of suggestions) {
    // Create a key from category, duration, and first 20 chars of content
    const key = `${suggestion.category}-${Math.floor(suggestion.duration / 5)}-${suggestion.content.slice(0, 20)}`

    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(suggestion)
    }
  }

  return deduped
}

// Smart prioritization helper - ranks suggestions by relevance
function prioritizeSuggestions(suggestions: Suggestion[], metrics?: { stressLevel: string; fatigueLevel: string }): Suggestion[] {
  if (!metrics) return suggestions

  // Create a copy to avoid mutating original
  const sorted = [...suggestions]

  // Priority scoring based on current state
  const getRelevanceScore = (s: Suggestion): number => {
    let score = 0

    // High stress - prioritize breaks and mindfulness
    if (metrics.stressLevel === "high" || metrics.stressLevel === "elevated") {
      if (s.category === "break") score += 3
      if (s.category === "mindfulness") score += 2
    }

    // High fatigue - prioritize rest and exercise
    if (metrics.fatigueLevel === "exhausted" || metrics.fatigueLevel === "tired") {
      if (s.category === "rest") score += 3
      if (s.category === "exercise") score += 1
    }

    // Moderate state - prioritize social and exercise
    if (metrics.stressLevel === "moderate" && metrics.fatigueLevel === "normal") {
      if (s.category === "social") score += 2
      if (s.category === "exercise") score += 2
    }

    // Shorter activities get slight boost for quick wins
    if (s.duration <= 15) score += 1

    return score
  }

  sorted.sort((a, b) => {
    const scoreA = getRelevanceScore(a)
    const scoreB = getRelevanceScore(b)
    if (scoreA !== scoreB) return scoreB - scoreA
    // Fallback to creation time (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return sorted
}

export default function SuggestionsPage() {
  const { shouldAnimate } = useDashboardAnimation()
  const [visible, setVisible] = useState(!shouldAnimate)
  const [selectedCategory, setSelectedCategory] = useState<FilterValue>("all")
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null)
  const [scheduleDialogSuggestion, setScheduleDialogSuggestion] = useState<Suggestion | null>(null)
  const [showAllPending, setShowAllPending] = useState(false)

  const { isConnected, scheduleEvent } = useCalendar()

  // Get recordings for trend analysis (14 days for better predictions)
  const recordings = useRecordings(14)
  const latestRecording = recordings[0]

  // Compute actual trend and burnout prediction
  const { trend, burnoutPrediction } = useMemo(() => {
    if (recordings.length < 2) {
      return { trend: "stable" as TrendDirection, burnoutPrediction: null }
    }
    const trendData = recordingsToTrendData(recordings)
    const prediction = predictBurnoutRisk(trendData)
    return { trend: prediction.trend, burnoutPrediction: prediction }
  }, [recordings])

  // Compute voice patterns from latest recording features
  const voicePatterns = useMemo(() => {
    if (!latestRecording?.features) return undefined
    return featuresToVoicePatterns(latestRecording.features)
  }, [latestRecording?.features])

  // Compute historical context from all recordings
  const historyContext = useMemo(() => {
    return computeHistoricalContext(recordings)
  }, [recordings])

  // Real suggestions from Gemini API (now global, not recording-bound)
  const {
    suggestions,
    activeSuggestions,
    loading,
    error,
    lastDiffSummary,
    clearDiffSummary,
    moveSuggestion,
    scheduleSuggestion,
    dismissSuggestion,
    completeSuggestion,
    regenerateWithDiff,
  } = useSuggestions()

  // Trigger entry animation only on initial dashboard entry
  useEffect(() => {
    if (shouldAnimate) {
      const timer = setTimeout(() => setVisible(true), 100)
      return () => clearTimeout(timer)
    }
  }, [shouldAnimate])

  // Deduplicate and prioritize suggestions
  const processedSuggestions = useMemo(() => {
    // First deduplicate
    const deduped = deduplicateSuggestions(suggestions)

    // Separate by status
    const pending = deduped.filter(s => s.status === "pending")
    const nonPending = deduped.filter(s => s.status !== "pending")

    // Prioritize pending suggestions
    const prioritizedPending = prioritizeSuggestions(pending, latestRecording?.metrics)

    // Limit pending to top 5 unless showAllPending is true
    const limitedPending = showAllPending ? prioritizedPending : prioritizedPending.slice(0, 5)

    // Combine back together
    return [...limitedPending, ...nonPending]
  }, [suggestions, latestRecording?.metrics, showAllPending])

  // Count of hidden pending suggestions
  const hiddenPendingCount = useMemo(() => {
    const pending = suggestions.filter(s => s.status === "pending")
    const deduped = deduplicateSuggestions(pending)
    return Math.max(0, deduped.length - 5)
  }, [suggestions])

  // Filter suggestions by category
  const filteredSuggestions = useMemo(
    () => filterSuggestionsByCategory(processedSuggestions, selectedCategory),
    [processedSuggestions, selectedCategory]
  )

  // Category counts (use processed suggestions)
  const categoryCounts = useMemo(
    () => countSuggestionsByCategory(processedSuggestions),
    [processedSuggestions]
  )

  // Handle regenerate suggestions with diff-aware mode
  const handleRegenerate = async () => {
    if (latestRecording?.metrics) {
      await regenerateWithDiff(latestRecording.metrics, trend, recordings)
    }
  }

  // Handle card move (drag-drop)
  const handleMoveCard = (suggestionId: string, newStatus: SuggestionStatus) => {
    moveSuggestion(suggestionId, newStatus)
  }

  // Handle schedule request (from drag to scheduled column or dialog)
  const handleScheduleRequest = (suggestion: Suggestion) => {
    // Always open time picker dialog for scheduling
    setScheduleDialogSuggestion(suggestion)
  }

  // Handle schedule confirmation from time picker dialog
  const handleScheduleConfirm = async (suggestion: Suggestion, scheduledFor: string) => {
    // Local scheduling - await to ensure DB write completes
    const success = await scheduleSuggestion(suggestion.id, scheduledFor)

    if (!success) {
      console.error("Failed to schedule suggestion")
      return // Don't close dialog on failure
    }

    // Optional: sync to Google Calendar if connected
    if (isConnected) {
      // Pass updated suggestion with scheduledFor for calendar sync
      const updatedSuggestion: Suggestion = { ...suggestion, scheduledFor, status: "scheduled" }
      scheduleEvent(updatedSuggestion).catch(console.error)
    }

    setScheduleDialogSuggestion(null)
  }

  // Handle schedule from detail dialog
  const handleSchedule = (suggestion: Suggestion) => {
    // Open time picker dialog
    setSelectedSuggestion(null)
    setScheduleDialogSuggestion(suggestion)
  }

  return (
    <div className="min-h-screen bg-transparent relative overflow-hidden">
      <main className="px-8 md:px-16 lg:px-20 pt-28 pb-12 relative z-10">
        {/* HERO SECTION */}
        <div className="relative mb-8">
          <div
            className={cn(
              "relative transition-all duration-1000 delay-100",
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
            )}
          >
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Suggestions</p>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif leading-[0.95] mb-4">
                  Recovery <span className="text-accent">actions</span>
                </h1>
                <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl">
                  Drag suggestions between columns to manage your recovery workflow.
                </p>
              </div>

              <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={loading || !latestRecording?.metrics}
                  className="gap-2"
                >
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                  {suggestions.length === 0 ? "Generate" : "Refresh"}
                </Button>
            </div>
          </div>
        </div>

        {/* CALENDAR CONNECTION BANNER */}
        {!isConnected && (
          <div
            className={cn(
              "mb-6 transition-all duration-1000 delay-150",
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
            )}
          >
            <div className="rounded-lg border border-accent/30 bg-accent/5 backdrop-blur-sm p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-accent flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Connect your calendar</p>
                    <p className="text-sm text-muted-foreground">Schedule recovery blocks directly to Google Calendar</p>
                  </div>
                </div>
                <Button asChild variant="outline" className="border-accent text-accent hover:bg-accent/10">
                  <Link href="/dashboard/settings">Connect</Link>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* CATEGORY FILTER */}
        <div
          className={cn(
            "mb-6 transition-all duration-1000 delay-150",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
          )}
        >
          <CategoryFilterTabs
            value={selectedCategory}
            onChange={setSelectedCategory}
            counts={categoryCounts}
          />
        </div>

        {/* DIFF SUMMARY (shown after regeneration) */}
        {lastDiffSummary && (
          <div
            className={cn(
              "mb-6 transition-all duration-500",
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            <div className="rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">Last update:</span>
                {lastDiffSummary.kept > 0 && (
                  <span className="text-foreground">{lastDiffSummary.kept} kept</span>
                )}
                {lastDiffSummary.updated > 0 && (
                  <span className="text-blue-400">{lastDiffSummary.updated} updated</span>
                )}
                {lastDiffSummary.dropped > 0 && (
                  <span className="text-muted-foreground line-through">{lastDiffSummary.dropped} removed</span>
                )}
                {lastDiffSummary.added > 0 && (
                  <span className="text-accent">{lastDiffSummary.added} new</span>
                )}
              </div>
              <button
                onClick={clearDiffSummary}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* MAIN CONTENT */}
        <div
          className={cn(
            "transition-all duration-1000 delay-200",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
          )}
        >
          {/* Loading state */}
          {loading ? (
            <div className="rounded-2xl border border-border/70 bg-card/30 backdrop-blur-xl p-12">
              <div className="flex flex-col items-center justify-center gap-4">
                <Spinner className="h-8 w-8 text-accent" />
                <p className="text-muted-foreground">Generating personalized suggestions...</p>
              </div>
            </div>
          ) : error ? (
            /* Error state */
            <div className="rounded-2xl border border-destructive/50 bg-destructive/10 backdrop-blur-xl p-12">
              <div className="flex flex-col items-center justify-center gap-4 text-center">
                <p className="text-destructive">{error}</p>
                <Button variant="outline" onClick={handleRegenerate} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </Button>
              </div>
            </div>
          ) : suggestions.length === 0 ? (
            /* Empty state */
            <div className="rounded-2xl border border-border/70 bg-card/30 backdrop-blur-xl p-12">
              <Empty
                icon={Lightbulb}
                title="No suggestions yet"
                description="Record a voice sample to receive personalized recovery suggestions based on your stress and fatigue patterns."
              >
                <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90 mt-4">
                  <Link href="/dashboard/recordings?newRecording=true">
                    <Mic className="mr-2 h-4 w-4" />
                    Record Now
                  </Link>
                </Button>
              </Empty>
            </div>
          ) : (
            /* Kanban board */
            <>
              <KanbanBoard
                suggestions={filteredSuggestions}
                onCardClick={setSelectedSuggestion}
                onMoveCard={handleMoveCard}
                onScheduleRequest={handleScheduleRequest}
              />

              {/* Show all pending button */}
              {!showAllPending && hiddenPendingCount > 0 && (
                <div className="mt-4 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllPending(true)}
                    className="gap-2 text-muted-foreground hover:text-foreground"
                  >
                    Show all pending ({hiddenPendingCount} more)
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Calendar connection hint */}
              {!isConnected && (
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  <Link href="/dashboard/settings" className="text-accent hover:underline">
                    Connect your calendar
                  </Link>{" "}
                  to schedule recovery blocks
                </p>
              )}
            </>
          )}
        </div>

        {/* Detail dialog */}
        <SuggestionDetailDialog
          suggestion={selectedSuggestion}
          open={!!selectedSuggestion}
          onOpenChange={(open) => !open && setSelectedSuggestion(null)}
          onSchedule={handleSchedule}
          onAccept={(s) => {
            moveSuggestion(s.id, "accepted")
            setSelectedSuggestion(null)
          }}
          onDismiss={(s) => {
            dismissSuggestion(s.id)
            setSelectedSuggestion(null)
          }}
          onComplete={(s) => {
            completeSuggestion(s.id)
            setSelectedSuggestion(null)
          }}
          isCalendarConnected={isConnected}
          voicePatterns={voicePatterns}
          history={historyContext}
          burnoutPrediction={burnoutPrediction ?? undefined}
          features={latestRecording?.features}
        />

        {/* Schedule time picker dialog */}
        <ScheduleTimeDialog
          suggestion={scheduleDialogSuggestion}
          open={!!scheduleDialogSuggestion}
          onOpenChange={(open) => !open && setScheduleDialogSuggestion(null)}
          onSchedule={handleScheduleConfirm}
        />
      </main>
    </div>
  )
}

// Helper to get next available time slot
function getNextAvailableSlot(): string {
  const now = new Date()
  // Round up to next hour
  now.setHours(now.getHours() + 1, 0, 0, 0)
  return now.toISOString()
}
