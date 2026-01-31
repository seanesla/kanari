"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { RefreshCw, ChevronsUpDown, Sparkles, TrendingUp, X } from "@/lib/icons"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { MetricsHeaderBar } from "./metrics-header-bar"
import { Deck } from "@/components/dashboard/deck"
import { JournalEntriesPanel } from "./journal-entries-panel"
import { OverviewAnalyticsSection } from "@/components/dashboard/overview-analytics-section"
import { InsightsPanel } from "@/components/dashboard/insights-panel"
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

  const [activeView, setActiveView] = useState<"today" | "trends">("today")
  const [kanbanExpanded, setKanbanExpanded] = useState(true)
  const [calendarOpen, setCalendarOpen] = useState(false)

  // Data hooks
  // Keep a longer window for the Trends tab, but use the most-recent week for forecasting.
  const storedTrendData = useTrendData(30)
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

  // Optional query params for demo mode / internal links.
  // - view=today|trends
  // - action=schedule (auto-opens schedule dialog for first pending suggestion)
  useEffect(() => {
    const view = searchParams.get("view")
    const action = searchParams.get("action")

    if (view === "trends") {
      setActiveView("trends")
    }

    if (view === "today") {
      setActiveView("today")
    }

    if (action === "schedule") {
      setActiveView("today")
      const pending = suggestions.find((s) => s.status === "pending")
      if (pending) {
        handlers.handleScheduleFromDialog(pending)
      }
    }

    if (view || action) {
      window.history.replaceState({}, "", "/overview")
    }
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
    return predictBurnoutRisk(storedTrendData.slice(-7))
  }, [storedTrendData])

  const latestSynthesisSession = useMemo(() => {
    return checkInSessions.find((session) => !!session.synthesis) ?? null
  }, [checkInSessions])

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
    <div className="h-full">
      <FullCalendarView
        variant="mini"
        scheduledSuggestions={scheduledSuggestions}
        completedSuggestions={completedSuggestions}
        checkInSessions={checkInSessions}
        recoveryBlocks={recoveryBlocks}
        onEventClick={handlers.handleSuggestionClick}
        onTimeSlotClick={() => setCalendarOpen(true)}
        onExternalDrop={handlers.handleExternalDrop}
        pendingDragActive={pendingDragActive}
        className="h-full"
      />
    </div>
  )

  const scheduleDefaults = useMemo(() => {
    if (!scheduleDialogSuggestion || !droppedSuggestion) return null
    if (droppedSuggestion.suggestion.id !== scheduleDialogSuggestion.id) return null
    return droppedSuggestion
  }, [droppedSuggestion, scheduleDialogSuggestion])

  const achievementsCard = (
    <Deck className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">Today's achievements</h3>
          {!dayCompletion.isComplete && (dailyRemainingCount > 0 || suggestionsRemainingCount > 0) ? (
            <p className="text-xs text-muted-foreground mt-1">
              Level {achievementProgress.level} - {achievementProgress.levelTitle} -{" "}
              {dailyRemainingCount > 0 ? `${dailyRemainingCount} left` : "Daily done"}
              {suggestionsRemainingCount > 0 ? ` - ${suggestionsRemainingCount} suggestion left` : ""}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              Level {achievementProgress.level} - {achievementProgress.levelTitle} - {achievementProgress.totalPoints} pts
            </p>
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

      <div className="mt-4 space-y-3">
        <Progress value={dailyProgressPct} />

        <div className="grid gap-2 sm:grid-cols-2">
          {achievementsToday.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              {achievementsLoading ? "Generating today's achievements..." : "No achievements yet."}
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
    </Deck>
  )

  const journalCard = (
    <Deck className="p-6">
      <div className="mb-4">
        <h3 className="text-sm font-medium">Journal entries</h3>
        <p className="text-xs text-muted-foreground mt-1">Recent reflections captured during check-ins.</p>
      </div>
      <JournalEntriesPanel embedded />
    </Deck>
  )

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

        <Tabs value={activeView} onValueChange={(value) => setActiveView(value as "today" | "trends")}>
          <div
            className={cn(
              "mb-6 transition-all duration-1000 delay-150",
              visible ? "opacity-100 translate-y-0" : "opacity-95 translate-y-8"
            )}
          >
            <TabsList
              className={cn(
                "w-full max-w-[460px] mx-auto",
                "relative h-11 p-1 rounded-2xl",
                "border border-white/10",
                "bg-[rgba(255,255,255,0.03)] backdrop-blur-2xl backdrop-saturate-150",
                "ring-1 ring-white/6",
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_50px_rgba(0,0,0,0.35)]"
              )}
            >
              <TabsTrigger
                value="today"
                className={cn(
                  "relative h-9 rounded-xl px-4 overflow-hidden",
                  "text-sm font-semibold tracking-tight",
                  "text-muted-foreground/90 hover:text-foreground",
                  "hover:bg-muted/20",
                  "data-[state=active]:text-foreground",
                  "transition-all duration-200"
                )}
              >
                {activeView === "today" ? (
                  <motion.div
                    layoutId="overview-tabs-indicator"
                    transition={{ type: "spring", stiffness: 520, damping: 42 }}
                    className={cn(
                      "absolute inset-0 rounded-xl",
                      "bg-[rgba(255,255,255,0.06)] backdrop-blur-xl backdrop-saturate-150",
                      "border border-white/10",
                      "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_40px_rgba(0,0,0,0.35)]"
                    )}
                  />
                ) : null}
                <span className="relative z-10 inline-flex items-center gap-1.5">
                  <Sparkles className={cn("h-4 w-4", activeView === "today" ? "text-foreground/80" : "")} />
                  Today
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="trends"
                className={cn(
                  "relative h-9 rounded-xl px-4 overflow-hidden",
                  "text-sm font-semibold tracking-tight",
                  "text-muted-foreground/90 hover:text-foreground",
                  "hover:bg-muted/20",
                  "data-[state=active]:text-foreground",
                  "transition-all duration-200"
                )}
              >
                {activeView === "trends" ? (
                  <motion.div
                    layoutId="overview-tabs-indicator"
                    transition={{ type: "spring", stiffness: 520, damping: 42 }}
                    className={cn(
                      "absolute inset-0 rounded-xl",
                      "bg-[rgba(255,255,255,0.06)] backdrop-blur-xl backdrop-saturate-150",
                      "border border-white/10",
                      "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_40px_rgba(0,0,0,0.35)]"
                    )}
                  />
                ) : null}
                <span className="relative z-10 inline-flex items-center gap-1.5">
                  <TrendingUp className={cn("h-4 w-4", activeView === "trends" ? "text-foreground/80" : "")} />
                  Trends
                </span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="today">
            <div
              className={cn(
                "transition-all duration-1000 delay-200",
                visible ? "opacity-100 translate-y-0" : "opacity-95 translate-y-8"
              )}
            >
              {isMobile ? (
                <div className="space-y-4">
                  <InsightsPanel session={latestSynthesisSession} />

                  {/* Entry animation: keep in sync with the dashboard-level visible flag.
                      See docs/error-patterns/dashboard-missing-entry-animation.md */}
                  <div
                    data-testid="dashboard-daily-achievements"
                    className={cn(
                      "transition-all duration-1000 delay-250",
                      visible ? "opacity-100 translate-y-0" : "opacity-95 translate-y-8"
                    )}
                  >
                    {achievementsCard}
                  </div>

                  <Deck data-demo-id="demo-suggestions-kanban" className="p-4 h-[240px] overflow-hidden">
                    {kanbanContent}
                  </Deck>

                  {showEmptyState && (
                    <div className="text-center">
                      <p className="text-muted-foreground mb-4">
                        No suggestions yet. Start a check-in to get personalized recovery recommendations.
                      </p>
                      <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
                        <Link href="/check-ins?newCheckIn=true">Check in now</Link>
                      </Button>
                    </div>
                  )}

                  <Deck
                    data-demo-id="demo-calendar"
                    className="overflow-hidden aspect-square w-full max-w-[420px] mx-auto"
                  >
                    {calendarContent}
                  </Deck>

                  {journalCard}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px] items-start">
                    <div className="space-y-4 min-w-0">
                      <Deck
                        data-demo-id="demo-suggestions-kanban"
                        className={cn(
                          "p-4 overflow-hidden transition-[height] duration-300",
                          kanbanExpanded ? "h-[420px]" : "h-[260px]"
                        )}
                      >
                        {kanbanContent}
                      </Deck>

                      {/* Entry animation: keep in sync with the dashboard-level visible flag.
                          See docs/error-patterns/dashboard-missing-entry-animation.md */}
                      <div
                        data-testid="dashboard-daily-achievements"
                        className={cn(
                          "transition-all duration-1000 delay-250",
                          visible ? "opacity-100 translate-y-0" : "opacity-95 translate-y-8"
                        )}
                      >
                        {achievementsCard}
                      </div>

                      {journalCard}
                    </div>

                    <div className="space-y-4 min-w-0">
                      <InsightsPanel session={latestSynthesisSession} />

                      <Deck
                        data-demo-id="demo-calendar"
                        className="overflow-hidden aspect-square w-full max-w-[420px] mx-auto lg:max-w-none lg:mx-0"
                      >
                        {calendarContent}
                      </Deck>
                    </div>
                  </div>

                  {showEmptyState && (
                    <div className="mt-8 text-center">
                      <p className="text-muted-foreground mb-4">
                        No suggestions yet. Start a check-in to get personalized recovery recommendations.
                      </p>
                      <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
                        <Link href="/check-ins?newCheckIn=true">Check in now</Link>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="trends">
            {activeView === "trends" ? (
              <div
                id="analytics-section"
                className={cn(
                  "transition-all duration-1000 delay-200",
                  visible ? "opacity-100 translate-y-0" : "opacity-95 translate-y-8"
                )}
              >
                <OverviewAnalyticsSection
                  burnoutPrediction={burnoutPrediction}
                  storedTrendData={storedTrendData}
                  recordings={allRecordings}
                  sessions={checkInSessions}
                />
              </div>
            ) : null}
          </TabsContent>
        </Tabs>

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
              // Aim for a near-square dialog on desktop, while still using most of the viewport.
              // Width is capped relative to height to avoid a "letterbox" feel.
              "!h-[min(96vh,64rem)]",
              "!w-[min(96vw,calc(min(96vh,64rem)*1.06))] !max-w-none sm:!max-w-none"
            )}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/60">
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
