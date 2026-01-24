"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { RefreshCw, ChevronsUpDown, ArrowUpRight, X } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { useDashboardAnimation } from "@/lib/dashboard-animation-context"
import {
  useTrendData,
  useRecordings,
  useCheckInSessions,
  useRecoveryBlockActions,
  useRecoveryBlocks,
} from "@/hooks/use-storage"
import { useSuggestions, featuresToVoicePatterns, computeHistoricalContext } from "@/hooks/use-suggestions"
import { useLocalCalendar } from "@/hooks/use-local-calendar"
import { useResponsive } from "@/hooks/use-responsive"
import { useSuggestionWorkflow } from "@/hooks/use-suggestion-workflow"
import { useAchievements } from "@/hooks/use-achievements"
import { predictBurnoutRisk, sessionsToTrendData } from "@/lib/ml/forecasting"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { CollapsibleSection } from "./collapsible-section"
import { MetricsHeaderBar } from "./metrics-header-bar"
import { Deck } from "@/components/dashboard/deck"
import { JournalEntriesPanel } from "./journal-entries-panel"
import { KanbanBoard } from "./suggestions/kanban-board"
import { FullCalendarView } from "./calendar"
import { SuggestionDetailDialog, ScheduleTimeDialog } from "./suggestions"
import { CelebrationToastQueue, DailyAchievementCard } from "@/components/achievements"
import { getDailyAchievementAction, type DailyAchievement } from "@/lib/achievements"
import type { BurnoutPrediction } from "@/lib/types"

export function UnifiedDashboard() {
  // Animation & responsiveness
  const { shouldAnimate } = useDashboardAnimation()
  const [visible, setVisible] = useState(!shouldAnimate)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isMobile } = useResponsive()
  const [kanbanExpanded, setKanbanExpanded] = useState(true)
  const [calendarOpen, setCalendarOpen] = useState(false)

  // Data hooks
  const storedTrendData = useTrendData(7)
  const allRecordings = useRecordings(14)
  const {
    isConnected: isCalendarConnected,
    scheduleEvent,
  } = useLocalCalendar()
  const { addRecoveryBlock } = useRecoveryBlockActions()
  const recoveryBlocks = useRecoveryBlocks()

  const scheduleLocalEventAndPersist = useCallback(
    async (suggestion: Parameters<typeof scheduleEvent>[0]) => {
      const block = await scheduleEvent(suggestion)
      if (block) {
        await addRecoveryBlock(block)
      }
      return block
    },
    [scheduleEvent, addRecoveryBlock]
  )

  // Suggestions hook
  const {
    suggestions,
    loading: suggestionsLoading,
    regenerateWithDiff,
    scheduleSuggestion,
    dismissSuggestion,
    completeSuggestion,
  } = useSuggestions()

  // Check-in sessions (for dialog context + calendar)
  const checkInSessions = useCheckInSessions(30)

  // Daily achievements (generated on app open)
  const {
    achievementsToday,
    progress: achievementProgress,
    dayCompletion,
    loading: achievementsLoading,
    celebrationQueue,
    milestoneCelebrationQueue,
    markAchievementSeen,
    markMilestoneSeen,
  } = useAchievements({ recordings: allRecordings, suggestions, sessions: checkInSessions })

  // Suggestion workflow (dialogs, drag-drop, handlers)
  const {
    selectedSuggestion,
    scheduleDialogSuggestion,
    pendingDragActive,
    droppedSuggestion,
    handlers,
  } = useSuggestionWorkflow({
    suggestions,
    scheduleSuggestion,
    dismissSuggestion,
    completeSuggestion,
    scheduleGoogleEvent: scheduleLocalEventAndPersist,
    isCalendarConnected,
  })

  // Trigger entry animation
  useEffect(() => {
    if (shouldAnimate) {
      const timer = setTimeout(() => setVisible(true), 100)
      return () => clearTimeout(timer)
    }
  }, [shouldAnimate])

  // Deep-link helpers for achievements CTAs (focus suggestions, optionally open schedule flow).
  useEffect(() => {
    const focus = searchParams.get("focus")
    if (focus !== "suggestions") return

    setKanbanExpanded(true)

    // Scroll the kanban area into view once the layout has rendered.
    requestAnimationFrame(() => {
      document.getElementById("kanban-section")?.scrollIntoView({ behavior: "smooth", block: "start" })
    })

    if (searchParams.get("action") === "schedule") {
      const pending = suggestions.find((s) => s.status === "pending")
      if (pending) {
        handlers.handleScheduleFromDialog(pending)
      }
    }

    window.history.replaceState({}, "", "/overview")
  }, [handlers, searchParams, suggestions])

  const dailyProgressPct = dayCompletion.totalCount > 0
    ? (dayCompletion.completedCount / dayCompletion.totalCount) * 100
    : 0

  const dailyRemainingCount = Math.max(0, dayCompletion.totalCount - dayCompletion.completedCount)
  const suggestionsRemainingCount = Math.max(
    0,
    dayCompletion.recommendedActionsRequired - dayCompletion.recommendedActionsCompleted
  )

  const handleAchievementClick = useCallback((achievement: DailyAchievement) => {
    // Prevent direct completion from the dashboard preview.
    // See docs/error-patterns/achievements-manual-completion.md
    if (achievement.type === "challenge" && !achievement.completed && !achievement.expired && achievement.tracking) {
      const action = getDailyAchievementAction(achievement.tracking.key)
      router.push(action.href)
      return
    }

    router.push("/achievements")
  }, [router])

  // Burnout prediction
  const burnoutPrediction: BurnoutPrediction | null = useMemo(() => {
    if (storedTrendData.length < 2) return null
    return predictBurnoutRisk(storedTrendData)
  }, [storedTrendData])

  // Voice patterns for detail dialog
  const voicePatterns = useMemo(() => {
    const latestSession = checkInSessions[0]
    return featuresToVoicePatterns(latestSession?.acousticMetrics?.features)
  }, [checkInSessions])

  // Historical context for detail dialog
  const historicalContext = useMemo(() => {
    return computeHistoricalContext(checkInSessions || [])
  }, [checkInSessions])

  // Handle regenerating suggestions
  const handleRegenerate = useCallback(async () => {
    const latestSession = checkInSessions?.[0]
    if (!latestSession?.acousticMetrics) return

    const metrics = {
      stressScore: latestSession.acousticMetrics.stressScore,
      stressLevel: latestSession.acousticMetrics.stressLevel,
      fatigueScore: latestSession.acousticMetrics.fatigueScore,
      fatigueLevel: latestSession.acousticMetrics.fatigueLevel,
      confidence: latestSession.acousticMetrics.confidence,
      analyzedAt: latestSession.acousticMetrics.analyzedAt ?? new Date().toISOString(),
    }

    const trendData = sessionsToTrendData(checkInSessions || [])
    const trend = trendData.length >= 2
      ? predictBurnoutRisk(trendData).trend
      : "stable"

    await regenerateWithDiff(metrics, trend, checkInSessions || [])
  }, [checkInSessions, regenerateWithDiff])

  const { scheduledSuggestions, completedSuggestions } = useMemo(() => {
    const scheduledSuggestions: typeof suggestions = []
    const completedSuggestions: typeof suggestions = []

    for (const suggestion of suggestions) {
      if (suggestion.status === "scheduled") scheduledSuggestions.push(suggestion)
      if (suggestion.status === "completed") completedSuggestions.push(suggestion)
    }

    return { scheduledSuggestions, completedSuggestions }
  }, [suggestions])
  const showEmptyState = !suggestionsLoading && suggestions.length === 0

  // Kanban content (shared between mobile and desktop)
  const kanbanContent = (
    <div id="kanban-section" className="h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">Suggestions</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={suggestionsLoading}
            aria-label="Regenerate recovery suggestions"
          >
            <RefreshCw className={cn("h-4 w-4", suggestionsLoading && "animate-spin")} />
            <span className="ml-2 hidden sm:inline">Regenerate</span>
          </Button>
          {!isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setKanbanExpanded(!kanbanExpanded)}
              aria-label={kanbanExpanded ? "Collapse suggestions" : "Expand suggestions"}
              className="px-2"
            >
              <ChevronsUpDown className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <KanbanBoard
          suggestions={suggestions}
          onCardClick={handlers.handleSuggestionClick}
          onScheduleRequest={handlers.handleScheduleFromDialog}
          variant="compact"
          onMoveCard={(suggestionId, newStatus) => {
            const suggestion = suggestions.find((s) => s.id === suggestionId)
            if (!suggestion) return
            if (newStatus === "completed") {
              void handlers.handleComplete(suggestion)
            }
          }}
        />
      </div>
    </div>
  )

  // Calendar content (shared between mobile and desktop)
  const calendarContent = (
    <div className="relative h-full">
      <FullCalendarView
        variant="mini"
        scheduledSuggestions={scheduledSuggestions}
        completedSuggestions={completedSuggestions}
        checkInSessions={checkInSessions}
        recoveryBlocks={recoveryBlocks}
        className="h-full"
      />

      <button
        type="button"
        onClick={() => setCalendarOpen(true)}
        className={cn(
          "absolute inset-0 rounded-xl",
          "cursor-zoom-in",
          "focus:outline-none focus:ring-2 focus:ring-accent/50"
        )}
        aria-label="Expand calendar"
      >
        <span className="sr-only">Expand calendar</span>
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-3 right-3 inline-flex items-center justify-center",
            "h-9 w-9 rounded-lg border border-border/60 bg-background/40 backdrop-blur-sm",
            "text-muted-foreground hover:text-foreground transition-colors"
          )}
        >
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </button>
    </div>
  )

  const scheduleDefaults = useMemo(() => {
    if (!scheduleDialogSuggestion || !droppedSuggestion) return null
    if (droppedSuggestion.suggestion.id !== scheduleDialogSuggestion.id) return null
    return droppedSuggestion
  }, [droppedSuggestion, scheduleDialogSuggestion])

  return (
    <div data-demo-id="demo-dashboard-main" className="min-h-screen bg-transparent relative overflow-hidden">
      <main className="px-4 md:px-8 lg:px-12 pt-[calc(env(safe-area-inset-top)+4rem)] md:pt-24 pb-[calc(env(safe-area-inset-bottom)+2rem)] relative z-10">
        {/* Compact Header with Title + Metrics */}
        <div
          data-demo-id="demo-metrics-header"
          className={cn(
            "mb-6 transition-all duration-1000 delay-100",
            visible ? "opacity-100 translate-y-0" : "opacity-95 translate-y-8"
          )}
        >
          <MetricsHeaderBar />
        </div>

        {/* Daily achievements (compact) */}
        {/* Entry animation: keep in sync with the dashboard-level visible flag.
            See docs/error-patterns/dashboard-missing-entry-animation.md */}
        <div
          data-testid="dashboard-daily-achievements"
          className={cn(
            "mb-4 transition-all duration-1000 delay-150",
            visible ? "opacity-100 translate-y-0" : "opacity-95 translate-y-8"
          )}
        >
          <CollapsibleSection title="Today's Achievements" defaultOpen={!isMobile}>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    Level {achievementProgress.level} • {achievementProgress.levelTitle}
                  </p>
                  {!dayCompletion.isComplete && (dailyRemainingCount > 0 || suggestionsRemainingCount > 0) ? (
                    <p className="text-xs text-muted-foreground">
                      {dailyRemainingCount > 0 ? `${dailyRemainingCount} left` : "Daily done"}
                      {suggestionsRemainingCount > 0 ? ` • ${suggestionsRemainingCount} suggestion left` : ""}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{achievementProgress.totalPoints} pts</p>
                  )}
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div className="tabular-nums">
                    <span className="font-medium text-foreground">
                      {dayCompletion.completedCount}/{dayCompletion.totalCount}
                    </span>{" "}
                    today
                  </div>
                  {dayCompletion.isComplete && <div className="text-accent">Complete</div>}
                </div>
              </div>

              <Progress value={dailyProgressPct} />

              <div className="grid gap-2 sm:grid-cols-2">
                {achievementsToday.length === 0 ? (
                  <div className="text-xs text-muted-foreground">
                    {achievementsLoading ? "Generating today’s achievements…" : "No achievements yet."}
                  </div>
                ) : (
                  achievementsToday.slice(0, 2).map((achievement) => (
                    <DailyAchievementCard
                      key={achievement.id}
                      achievement={achievement}
                      variant="compact"
                      showNewIndicator
                      onClick={() => handleAchievementClick(achievement)}
                    />
                  ))
                )}
              </div>

              <div className="flex items-center justify-end text-xs text-muted-foreground">
                <Link href="/achievements" className="underline underline-offset-4 hover:text-foreground">
                  View all
                </Link>
              </div>
            </div>
          </CollapsibleSection>
        </div>

        {/* Main Content */}
        <div
          className={cn(
            "transition-all duration-1000 delay-200",
            visible ? "opacity-100 translate-y-0" : "opacity-95 translate-y-8"
          )}
        >
          {isMobile ? (
            /* Mobile Layout: Stacked with collapsible panels at bottom */
            <div className="space-y-4">
              {/* Kanban */}
              <Deck data-demo-id="demo-suggestions-kanban" className="p-4 h-[240px] overflow-hidden">
                {kanbanContent}
              </Deck>

              {/* Calendar */}
              <Deck
                data-demo-id="demo-calendar"
                className="overflow-hidden aspect-square w-full max-w-[420px] mx-auto"
              >
                {calendarContent}
              </Deck>


              {/* Collapsible Journal */}
              <CollapsibleSection title="Journal Entries" defaultOpen={false}>
                <JournalEntriesPanel embedded />
              </CollapsibleSection>

              {/* Empty state */}
              {showEmptyState && (
                <div className="mt-8 text-center">
                  <p className="text-muted-foreground mb-4">
                    No suggestions yet. Start a check-in to get personalized recovery recommendations.
                  </p>
                  <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
                    <Link href="/check-ins?newCheckIn=true">
                      Check in now
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* Desktop Layout: 2-column grid (calmer + more scannable) */
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px] items-start">
                <div className="space-y-4 min-w-0">
                  {/* Kanban */}
                  <Deck
                    data-demo-id="demo-suggestions-kanban"
                    className={cn(
                      "p-4 overflow-hidden transition-[height] duration-300",
                      kanbanExpanded ? "h-[420px]" : "h-[260px]"
                    )}
                  >
                    {kanbanContent}
                  </Deck>

                  {/* Collapsible Journal */}
                  <CollapsibleSection title="Journal Entries" defaultOpen={false}>
                    <JournalEntriesPanel embedded />
                  </CollapsibleSection>
                </div>

                {/* Calendar (square preview, expands on click) */}
                <Deck
                  data-demo-id="demo-calendar"
                  className="overflow-hidden aspect-square w-full max-w-[420px] mx-auto lg:max-w-none lg:mx-0"
                >
                  {calendarContent}
                </Deck>
              </div>

              {/* Empty state */}
              {showEmptyState && (
                <div className="mt-8 text-center">
                  <p className="text-muted-foreground mb-4">
                    No suggestions yet. Start a check-in to get personalized recovery recommendations.
                  </p>
                  <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
                    <Link href="/check-ins?newCheckIn=true">
                      Check in now
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Suggestion Detail Dialog */}
        <SuggestionDetailDialog
          suggestion={selectedSuggestion}
          open={!!selectedSuggestion}
          onOpenChange={(open) => !open && handlers.closeDialogs()}
          onSchedule={handlers.handleScheduleFromDialog}
          onDismiss={handlers.handleDismiss}
          onComplete={handlers.handleComplete}
          onCompleteWithFeedback={handlers.handleCompleteWithFeedback}
          isCalendarConnected={isCalendarConnected}
          voicePatterns={voicePatterns}
          history={historicalContext}
          burnoutPrediction={burnoutPrediction ?? undefined}
          features={allRecordings?.[0]?.features}
        />

        {/* Expanded Calendar Dialog */}
        <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
          <DialogContent
            showCloseButton={false}
            className={cn(
              "p-0 overflow-hidden",
              "grid grid-rows-[auto_1fr] gap-0",
              "rounded-2xl border-border/70 bg-card/95 backdrop-blur-xl",
              "!w-[min(96vw,80rem)] !max-w-none sm:!max-w-none",
              "!h-[min(80vh,44rem)]"
            )}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <div className="min-w-0">
                <DialogTitle className="text-sm font-medium">Calendar</DialogTitle>
                <DialogDescription className="sr-only">
                  Full calendar view of scheduled recovery suggestions and check-ins.
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setCalendarOpen(false)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>

            <div className="min-h-0">
              <FullCalendarView
                scheduledSuggestions={scheduledSuggestions}
                completedSuggestions={completedSuggestions}
                checkInSessions={checkInSessions}
                recoveryBlocks={recoveryBlocks}
                onEventClick={handlers.handleSuggestionClick}
                onTimeSlotClick={handlers.handleTimeSlotClick}
                onEventUpdate={(suggestion, newScheduledFor) => {
                  scheduleSuggestion(suggestion.id, newScheduledFor)
                }}
                onExternalDrop={handlers.handleExternalDrop}
                pendingDragActive={pendingDragActive}
                className="h-full"
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Schedule Time Dialog */}
        <ScheduleTimeDialog
          suggestion={scheduleDialogSuggestion}
          open={!!scheduleDialogSuggestion}
          onOpenChange={(open) => !open && handlers.closeDialogs()}
          onSchedule={handlers.handleScheduleConfirm}
          defaultDateISO={scheduleDefaults?.dateISO}
          defaultHour={scheduleDefaults?.hour}
          defaultMinute={scheduleDefaults?.minute}
        />

        {/* Celebrations */}
        <CelebrationToastQueue
          achievements={celebrationQueue}
          milestones={milestoneCelebrationQueue}
          onDismissAchievement={(id) => void markAchievementSeen(id)}
          onDismissMilestone={(id) => void markMilestoneSeen(id)}
        />
      </main>
    </div>
  )
}
