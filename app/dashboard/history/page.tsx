/**
 * Check-ins Page (formerly Sessions)
 *
 * ChatGPT-style layout with sidebar for check-in history and inline content display.
 * Voice notes and AI chats are shown in a unified sidebar list.
 *
 * Features:
 * - Sidebar with chronological check-in list (grouped by date)
 * - Main content area shows selected item details inline
 * - New check-in mode with Voice Note / AI Chat tabs
 * - Filter toggle (All / Voice Notes / AI Chats)
 * - Mobile: sidebar becomes a Sheet
 */

"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Clock, Plus, Mic, MessageSquare, Sparkles } from "lucide-react"
import { useDashboardAnimation } from "../layout"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Empty, EmptyMedia, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useHistory } from "@/hooks/use-history"
import { useRecordingActions, useCheckInSessionActions } from "@/hooks/use-storage"
import { CheckInListItem } from "@/components/dashboard/check-in-list-item"
import { VoiceNoteDetailView } from "@/components/dashboard/voice-note-detail-view"
import { AIChatDetailView } from "@/components/dashboard/ai-chat-detail-view"
import { CheckInInputBar } from "@/components/dashboard/check-in-input-bar"
import { VoiceNoteContent } from "@/components/dashboard/check-in-voice-note"
import { AIChatContent } from "@/components/dashboard/check-in-ai-chat"
import { getDateKey, getDateLabel } from "@/lib/date-utils"
import type { Recording, HistoryItem, CheckInSession } from "@/lib/types"

/** Filter options for the check-ins list */
type FilterType = "all" | "voice_note" | "ai_chat"

/** Check-in creation mode */
type CheckInMode = "voice-note" | "ai-chat"

/**
 * Main sidebar content component
 */
function CheckInsSidebar({
  groupedByDate,
  selectedItemId,
  onSelectItem,
  filter,
  onFilterChange,
  onNewCheckIn,
  historyItems,
}: {
  groupedByDate: { dateKey: string; dateLabel: string; items: HistoryItem[] }[]
  selectedItemId: string | null
  onSelectItem: (item: HistoryItem) => void
  filter: FilterType
  onFilterChange: (filter: FilterType) => void
  onNewCheckIn: () => void
  historyItems: HistoryItem[]
}) {
  const { setOpenMobile, isMobile } = useSidebar()

  const handleSelectItem = useCallback(
    (item: HistoryItem) => {
      onSelectItem(item)
      // On mobile, close sidebar after selection
      if (isMobile) {
        setOpenMobile(false)
      }
    },
    [onSelectItem, isMobile, setOpenMobile]
  )

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-border/50">
      {/* Header with New Check-in button */}
      <SidebarHeader className="px-4 py-4 border-b border-border/50">
        <Button
          onClick={onNewCheckIn}
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90 gap-2"
        >
          <Sparkles className="h-4 w-4" />
          New Check-in
        </Button>
      </SidebarHeader>

      {/* Check-in list */}
      <SidebarContent className="px-2">
        {historyItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Clock className="h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No check-ins yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Start your first check-in above
            </p>
          </div>
        ) : groupedByDate.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <p className="text-sm text-muted-foreground">No matching check-ins</p>
          </div>
        ) : (
          groupedByDate.map((group) => (
            <SidebarGroup key={group.dateKey}>
              <SidebarGroupLabel className="text-xs text-muted-foreground/70">
                {group.dateLabel}
              </SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <CheckInListItem
                      item={item}
                      isSelected={selectedItemId === item.id}
                      onSelect={() => handleSelectItem(item)}
                    />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ))
        )}
      </SidebarContent>

      {/* Footer with filter toggle */}
      <SidebarFooter className="px-4 py-3 border-t border-border/50">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onFilterChange("all")}
            className={cn(
              "flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all",
              filter === "all"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            All
          </button>
          <button
            onClick={() => onFilterChange("voice_note")}
            className={cn(
              "flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1",
              filter === "voice_note"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Mic className="h-3 w-3" />
            Voice
          </button>
          <button
            onClick={() => onFilterChange("ai_chat")}
            className={cn(
              "flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1",
              filter === "ai_chat"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <MessageSquare className="h-3 w-3" />
            Chat
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

/**
 * New Check-in inline content with mode tabs
 */
function NewCheckInContent({
  mode,
  onModeChange,
  onClose,
  onRecordingComplete,
  onSessionComplete,
  isSessionActive,
  onSessionChange,
}: {
  mode: CheckInMode
  onModeChange: (mode: CheckInMode) => void
  onClose: () => void
  onRecordingComplete?: (recording: Recording) => void
  onSessionComplete?: (session: CheckInSession) => void
  isSessionActive: boolean
  onSessionChange: (active: boolean) => void
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header with mode tabs */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-accent/10">
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <h2 className="text-lg font-semibold">New Check-in</h2>
        </div>
        {!isSessionActive && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        )}
      </div>

      {/* Mode toggle tabs */}
      <div className="px-6 py-3 border-b border-border/50">
        <Tabs value={mode} onValueChange={(v) => onModeChange(v as CheckInMode)}>
          <TabsList className="w-full">
            <TabsTrigger value="voice-note" className="flex-1" disabled={isSessionActive}>
              Voice note
            </TabsTrigger>
            <TabsTrigger value="ai-chat" className="flex-1" disabled={isSessionActive}>
              AI chat
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content based on mode */}
      <div className="flex-1 overflow-hidden">
        {mode === "voice-note" ? (
          <VoiceNoteContent
            onClose={onClose}
            onSessionChange={onSessionChange}
            onRecordingComplete={onRecordingComplete}
          />
        ) : (
          <AIChatContent
            onClose={onClose}
            onSessionChange={onSessionChange}
            onSessionComplete={onSessionComplete}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Main history page content component
 */
function HistoryPageContent() {
  const searchParams = useSearchParams()
  const { shouldAnimate } = useDashboardAnimation()

  // Animation state
  const [visible, setVisible] = useState(!shouldAnimate)

  // Selection and creation state
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [newCheckInMode, setNewCheckInMode] = useState<CheckInMode>("voice-note")
  const [isSessionActive, setIsSessionActive] = useState(false)

  // Highlight state for newly created items
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null)

  // Filter state
  const [filter, setFilter] = useState<FilterType>("all")

  // Fetch unified history timeline
  const historyItems = useHistory()

  // Filter items based on selected filter
  const filteredItems = useMemo(() => {
    if (filter === "all") return historyItems
    return historyItems.filter((item) => item.type === filter)
  }, [historyItems, filter])

  // Group filtered items by date for sidebar sections
  const groupedByDate = useMemo(() => {
    const groups: { dateKey: string; dateLabel: string; items: HistoryItem[] }[] = []
    let currentDateKey: string | null = null

    for (const item of filteredItems) {
      const itemDate = item.type === "voice_note" ? item.recording.createdAt : item.session.startedAt
      const dateKey = getDateKey(itemDate)

      if (dateKey !== currentDateKey) {
        groups.push({
          dateKey,
          dateLabel: getDateLabel(itemDate),
          items: [item],
        })
        currentDateKey = dateKey
      } else {
        groups[groups.length - 1].items.push(item)
      }
    }

    return groups
  }, [filteredItems])

  // Get delete actions
  const { deleteRecording } = useRecordingActions()
  const { deleteCheckInSession, deleteIncompleteSessions } = useCheckInSessionActions()

  // Derive selected item
  const selectedItem = useMemo(
    () => historyItems.find((item) => item.id === selectedItemId) || null,
    [historyItems, selectedItemId]
  )

  // Trigger entry animation
  useEffect(() => {
    if (shouldAnimate) {
      const timer = setTimeout(() => setVisible(true), 100)
      return () => clearTimeout(timer)
    }
  }, [shouldAnimate])

  // Clean up incomplete sessions on first load
  useEffect(() => {
    deleteIncompleteSessions()
  }, [deleteIncompleteSessions])

  // Check for auto-open param in URL
  useEffect(() => {
    if (searchParams.get("newCheckIn") === "true") {
      setIsCreatingNew(true)
      window.history.replaceState({}, "", "/dashboard/history")
    }
  }, [searchParams])

  // Check for highlight param
  useEffect(() => {
    const highlightId = searchParams.get("highlight")
    if (highlightId) {
      setHighlightedItemId(highlightId)
      setSelectedItemId(highlightId)
      window.history.replaceState({}, "", "/dashboard/history")
    }
  }, [searchParams])

  // Clear highlight after animation
  useEffect(() => {
    if (highlightedItemId) {
      const timer = setTimeout(() => setHighlightedItemId(null), 2000)
      return () => clearTimeout(timer)
    }
  }, [highlightedItemId])

  // Clear selection when filtered item is hidden
  // This ensures the detail view cannot display items outside the filtered set
  useEffect(() => {
    if (selectedItemId && !filteredItems.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(null)
    }
  }, [filteredItems, selectedItemId])

  // Handle selecting an item
  const handleSelectItem = useCallback((item: HistoryItem) => {
    setSelectedItemId(item.id)
    setIsCreatingNew(false)
  }, [])

  // Handle delete
  const handleDeleteRecording = useCallback(
    (recordingId: string) => {
      deleteRecording(recordingId)
      if (selectedItemId === recordingId) {
        setSelectedItemId(null)
      }
    },
    [deleteRecording, selectedItemId]
  )

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      deleteCheckInSession(sessionId)
      if (selectedItemId === sessionId) {
        setSelectedItemId(null)
      }
    },
    [deleteCheckInSession, selectedItemId]
  )

  // Handle new recording/session completion
  const handleRecordingComplete = useCallback((recording: Recording) => {
    setHighlightedItemId(recording.id)
    setSelectedItemId(recording.id)
    setIsCreatingNew(false)
    setIsSessionActive(false)
  }, [])

  const handleSessionComplete = useCallback((session: CheckInSession) => {
    setHighlightedItemId(session.id)
    setSelectedItemId(session.id)
    setIsCreatingNew(false)
    setIsSessionActive(false)
  }, [])

  // Handle starting new check-in
  const handleStartNewCheckIn = useCallback(() => {
    setIsCreatingNew(true)
    setSelectedItemId(null)
  }, [])

  // Handle closing new check-in mode
  const handleCloseNewCheckIn = useCallback(() => {
    setIsCreatingNew(false)
    setIsSessionActive(false)
  }, [])

  // Handle opening linked items
  const handleOpenLinkedChat = useCallback(
    (sessionId: string) => {
      const chatItem = historyItems.find(
        (h) => h.type === "ai_chat" && h.session.id === sessionId
      )
      if (chatItem) {
        setSelectedItemId(chatItem.id)
      }
    },
    [historyItems]
  )

  const handleOpenLinkedRecording = useCallback(
    (recordingId: string) => {
      const recordingItem = historyItems.find(
        (h) => h.type === "voice_note" && h.recording.id === recordingId
      )
      if (recordingItem) {
        setSelectedItemId(recordingItem.id)
      }
    },
    [historyItems]
  )

  return (
    <div
      className={cn(
        "min-h-screen transition-all duration-500",
        visible ? "opacity-100" : "opacity-0"
      )}
    >
      <SidebarProvider defaultOpen={true}>
        <CheckInsSidebar
          groupedByDate={groupedByDate}
          selectedItemId={selectedItemId}
          onSelectItem={handleSelectItem}
          filter={filter}
          onFilterChange={setFilter}
          onNewCheckIn={handleStartNewCheckIn}
          historyItems={historyItems}
        />

        <SidebarInset className="flex flex-col">
          {/* Header */}
          <header className="flex items-center gap-2 px-4 py-3 border-b border-border/50 md:hidden">
            <SidebarTrigger className="-ml-1" />
            <h1 className="text-sm font-medium">Check-ins</h1>
          </header>

          {/* Main content area */}
          <main className="flex-1 min-h-0 overflow-hidden">
            <AnimatePresence mode="wait">
              {isCreatingNew ? (
                <motion.div
                  key="new-checkin"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                  className="h-full"
                >
                  <NewCheckInContent
                    mode={newCheckInMode}
                    onModeChange={setNewCheckInMode}
                    onClose={handleCloseNewCheckIn}
                    onRecordingComplete={handleRecordingComplete}
                    onSessionComplete={handleSessionComplete}
                    isSessionActive={isSessionActive}
                    onSessionChange={setIsSessionActive}
                  />
                </motion.div>
              ) : selectedItem ? (
                <motion.div
                  key={selectedItem.id}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                  className="h-full"
                >
                  {selectedItem.type === "voice_note" ? (
                    <VoiceNoteDetailView
                      recording={selectedItem.recording}
                      onDelete={() => handleDeleteRecording(selectedItem.recording.id)}
                      onOpenLinkedChat={handleOpenLinkedChat}
                      linkedChatSessionId={selectedItem.linkedChatSessionId}
                    />
                  ) : (
                    <AIChatDetailView
                      session={selectedItem.session}
                      onDelete={() => handleDeleteSession(selectedItem.session.id)}
                      linkedRecordingId={selectedItem.linkedRecordingId}
                      onOpenLinkedRecording={handleOpenLinkedRecording}
                    />
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="h-full flex items-center justify-center p-8"
                >
                  <Empty>
                    <EmptyMedia variant="icon">
                      <Sparkles />
                    </EmptyMedia>
                    <EmptyHeader>
                      <EmptyTitle>
                        {historyItems.length === 0
                          ? "Start your wellness journey"
                          : "Select a check-in"}
                      </EmptyTitle>
                      <EmptyDescription>
                        {historyItems.length === 0
                          ? "Record a voice note or start an AI chat to track your stress and energy levels."
                          : "Choose a check-in from the sidebar to view its details, or start a new one."}
                      </EmptyDescription>
                    </EmptyHeader>
                    <Button
                      onClick={handleStartNewCheckIn}
                      className="bg-accent text-accent-foreground hover:bg-accent/90 mt-4"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      New Check-in
                    </Button>
                  </Empty>
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {/* Bottom input bar (only when not creating new) */}
          {!isCreatingNew && <CheckInInputBar onStartNewCheckIn={handleStartNewCheckIn} />}
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}

/**
 * Page wrapper with Suspense boundary
 */
export default function HistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryPageContent />
    </Suspense>
  )
}
