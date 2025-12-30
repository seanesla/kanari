/**
 * Sessions Page
 *
 * Displays a chronological timeline of both voice note recordings and AI chat sessions.
 * Users can view, expand, and delete their check-in sessions from one unified page.
 *
 * Features:
 * - Mixed timeline of voice notes and AI chats (newest first)
 * - Click voice notes to expand and play audio
 * - Click AI chats to view full conversation in a modal
 * - Visual links between related items (recording + follow-up chat)
 * - Delete actions for both types
 * - Animated entry with hero section
 */

"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Clock, Plus, Mic, MessageSquare } from "lucide-react"
import { useDashboardAnimation } from "../layout"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Empty, EmptyMedia, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { useHistory } from "@/hooks/use-history"
import { useRecordingActions } from "@/hooks/use-storage"
import { useCheckInSessionActions } from "@/hooks/use-storage"
import { DecorativeGrid } from "@/components/ui/decorative-grid"
import { VoiceNoteCard, AIChatCard } from "@/components/dashboard/history-cards"
import { ChatSessionDrawer } from "@/components/dashboard/chat-session-drawer"
import { CheckInDrawer } from "@/components/dashboard/check-in-drawer"
import { getDateKey, getDateLabel } from "@/lib/date-utils"
import type { Recording, HistoryItem, CheckInSession } from "@/lib/types"

/** Filter options for the sessions timeline */
type FilterType = "all" | "voice_note" | "ai_chat"

/**
 * Main history page content component
 *
 * Handles:
 * - Fetching and displaying unified history timeline
 * - Opening/closing detail drawer for chat sessions
 * - Opening/closing drawer to create new recording
 * - Deleting recordings and sessions
 * - Highlighting newly created items with animation
 */
function HistoryPageContent() {
  const searchParams = useSearchParams()
  const { shouldAnimate } = useDashboardAnimation()

  // Animation state
  const [visible, setVisible] = useState(!shouldAnimate)

  // Drawer states
  const [checkInDrawerOpen, setCheckInDrawerOpen] = useState(false)
  const [selectedChatSession, setSelectedChatSession] = useState<CheckInSession | null>(null)

  // Highlight state for newly created items
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null)

  // Filter state for timeline
  const [filter, setFilter] = useState<FilterType>("all")

  // Fetch unified history timeline
  const historyItems = useHistory()

  // Filter items based on selected filter
  const filteredItems = useMemo(() => {
    if (filter === "all") return historyItems
    return historyItems.filter((item) => item.type === filter)
  }, [historyItems, filter])

  // Group filtered items by date for section dividers
  const groupedByDate = useMemo(() => {
    const groups: { dateKey: string; dateLabel: string; items: HistoryItem[] }[] = []
    let currentDateKey: string | null = null

    for (const item of filteredItems) {
      const itemDate = item.type === "voice_note"
        ? item.recording.createdAt
        : item.session.startedAt
      const dateKey = getDateKey(itemDate)

      if (dateKey !== currentDateKey) {
        // Start a new date group
        groups.push({
          dateKey,
          dateLabel: getDateLabel(itemDate),
          items: [item],
        })
        currentDateKey = dateKey
      } else {
        // Add to the current group
        groups[groups.length - 1].items.push(item)
      }
    }

    return groups
  }, [filteredItems])

  // Get delete actions for both types
  const { deleteRecording } = useRecordingActions()
  const { deleteCheckInSession, deleteEmptyCheckInSessions } = useCheckInSessionActions()

  // Trigger entry animation on page load
  useEffect(() => {
    if (shouldAnimate) {
      const timer = setTimeout(() => setVisible(true), 100)
      return () => clearTimeout(timer)
    }
  }, [shouldAnimate])

  // Clean up any legacy empty sessions on first load
  // These are leftovers from sessions that were started but never used
  useEffect(() => {
    deleteEmptyCheckInSessions()
  }, [deleteEmptyCheckInSessions])

  // Check for auto-open param in URL (triggered from overview page check-in button)
  useEffect(() => {
    if (searchParams.get("newCheckIn") === "true") {
      setCheckInDrawerOpen(true)
      window.history.replaceState({}, "", "/dashboard/history")
    }
  }, [searchParams])

  // Check for highlight param (from calendar navigation or new item)
  useEffect(() => {
    const highlightId = searchParams.get("highlight")
    if (highlightId) {
      setHighlightedItemId(highlightId)

      // Scroll into view after rendering
      setTimeout(() => {
        const element = document.getElementById(`history-recording-${highlightId}`)
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" })
        }
      }, 100)

      // Clean up URL
      window.history.replaceState({}, "", "/dashboard/history")
    }
  }, [searchParams])

  // Clear highlight after animation completes
  useEffect(() => {
    if (highlightedItemId) {
      const timer = setTimeout(() => setHighlightedItemId(null), 2000)
      return () => clearTimeout(timer)
    }
  }, [highlightedItemId])

  // Delete a recording
  const handleDeleteRecording = useCallback((recordingId: string) => {
    deleteRecording(recordingId)
  }, [deleteRecording])

  // Delete a chat session
  const handleDeleteSession = useCallback((sessionId: string) => {
    deleteCheckInSession(sessionId)
  }, [deleteCheckInSession])

  // Open chat detail drawer
  const handleOpenChatDetail = useCallback((session: CheckInSession) => {
    setSelectedChatSession(session)
  }, [])

  // Handle new recording completion (voice note)
  const handleRecordingComplete = useCallback((recording: Recording) => {
    setHighlightedItemId(recording.id)
  }, [])

  // Handle new AI chat session completion
  const handleSessionComplete = useCallback((session: CheckInSession) => {
    setHighlightedItemId(session.id)
  }, [])

  // Open check-in drawer
  const handleOpenCheckInDrawer = useCallback(() => {
    setCheckInDrawerOpen(true)
  }, [])

  return (
    <div className="min-h-screen bg-transparent relative overflow-hidden">
      <main className="px-8 md:px-16 lg:px-20 pt-28 pb-12 relative z-10">
        {/* HERO SECTION - min-h-[200px]: ensures consistent grid fade appearance across all dashboard pages */}
        <div className="relative mb-12 overflow-hidden rounded-lg p-6 min-h-[200px] flex items-center">
          <DecorativeGrid />
          <div
            className={cn(
              "relative transition-all duration-1000 delay-100",
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
            )}
          >
            <h1 className="text-3xl md:text-4xl font-serif leading-[0.95] mb-3">
              Your <span className="text-accent">sessions</span>
            </h1>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-xl mb-4">
              View all your voice notes and AI chat sessions in one place. Track your wellness
              journey and see how your stress and fatigue levels change over time.
            </p>
            <Button
              onClick={handleOpenCheckInDrawer}
              className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2"
            >
              <Plus className="h-4 w-4" />
              New Check-in
            </Button>

            {/* Filter toggle buttons */}
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => setFilter("all")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                  filter === "all"
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                All
              </button>
              <button
                onClick={() => setFilter("voice_note")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5",
                  filter === "voice_note"
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Mic className="h-3.5 w-3.5" />
                Voice Notes
              </button>
              <button
                onClick={() => setFilter("ai_chat")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5",
                  filter === "ai_chat"
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                AI Chats
              </button>
            </div>
          </div>
        </div>

        {/* HISTORY TIMELINE */}
        <div
          className={cn(
            "relative transition-all duration-1000 delay-200",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
          )}
        >
          {historyItems.length === 0 ? (
            // EMPTY STATE - no sessions at all
            <div className="rounded-2xl border border-border/70 bg-card/30 backdrop-blur-xl p-12">
              <Empty>
                <EmptyMedia variant="icon">
                  <Clock />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>No sessions yet</EmptyTitle>
                  <EmptyDescription>
                    Start recording voice notes or having AI conversations to build your wellness
                    journey.
                  </EmptyDescription>
                </EmptyHeader>
                <Button
                  onClick={handleOpenCheckInDrawer}
                  className="bg-accent text-accent-foreground hover:bg-accent/90 mt-4"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Start Your First Check-in
                </Button>
              </Empty>
            </div>
          ) : filteredItems.length === 0 ? (
            // EMPTY STATE - no items matching current filter
            <div className="rounded-2xl border border-border/70 bg-card/30 backdrop-blur-xl p-12">
              <Empty>
                <EmptyMedia variant="icon">
                  {filter === "voice_note" ? <Mic /> : <MessageSquare />}
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>
                    No {filter === "voice_note" ? "voice notes" : "AI chats"} yet
                  </EmptyTitle>
                  <EmptyDescription>
                    {filter === "voice_note"
                      ? "Record a voice note to track your stress and fatigue levels."
                      : "Start an AI conversation to talk through how you're feeling."}
                  </EmptyDescription>
                </EmptyHeader>
                <Button
                  onClick={() => setFilter("all")}
                  variant="outline"
                  className="mt-4"
                >
                  Show All Sessions
                </Button>
              </Empty>
            </div>
          ) : (
            // HISTORY TIMELINE - mixed voice notes and AI chats, grouped by date
            <div className="space-y-4">
              {groupedByDate.map((group) => (
                <div key={group.dateKey}>
                  {/* Date section divider */}
                  <div className="flex items-center gap-3 py-2 mb-4">
                    <div className="h-px flex-1 bg-border/50" />
                    <span className="text-xs font-medium text-muted-foreground">
                      {group.dateLabel}
                    </span>
                    <div className="h-px flex-1 bg-border/50" />
                  </div>

                  {/* Items for this date */}
                  <div className="space-y-4">
                    {group.items.map((item) => {
                      // VOICE NOTE card
                      if (item.type === "voice_note") {
                        return (
                          <VoiceNoteCard
                            key={item.id}
                            item={item}
                            onDelete={() => handleDeleteRecording(item.recording.id)}
                            onOpenChat={(sessionId) => {
                              // Find the session and open its detail drawer
                              const chatItem = historyItems.find(
                                (h) => h.type === "ai_chat" && h.session.id === sessionId
                              )
                              if (chatItem && chatItem.type === "ai_chat") {
                                handleOpenChatDetail(chatItem.session)
                              }
                            }}
                            isHighlighted={item.id === highlightedItemId}
                          />
                        )
                      }

                      // AI CHAT card
                      if (item.type === "ai_chat") {
                        return (
                          <AIChatCard
                            key={item.id}
                            item={item}
                            onDelete={() => handleDeleteSession(item.session.id)}
                            onOpenDetail={() => handleOpenChatDetail(item.session)}
                          />
                        )
                      }

                      return null
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Check-in Drawer - for creating new check-ins (voice note or AI chat) */}
      <CheckInDrawer
        open={checkInDrawerOpen}
        onOpenChange={setCheckInDrawerOpen}
        onRecordingComplete={handleRecordingComplete}
        onSessionComplete={handleSessionComplete}
      />

      {/* Chat Session Detail Drawer - for viewing full conversations */}
      <ChatSessionDrawer session={selectedChatSession} onClose={() => setSelectedChatSession(null)} />
    </div>
  )
}

/**
 * Page wrapper with Suspense boundary
 * Handles async operations like reading search params
 */
export default function HistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryPageContent />
    </Suspense>
  )
}
