"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDashboardAnimation } from "@/app/dashboard/layout"
import {
  useTrendData,
  useRecordings,
  useCheckInSessions,
  useRecoveryBlockActions,
} from "@/hooks/use-storage"
import { useSuggestions, featuresToVoicePatterns, computeHistoricalContext } from "@/hooks/use-suggestions"
import { useCalendar } from "@/hooks/use-calendar"
import { useResponsive } from "@/hooks/use-responsive"
import { useSuggestionWorkflow } from "@/hooks/use-suggestion-workflow"
import { useAchievements, useCanGenerateAchievements, useAchievementCooldown } from "@/hooks/use-achievements"
import { predictBurnoutRisk, sessionsToTrendData } from "@/lib/ml/forecasting"
import { Button } from "@/components/ui/button"
import { DashboardHero } from "./dashboard-hero"
import { DashboardLayout } from "./dashboard-layout"
import { MetricsHeaderBar } from "./metrics-header-bar"
import { InsightsPanel } from "./insights-panel"
import { JournalEntriesPanel } from "./journal-entries-panel"
import { KanbanBoard } from "./suggestions/kanban-board"
import { GoogleCalendarEmbed } from "./calendar"
import { SuggestionDetailDialog, ScheduleTimeDialog } from "./suggestions"
import { AchievementToastQueue } from "@/components/achievements"
import type { BurnoutPrediction } from "@/lib/types"

export function UnifiedDashboard() {
  // Animation & responsiveness
  const { shouldAnimate } = useDashboardAnimation()
  const [visible, setVisible] = useState(!shouldAnimate)
  const { isMobile } = useResponsive()

  // Data hooks
  const storedTrendData = useTrendData(7)
  const allRecordings = useRecordings(14)
  const {
    isConnected: isCalendarConnected,
    isLoading: isCalendarLoading,
    connect: connectCalendar,
    scheduleEvent,
  } = useCalendar()
  const { addRecoveryBlock } = useRecoveryBlockActions()

  const scheduleGoogleEventAndPersist = useCallback(
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
    scheduleGoogleEvent: scheduleGoogleEventAndPersist,
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

  const pendingCount = suggestions.filter(s => s.status === "pending").length
  const scheduledCount = suggestions.filter(s => s.status === "scheduled").length

  return (
    <div className="min-h-screen bg-transparent relative overflow-hidden">
      <main className="px-8 md:px-16 lg:px-20 pt-28 pb-12 relative z-10">
        <DashboardHero visible={visible} />

        {/* Metrics Header */}
        <div
          className={cn(
            "mb-6 transition-all duration-1000 delay-200",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          <MetricsHeaderBar />
        </div>

        {/* Main Content */}
        <div
          className={cn(
            "transition-all duration-1000 delay-300",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          <div className="mb-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <InsightsPanel session={latestSynthesisSession} />
            <JournalEntriesPanel />
          </div>

          <DashboardLayout
            isMobile={isMobile}
            showEmptyState={!suggestionsLoading && scheduledCount === 0 && pendingCount === 0}
            kanban={
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium">Suggestions</h3>
                    <p className="text-xs text-muted-foreground">
                      Pending → Scheduled → Completed
                    </p>
                  </div>
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
            }
            calendar={
              <GoogleCalendarEmbed
                isConnected={isCalendarConnected}
                isLoading={isCalendarLoading && !isCalendarConnected}
                onConnect={connectCalendar}
              />
            }
          />
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
