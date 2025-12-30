"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { cn } from "@/lib/utils"
import { useDashboardAnimation } from "@/app/dashboard/layout"
import { useDashboardStats, useTrendData, useScheduledSuggestions, useRecordings } from "@/hooks/use-storage"
import { useSuggestions, featuresToVoicePatterns, computeHistoricalContext } from "@/hooks/use-suggestions"
import { useCalendar } from "@/hooks/use-calendar"
import { useResponsive } from "@/hooks/use-responsive"
import { useSuggestionWorkflow } from "@/hooks/use-suggestion-workflow"
import { predictBurnoutRisk, recordingsToTrendData } from "@/lib/ml/forecasting"
import { DashboardHero } from "./dashboard-hero"
import { DashboardLayout } from "./dashboard-layout"
import { MetricsHeaderBar } from "./metrics-header-bar"
import { PendingSidebar } from "./suggestions/pending-sidebar"
import { ScheduleXWeekCalendar } from "./calendar"
import { SuggestionDetailDialog, ScheduleTimeDialog } from "./suggestions"
import type { BurnoutPrediction } from "@/lib/types"

export function UnifiedDashboard() {
  // Animation & responsiveness
  const { shouldAnimate } = useDashboardAnimation()
  const [visible, setVisible] = useState(!shouldAnimate)
  const { isMobile } = useResponsive()
  const [isSidebarSheetOpen, setIsSidebarSheetOpen] = useState(false)

  // Data hooks
  const dashboardStats = useDashboardStats()
  const storedTrendData = useTrendData(7)
  const scheduledSuggestions = useScheduledSuggestions()
  const allRecordings = useRecordings(14)
  const { isConnected: isCalendarConnected, scheduleEvent } = useCalendar()

  // Suggestions hook
  const {
    suggestions,
    loading: suggestionsLoading,
    regenerateWithDiff,
    scheduleSuggestion,
    dismissSuggestion,
    completeSuggestion,
  } = useSuggestions()

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
    scheduleGoogleEvent: scheduleEvent,
    isCalendarConnected,
  })

  // Trigger entry animation
  useEffect(() => {
    if (shouldAnimate) {
      const timer = setTimeout(() => setVisible(true), 100)
      return () => clearTimeout(timer)
    }
  }, [shouldAnimate])

  // Burnout prediction
  const burnoutPrediction: BurnoutPrediction | null = useMemo(() => {
    if (storedTrendData.length < 2) return null
    return predictBurnoutRisk(storedTrendData)
  }, [storedTrendData])

  // Voice patterns for detail dialog
  const voicePatterns = useMemo(() => {
    return featuresToVoicePatterns(allRecordings?.[0]?.features)
  }, [allRecordings])

  // Historical context for detail dialog
  const historicalContext = useMemo(() => {
    return computeHistoricalContext(allRecordings || [])
  }, [allRecordings])

  // Completed suggestions (for calendar display)
  const completedSuggestions = useMemo(() => {
    return suggestions.filter(s =>
      (s.status === "completed" || s.status === "accepted") && s.scheduledFor
    )
  }, [suggestions])

  // Handle regenerating suggestions
  const handleRegenerate = useCallback(async () => {
    const latestRecording = allRecordings?.[0]
    if (!latestRecording?.metrics) return

    const metrics = latestRecording.metrics
    const trendData = recordingsToTrendData(allRecordings || [])
    const trend = trendData.length >= 2
      ? predictBurnoutRisk(trendData).trend
      : "stable"

    await regenerateWithDiff(metrics, trend, allRecordings || [])
  }, [allRecordings, regenerateWithDiff])

  const pendingCount = suggestions.filter(s => s.status === "pending").length

  return (
    <div className="min-h-screen bg-transparent relative overflow-hidden">
      <main className="px-4 md:px-8 lg:px-12 pt-24 pb-12 relative z-10">
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
          <DashboardLayout
            isMobile={isMobile}
            isSidebarSheetOpen={isSidebarSheetOpen}
            setIsSidebarSheetOpen={setIsSidebarSheetOpen}
            pendingCount={pendingCount}
            showEmptyState={!suggestionsLoading && scheduledSuggestions.length === 0 && pendingCount === 0}
            sidebar={
              <PendingSidebar
                suggestions={suggestions}
                onSuggestionClick={handlers.handleSuggestionClick}
                onDragStart={handlers.handleDragStart}
                onDragEnd={handlers.handleDragEnd}
                onRegenerate={handleRegenerate}
                isRegenerating={suggestionsLoading}
                className="h-full"
              />
            }
            calendar={
              <ScheduleXWeekCalendar
                scheduledSuggestions={scheduledSuggestions}
                completedSuggestions={completedSuggestions}
                recordings={allRecordings}
                onEventClick={handlers.handleEventClick}
                onTimeSlotClick={handlers.handleTimeSlotClick}
                onExternalDrop={handlers.handleExternalDrop}
                pendingDragActive={pendingDragActive}
                className={isMobile ? "h-[60vh] md:h-[70vh]" : "h-[calc(100vh-180px)]"}
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
          defaultDate={droppedSuggestion?.date}
          defaultHour={droppedSuggestion?.hour}
          defaultMinute={droppedSuggestion?.minute}
        />
      </main>
    </div>
  )
}
