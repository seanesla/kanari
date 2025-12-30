"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Link } from "next-view-transitions"
import { Calendar as CalendarIcon, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useDashboardAnimation } from "@/app/dashboard/layout"
import { useDashboardStats, useTrendData, useScheduledSuggestions, useRecordings } from "@/hooks/use-storage"
import { useSuggestions, featuresToVoicePatterns, computeHistoricalContext } from "@/hooks/use-suggestions"
import { useCalendar } from "@/hooks/use-calendar"
import { predictBurnoutRisk, recordingsToTrendData } from "@/lib/ml/forecasting"
import { MetricsHeaderBar } from "./metrics-header-bar"
import { PendingSidebar } from "./suggestions/pending-sidebar"
import { ScheduleXWeekCalendar } from "./calendar"
import { SuggestionDetailDialog, ScheduleTimeDialog } from "./suggestions"
import type { Suggestion, BurnoutPrediction } from "@/lib/types"

export function UnifiedDashboard() {
  const { shouldAnimate } = useDashboardAnimation()
  const [visible, setVisible] = useState(!shouldAnimate)
  const [isMobile, setIsMobile] = useState(false)
  const [isSidebarSheetOpen, setIsSidebarSheetOpen] = useState(false)

  // Suggestion state
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null)
  const [scheduleDialogSuggestion, setScheduleDialogSuggestion] = useState<Suggestion | null>(null)
  const [pendingDragActive, setPendingDragActive] = useState(false)
  const [droppedSuggestion, setDroppedSuggestion] = useState<{ suggestion: Suggestion; date: Date; hour: number; minute: number } | null>(null)

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

  // Trigger entry animation
  useEffect(() => {
    if (shouldAnimate) {
      const timer = setTimeout(() => setVisible(true), 100)
      return () => clearTimeout(timer)
    }
  }, [shouldAnimate])

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Burnout prediction
  const burnoutPrediction: BurnoutPrediction | null = useMemo(() => {
    if (storedTrendData.length < 2) return null
    return predictBurnoutRisk(storedTrendData)
  }, [storedTrendData])

  // Voice patterns for detail dialog
  const voicePatterns = useMemo(() => {
    const latestRecording = allRecordings?.[0]
    return featuresToVoicePatterns(latestRecording?.features)
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

  // Handle clicking a suggestion
  const handleSuggestionClick = useCallback((suggestion: Suggestion) => {
    setSelectedSuggestion(suggestion)
  }, [])

  // Handle scheduling from detail dialog
  const handleScheduleFromDialog = useCallback((suggestion: Suggestion) => {
    setSelectedSuggestion(null)
    setScheduleDialogSuggestion(suggestion)
  }, [])

  // Handle external drop from sidebar to calendar
  const handleExternalDrop = useCallback((suggestionId: string, date: Date, hour: number, minute: number) => {
    const suggestion = suggestions.find(s => s.id === suggestionId)
    if (!suggestion) return

    // Store the drop info and open the schedule dialog pre-filled
    setDroppedSuggestion({ suggestion, date, hour, minute })
    setScheduleDialogSuggestion(suggestion)
  }, [suggestions])

  // Handle schedule confirmation
  const handleScheduleConfirm = useCallback(async (suggestion: Suggestion, scheduledFor: string) => {
    const success = await scheduleSuggestion(suggestion.id, scheduledFor)
    if (success) {
      setScheduleDialogSuggestion(null)
      setDroppedSuggestion(null)

      // Optionally sync to Google Calendar
      if (isCalendarConnected) {
        const updatedSuggestion = { ...suggestion, status: "scheduled" as const, scheduledFor }
        await scheduleEvent(updatedSuggestion)
      }
    }
    return success
  }, [scheduleSuggestion, isCalendarConnected, scheduleEvent])

  // Handle dismissing from detail dialog
  const handleDismiss = useCallback(async (suggestion: Suggestion) => {
    await dismissSuggestion(suggestion.id)
    setSelectedSuggestion(null)
  }, [dismissSuggestion])

  // Handle completing from detail dialog
  const handleComplete = useCallback(async (suggestion: Suggestion) => {
    await completeSuggestion(suggestion.id)
    setSelectedSuggestion(null)
  }, [completeSuggestion])

  // Handle calendar event click
  const handleEventClick = useCallback((suggestion: Suggestion) => {
    setSelectedSuggestion(suggestion)
  }, [])

  // Sidebar content (reused for mobile sheet)
  const sidebarContent = (
    <PendingSidebar
      suggestions={suggestions}
      onSuggestionClick={handleSuggestionClick}
      onDragStart={() => setPendingDragActive(true)}
      onDragEnd={() => setPendingDragActive(false)}
      onRegenerate={handleRegenerate}
      isRegenerating={suggestionsLoading}
      className="h-full"
    />
  )

  return (
    <div className="min-h-screen bg-transparent relative overflow-hidden">
      <main className="px-4 md:px-8 lg:px-12 pt-24 pb-12 relative z-10">
        {/* Header */}
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
            // Mobile: Calendar with bottom sheet for suggestions
            <div className="space-y-4">
              {/* Calendar */}
              <div className="rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl overflow-hidden">
                <ScheduleXWeekCalendar
                  scheduledSuggestions={scheduledSuggestions}
                  completedSuggestions={completedSuggestions}
                  onEventClick={handleEventClick}
                  onTimeSlotClick={(date, hour) => {
                    // If we have pending suggestions, offer to schedule one
                    const pendingSuggestion = suggestions.find(s => s.status === "pending")
                    if (pendingSuggestion) {
                      setDroppedSuggestion({ suggestion: pendingSuggestion, date, hour, minute: 0 })
                      setScheduleDialogSuggestion(pendingSuggestion)
                    }
                  }}
                  className="h-[60vh] md:h-[70vh]"
                />
              </div>

              {/* Mobile sidebar sheet trigger */}
              <Sheet open={isSidebarSheetOpen} onOpenChange={setIsSidebarSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Manage Suggestions ({suggestions.filter(s => s.status === "pending").length} pending)
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[70vh]">
                  <div className="h-full pt-4">
                    {sidebarContent}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          ) : (
            // Desktop: Sidebar + Calendar grid
            <div className="grid grid-cols-[320px_1fr] gap-6">
              {/* Sidebar */}
              <div className="rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl p-4 h-[calc(100vh-180px)] overflow-hidden">
                {sidebarContent}
              </div>

              {/* Calendar */}
              <div className="rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl overflow-hidden">
                <ScheduleXWeekCalendar
                  scheduledSuggestions={scheduledSuggestions}
                  completedSuggestions={completedSuggestions}
                  onEventClick={handleEventClick}
                  onTimeSlotClick={(date, hour) => {
                    const pendingSuggestion = suggestions.find(s => s.status === "pending")
                    if (pendingSuggestion) {
                      setDroppedSuggestion({ suggestion: pendingSuggestion, date, hour, minute: 0 })
                      setScheduleDialogSuggestion(pendingSuggestion)
                    }
                  }}
                  onExternalDrop={handleExternalDrop}
                  pendingDragActive={pendingDragActive}
                  className="h-[calc(100vh-180px)]"
                />
              </div>
            </div>
          )}

          {/* Empty state */}
          {scheduledSuggestions.length === 0 && suggestions.filter(s => s.status === "pending").length === 0 && (
            <div className="mt-8 text-center">
              <p className="text-muted-foreground mb-4">
                No suggestions yet. Record a voice check-in to get personalized recovery recommendations.
              </p>
              <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link href="/dashboard/recordings?newRecording=true">
                  Record Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </div>

        {/* Suggestion Detail Dialog */}
        <SuggestionDetailDialog
          suggestion={selectedSuggestion}
          open={!!selectedSuggestion}
          onOpenChange={(open) => !open && setSelectedSuggestion(null)}
          onSchedule={handleScheduleFromDialog}
          onDismiss={handleDismiss}
          onComplete={handleComplete}
          isCalendarConnected={isCalendarConnected}
          voicePatterns={voicePatterns}
          history={historicalContext}
          burnoutPrediction={burnoutPrediction}
          features={allRecordings?.[0]?.features}
        />

        {/* Schedule Time Dialog */}
        <ScheduleTimeDialog
          suggestion={scheduleDialogSuggestion}
          open={!!scheduleDialogSuggestion}
          onOpenChange={(open) => {
            if (!open) {
              setScheduleDialogSuggestion(null)
              setDroppedSuggestion(null)
            }
          }}
          onSchedule={handleScheduleConfirm}
          defaultDate={droppedSuggestion?.date}
          defaultHour={droppedSuggestion?.hour}
          defaultMinute={droppedSuggestion?.minute}
        />
      </main>
    </div>
  )
}
