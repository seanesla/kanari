"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { RefreshCw, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDashboardAnimation } from "@/app/dashboard/layout"
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
import { useAchievements, useCanGenerateAchievements, useAchievementCooldown } from "@/hooks/use-achievements"
import { predictBurnoutRisk, sessionsToTrendData } from "@/lib/ml/forecasting"
import { Button } from "@/components/ui/button"
import { DashboardLayout } from "./dashboard-layout"
import { CollapsibleSection } from "./collapsible-section"
import { MetricsHeaderBar } from "./metrics-header-bar"
import { InsightsPanel } from "./insights-panel"
import { JournalEntriesPanel } from "./journal-entries-panel"
import { KanbanBoard } from "./suggestions/kanban-board"
import { FullCalendarView } from "./calendar"
import { SuggestionDetailDialog, ScheduleTimeDialog } from "./suggestions"
import { AchievementToastQueue } from "@/components/achievements"
import type { BurnoutPrediction } from "@/lib/types"

export function UnifiedDashboard() {
  // Animation & responsiveness
  const { shouldAnimate } = useDashboardAnimation()
  const [visible, setVisible] = useState(!shouldAnimate)
  const { isMobile } = useResponsive()
  const [kanbanExpanded, setKanbanExpanded] = useState(false)

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

  // Check-in sessions for insights
  const checkInSessions = useCheckInSessions(30)

  const latestSynthesisSession = useMemo(() => {
    return checkInSessions.find((s) => !!s.synthesis) ?? null
  }, [checkInSessions])

  // Achievements hook
  const {
    newAchievements,
    loading: achievementsLoading,
    generateAchievements,
    markAsSeen,
  } = useAchievements()

  // Check if user has enough data for achievements
  const canGenerateAchievements = useCanGenerateAchievements(allRecordings || [], checkInSessions, suggestions)

  // 24-hour cooldown for achievement generation
  const { canCheck: cooldownAllowsCheck, markChecked } = useAchievementCooldown()

  // Suggestion workflow (dialogs, drag-drop, handlers)
  const {
    selectedSuggestion,
    scheduleDialogSuggestion,
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

  // Check for new achievements (with 24-hour cooldown to save API credits)
  useEffect(() => {
    // Cooldown check - only allow one API call per 24 hours
    if (!cooldownAllowsCheck) return
    if (!canGenerateAchievements || achievementsLoading) return
    if ((!allRecordings || allRecordings.length === 0) && checkInSessions.length === 0) return

    // Generate achievements after a short delay to avoid blocking initial load
    const timer = setTimeout(async () => {
      await generateAchievements(allRecordings, suggestions, checkInSessions)
      // Mark as checked to start 24-hour cooldown
      markChecked()
    }, 3000)

    return () => clearTimeout(timer)
    // Only run once when cooldown allows, not on every recording change
  }, [cooldownAllowsCheck, canGenerateAchievements])

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

  const { scheduledSuggestions, completedSuggestions, pendingCount } = useMemo(() => {
    const scheduledSuggestions: typeof suggestions = []
    const completedSuggestions: typeof suggestions = []
    let pendingCount = 0

    for (const suggestion of suggestions) {
      if (suggestion.status === "pending") pendingCount += 1
      if (suggestion.status === "scheduled") scheduledSuggestions.push(suggestion)
      if (suggestion.status === "completed") completedSuggestions.push(suggestion)
    }

    return { scheduledSuggestions, completedSuggestions, pendingCount }
  }, [suggestions])
  const scheduledCount = scheduledSuggestions.length

  // Kanban content (shared between mobile and desktop)
  const kanbanContent = (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">Suggestions</h3>
          <p className="text-xs text-muted-foreground">
            Pending → Scheduled → Completed
          </p>
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
    <FullCalendarView
      scheduledSuggestions={scheduledSuggestions}
      completedSuggestions={completedSuggestions}
      checkInSessions={checkInSessions}
      recoveryBlocks={recoveryBlocks}
      onEventClick={handlers.handleSuggestionClick}
      onEventUpdate={(suggestion, newScheduledFor) => {
        scheduleSuggestion(suggestion.id, newScheduledFor)
      }}
      className="h-full"
    />
  )

  return (
    <div className="min-h-screen bg-transparent relative overflow-hidden">
      <main className="px-4 md:px-8 lg:px-12 pt-20 pb-8 relative z-10">
        {/* Compact Header with Title + Metrics */}
        <div
          className={cn(
            "mb-6 transition-all duration-1000 delay-100",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          <MetricsHeaderBar />
        </div>

        {/* Main Content */}
        <div
          className={cn(
            "transition-all duration-1000 delay-200",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          {isMobile ? (
            /* Mobile Layout: Stacked with collapsible panels at bottom */
            <div className="space-y-4">
              {/* Kanban */}
              <div className="rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl p-4 h-[240px] overflow-hidden">
                {kanbanContent}
              </div>

              {/* Calendar */}
              <div className="rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl overflow-hidden h-[60vh]">
                {calendarContent}
              </div>

              {/* Collapsible Insights */}
              <CollapsibleSection title="Latest Insights" defaultOpen={false}>
                <InsightsPanel session={latestSynthesisSession} className="border-0 bg-transparent" />
              </CollapsibleSection>

              {/* Collapsible Journal */}
              <CollapsibleSection title="Journal Entries" defaultOpen={false}>
                <JournalEntriesPanel className="border-0 bg-transparent" />
              </CollapsibleSection>

              {/* Empty state */}
              {!suggestionsLoading && scheduledCount === 0 && pendingCount === 0 && (
                <DashboardLayout
                  isMobile={isMobile}
                  showEmptyState={true}
                  kanban={null}
                  calendar={null}
                />
              )}
            </div>
          ) : (
            /* Desktop Layout: Sidebar + Main Content */
            <div className="grid grid-cols-[300px_1fr] gap-6 h-[calc(100vh-140px)]">
              {/* Sidebar: Insights + Journal */}
              <div className="flex flex-col gap-4 overflow-hidden">
                <InsightsPanel
                  session={latestSynthesisSession}
                  className="flex-1 min-h-0 overflow-auto"
                />
                <JournalEntriesPanel className="flex-1 min-h-0 overflow-auto" />
              </div>

              {/* Main Content: Kanban + Calendar */}
              <div className="flex flex-col gap-4 overflow-hidden">
                {/* Kanban */}
                <div
                  className={cn(
                    "rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl p-4 overflow-hidden transition-all duration-300",
                    kanbanExpanded ? "h-[400px]" : "h-[200px]"
                  )}
                >
                  {kanbanContent}
                </div>

                {/* Calendar */}
                <div className="rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl overflow-hidden flex-1">
                  {calendarContent}
                </div>

                {/* Empty state */}
                {!suggestionsLoading && scheduledCount === 0 && pendingCount === 0 && (
                  <DashboardLayout
                    isMobile={isMobile}
                    showEmptyState={true}
                    kanban={null}
                    calendar={null}
                  />
                )}
              </div>
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

        {/* Schedule Time Dialog */}
        <ScheduleTimeDialog
          suggestion={scheduleDialogSuggestion}
          open={!!scheduleDialogSuggestion}
          onOpenChange={(open) => !open && handlers.closeDialogs()}
          onSchedule={handlers.handleScheduleConfirm}
        />

        {/* Achievement Toast Queue - Shows celebration for new achievements */}
        <AchievementToastQueue
          achievements={newAchievements}
          onDismiss={markAsSeen}
        />
      </main>
    </div>
  )
}
