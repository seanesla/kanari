"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { Link } from "next-view-transitions"
import { Lightbulb, Mic, RefreshCw } from "lucide-react"
import { useSceneMode } from "@/lib/scene-context"
import { cn } from "@/lib/utils"
import { DecorativeGrid } from "@/components/ui/decorative-grid"
import { Button } from "@/components/ui/button"
import { Empty } from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { useCalendar } from "@/hooks/use-calendar"
import { useSuggestions } from "@/hooks/use-suggestions"
import { useRecordings } from "@/hooks/use-storage"
import {
  KanbanBoard,
  CategoryFilterTabs,
  SuggestionDetailDialog,
  filterSuggestionsByCategory,
  countSuggestionsByCategory,
  type FilterValue,
} from "@/components/dashboard/suggestions"
import type { Suggestion, TrendDirection, SuggestionStatus } from "@/lib/types"

export default function SuggestionsPage() {
  const { setMode } = useSceneMode()
  const [visible, setVisible] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<FilterValue>("all")
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null)

  const { isConnected, scheduleEvent } = useCalendar()

  // Get latest recording for metrics
  const recordings = useRecordings(1)
  const latestRecording = recordings[0]

  // Real suggestions from Gemini API
  const {
    suggestions,
    loading,
    suggestionsLoading,
    forRecordingId,
    error,
    fetchSuggestions,
    moveSuggestion,
    scheduleSuggestion,
    dismissSuggestion,
    completeSuggestion,
    regenerate,
  } = useSuggestions(latestRecording?.id ?? null)

  // Track if we've already initiated a fetch for this recording
  const fetchInitiatedRef = useRef<string | null>(null)

  // Set scene to dashboard mode
  useEffect(() => {
    setMode("dashboard")
  }, [setMode])

  // Trigger entry animation
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  // Fetch suggestions when we have a new recording with metrics but no suggestions yet
  useEffect(() => {
    if (
      latestRecording?.id &&
      latestRecording?.metrics &&
      !loading &&
      !suggestionsLoading &&
      forRecordingId === latestRecording.id &&
      suggestions.length === 0 &&
      fetchInitiatedRef.current !== latestRecording.id
    ) {
      fetchInitiatedRef.current = latestRecording.id
      const trend: TrendDirection = "stable"
      fetchSuggestions(latestRecording.metrics, trend)
    }
  }, [latestRecording?.id, latestRecording?.metrics, loading, suggestionsLoading, forRecordingId, suggestions.length, fetchSuggestions])

  // Filter suggestions by category
  const filteredSuggestions = useMemo(
    () => filterSuggestionsByCategory(suggestions, selectedCategory),
    [suggestions, selectedCategory]
  )

  // Category counts
  const categoryCounts = useMemo(
    () => countSuggestionsByCategory(suggestions),
    [suggestions]
  )

  // Handle regenerate suggestions
  const handleRegenerate = async () => {
    if (latestRecording?.metrics) {
      fetchInitiatedRef.current = null
      const trend: TrendDirection = "stable"
      await regenerate(latestRecording.metrics, trend)
    }
  }

  // Handle card move (drag-drop)
  const handleMoveCard = (suggestionId: string, newStatus: SuggestionStatus) => {
    moveSuggestion(suggestionId, newStatus)
  }

  // Handle schedule request (from drag to scheduled column)
  const handleScheduleRequest = async (suggestion: Suggestion) => {
    if (!isConnected) {
      setSelectedSuggestion(suggestion)
      return
    }

    // Schedule for next available slot (default: next hour)
    const scheduledFor = getNextAvailableSlot()
    const recoveryBlock = await scheduleEvent(suggestion)

    if (recoveryBlock) {
      scheduleSuggestion(suggestion.id, scheduledFor)
    }
  }

  // Handle schedule from dialog
  const handleSchedule = async (suggestion: Suggestion) => {
    if (!isConnected) return

    const scheduledFor = getNextAvailableSlot()
    const recoveryBlock = await scheduleEvent(suggestion)

    if (recoveryBlock) {
      scheduleSuggestion(suggestion.id, scheduledFor)
      setSelectedSuggestion(null)
    }
  }

  return (
    <div className="min-h-screen bg-transparent relative overflow-hidden">
      <main className="px-4 md:px-8 lg:px-12 pt-28 pb-12 relative z-10">
        {/* HERO SECTION */}
        <div className="relative mb-8">
          <DecorativeGrid />
          <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />

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
                  disabled={loading || suggestions.length === 0}
                  className="gap-2"
                >
                  <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                  Regenerate
                </Button>
            </div>
          </div>
        </div>

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
                  <Link href="/dashboard/record">
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
