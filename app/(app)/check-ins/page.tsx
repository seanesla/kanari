/**
 * Check-ins Page (formerly Sessions)
 *
 * ChatGPT-style layout with sidebar for check-in history and inline content display.
 * AI chat sessions are shown in a unified sidebar list.
 *
 * Features:
 * - Sidebar with chronological check-in list (grouped by date)
 * - Main content area shows selected item details inline
 * - New check-in mode (AI chat)
 * - Mobile: sidebar becomes a Sheet
 */

"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, Clock, Plus, Sparkles } from "@/lib/icons"
import { useDashboardAnimation } from "@/lib/dashboard-animation-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Empty, EmptyMedia, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarEdgeTrigger,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import { useHistory } from "@/hooks/use-history"
import { useCheckInSessionActions } from "@/hooks/use-storage"
import { CheckInListItem } from "@/components/dashboard/check-in-list-item"
import { AIChatDetailView } from "@/components/dashboard/ai-chat-detail-view"
import { CheckInInputBar } from "@/components/dashboard/check-in-input-bar"
import { AIChatContent } from "@/components/dashboard/check-in-ai-chat"
import { Deck } from "@/components/dashboard/deck"
import { getDateKey, getDateLabel } from "@/lib/date-utils"
import { useCursorGlow } from "@/hooks/use-cursor-glow"
import { CursorBorderGlow } from "@/components/ui/cursor-border-glow"
import { useTimeZone } from "@/lib/timezone-context"
import type { HistoryItem, CheckInSession } from "@/lib/types"

/**
 * Main sidebar content component
 * Uses offcanvas collapsible - fully hides when collapsed
 */
function CheckInsSidebar({
  groupedByDate,
  selectedItemId,
  onSelectItem,
  onNewCheckIn,
  historyItems,
  isLoading,
}: {
  groupedByDate: { dateKey: string; dateLabel: string; items: HistoryItem[] }[]
  selectedItemId: string | null
  onSelectItem: (item: HistoryItem) => void
  onNewCheckIn: () => void
  historyItems: HistoryItem[]
  isLoading: boolean
}) {
  const { setOpenMobile, isMobile } = useSidebar()
  const glow = useCursorGlow({ clampToBorder: true, distanceIntensity: true })

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
    <Sidebar
      collapsible="offcanvas"
      transparent
      className="border-r border-transparent p-3"
      data-demo-id="demo-checkin-sidebar"
    >
      <Deck
        tone="raised"
        className="h-full w-full rounded-2xl flex flex-col group"
        onMouseMove={glow.onMouseMove}
        onMouseLeave={glow.onMouseLeave}
        style={glow.style}
      >
        {/* Clip only the glow (not the header controls) */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
          <CursorBorderGlow
            className="rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            size={300}
            borderWidth={2}
          />
        </div>

        {/* Header with New Check-in button and sidebar toggle */}
        <SidebarHeader className="px-3 py-3 border-b border-border/30">
          <div className="flex items-center gap-1.5 min-w-0">
            <Button
              onClick={onNewCheckIn}
              size="sm"
              className="flex-1 min-w-0 bg-accent text-accent-foreground hover:bg-accent/90"
              data-demo-id="demo-new-checkin-button"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="whitespace-nowrap">New Check-in</span>
            </Button>
            <div className="shrink-0 flex items-center rounded-xl border border-border/60 bg-muted/20 p-0.5">
              <SidebarTrigger
                className="shrink-0 rounded-lg hover:bg-white/5"
                title="Toggle sidebar"
              />
            </div>
          </div>
        </SidebarHeader>

        {/* Check-in list */}
        <SidebarContent
          className={cn(
            "px-2",
            // Scrollbar polish: hide the always-visible “scroll line” until hover, keep it thin.
            "[scrollbar-width:thin] [scrollbar-color:transparent_transparent]",
            "[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2",
            "[&::-webkit-scrollbar-track]:bg-transparent",
            "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-transparent",
            "hover:[&::-webkit-scrollbar-thumb]:bg-border/50"
          )}
        >
          {isLoading ? (
            <div className="py-4">
              {Array.from({ length: 8 }).map((_, idx) => (
                <SidebarMenuSkeleton key={idx} showIcon />
              ))}
            </div>
          ) : historyItems.length === 0 ? (
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
      </Deck>
    </Sidebar>
  )
}

/**
 * New Check-in inline content (AI chat only)
 */
function NewCheckInContent({
  onClose,
  onSessionComplete,
  onSessionChange,
  autoStart,
}: {
  onClose: () => void
  onSessionComplete?: (session: CheckInSession) => void
  onSessionChange: (active: boolean) => void
  autoStart?: boolean
}) {
  return (
    <div className="flex flex-col h-full p-3 md:p-4">
      <Deck tone="raised" className={cn("flex flex-col h-full rounded-2xl overflow-hidden")}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-accent/10">
              <Sparkles className="h-5 w-5 text-accent" />
            </div>
            <h2 className="text-base sm:text-lg font-semibold">New Check-in</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="flex-1 overflow-hidden">
          <AIChatContent
            onClose={onClose}
            onSessionChange={onSessionChange}
            onSessionComplete={onSessionComplete}
            autoStart={autoStart}
          />
        </div>
      </Deck>
    </div>
  )
}

/**
 * Main history page content component
 */
function HistoryPageContent() {
  const searchParams = useSearchParams()
  const { shouldAnimate } = useDashboardAnimation()
  const { timeZone } = useTimeZone()
  const isMobile = useIsMobile()

  // Animation state
  const [visible, setVisible] = useState(!shouldAnimate)

  // Selection and creation state
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [autoStartNewCheckIn, setAutoStartNewCheckIn] = useState(false)

  // Highlight state for newly created items
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null)

  // Fetch unified history timeline
  const { items: historyItems, isLoading: isHistoryLoading } = useHistory()

  // Group items by date for sidebar sections
  const groupedByDate = useMemo(() => {
    const groups: { dateKey: string; dateLabel: string; items: HistoryItem[] }[] = []
    let currentDateKey: string | null = null

    for (const item of historyItems) {
      const itemDate = item.timestamp
      const dateKey = getDateKey(itemDate, timeZone)

      if (dateKey !== currentDateKey) {
        groups.push({
          dateKey,
          dateLabel: getDateLabel(itemDate, timeZone),
          items: [item],
        })
        currentDateKey = dateKey
      } else {
        groups[groups.length - 1].items.push(item)
      }
    }

    return groups
  }, [historyItems, timeZone])

  // Get delete actions
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
      // This open is NOT from a direct click/tap, so don't auto-start.
      setAutoStartNewCheckIn(false)
      window.history.replaceState({}, "", "/check-ins")
    }
  }, [searchParams])

  // Check for highlight param
  useEffect(() => {
    const highlightId = searchParams.get("highlight")
    if (highlightId) {
      setHighlightedItemId(highlightId)
      setSelectedItemId(highlightId)
      window.history.replaceState({}, "", "/check-ins")
    }
  }, [searchParams])

  // Clear highlight after animation
  useEffect(() => {
    if (highlightedItemId) {
      const timer = setTimeout(() => setHighlightedItemId(null), 2000)
      return () => clearTimeout(timer)
    }
  }, [highlightedItemId])

  // Ensure the detail view can't display items that no longer exist
  useEffect(() => {
    if (selectedItemId && !historyItems.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(null)
    }
  }, [historyItems, selectedItemId])

  // Handle selecting an item
  const handleSelectItem = useCallback((item: HistoryItem) => {
    setSelectedItemId(item.id)
    setIsCreatingNew(false)
  }, [])

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      deleteCheckInSession(sessionId)
      if (selectedItemId === sessionId) {
        setSelectedItemId(null)
      }
    },
    [deleteCheckInSession, selectedItemId]
  )

  const handleSessionComplete = useCallback((session: CheckInSession) => {
    setHighlightedItemId(session.id)
    setSelectedItemId(session.id)
  }, [])

  // Handle starting new check-in
  const handleStartNewCheckIn = useCallback(() => {
    setAutoStartNewCheckIn(true)
    setIsCreatingNew(true)
    setSelectedItemId(null)
  }, [])

  const handleNewCheckInSessionChange = useCallback((active: boolean) => {
    if (active) {
      // Only auto-start once per open.
      setAutoStartNewCheckIn(false)
    }
  }, [])

  // Handle closing new check-in mode
  const handleCloseNewCheckIn = useCallback(() => {
    setIsCreatingNew(false)
    setAutoStartNewCheckIn(false)
  }, [])

  const handleBackToList = useCallback(() => {
    if (isCreatingNew) {
      handleCloseNewCheckIn()
      return
    }
    setSelectedItemId(null)
  }, [handleCloseNewCheckIn, isCreatingNew])

  return (
    <div
      data-demo-id="demo-history-page"
      className={cn(
        "h-svh bg-transparent relative overflow-hidden transition-all duration-500 pt-[calc(env(safe-area-inset-top)+4rem)] md:pt-0",
        visible ? "opacity-100" : "opacity-95"
      )}
    >
      <SidebarProvider defaultOpen={true} transparent className="h-full">
        <CheckInsSidebar
          groupedByDate={groupedByDate}
          selectedItemId={selectedItemId}
          onSelectItem={handleSelectItem}
          onNewCheckIn={handleStartNewCheckIn}
          historyItems={historyItems}
          isLoading={isHistoryLoading}
        />

        <SidebarInset
          transparent
          className="flex flex-col bg-transparent pb-[calc(env(safe-area-inset-bottom)+5rem)] md:pb-3"
        >
          {/* Header - mobile */}
          <header className="md:hidden flex items-center justify-between gap-2 px-4 py-3 border-b border-accent/30">
            {isCreatingNew || selectedItem ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="-ml-1"
                  onClick={handleBackToList}
                  aria-label="Back to check-ins"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h1 className="text-sm font-medium min-w-0 truncate">
                  {isCreatingNew ? "New Check-in" : "Check-in"}
                </h1>
                {selectedItem ? <SidebarTrigger className="-mr-1" /> : <div className="size-7" />}
              </>
            ) : (
              <>
                <div className="min-w-0">
                  <h1 className="text-sm font-medium">Check-ins</h1>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {isHistoryLoading ? "Loading…" : `${historyItems.length} total`}
                  </p>
                </div>
                <Button
                  onClick={handleStartNewCheckIn}
                  size="sm"
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  New
                </Button>
              </>
            )}
          </header>

          {/* Desktop: Edge-hover glow trigger (appears only when collapsed) */}
          <SidebarEdgeTrigger className="hidden md:block" />

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
                      onClose={handleCloseNewCheckIn}
                      onSessionComplete={handleSessionComplete}
                      onSessionChange={handleNewCheckInSessionChange}
                      autoStart={autoStartNewCheckIn}
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
                  <AIChatDetailView
                    session={selectedItem.session}
                    onDelete={() => handleDeleteSession(selectedItem.session.id)}
                  />
                </motion.div>
              ) : isMobile ? (
                <motion.div
                  key="mobile-history"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="h-full p-3"
                >
                  <Deck tone="raised" className="flex flex-col h-full rounded-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                      <h2 className="text-sm font-medium">Past check-ins</h2>
                      <Button variant="ghost" size="sm" onClick={handleStartNewCheckIn}>
                        <Plus className="h-4 w-4 mr-1.5" />
                        New
                      </Button>
                    </div>
                    <ScrollArea className="flex-1 min-h-0">
                      <div className="p-2">
                        {isHistoryLoading ? (
                          <div className="py-2">
                            {Array.from({ length: 10 }).map((_, idx) => (
                              <SidebarMenuSkeleton key={idx} showIcon />
                            ))}
                          </div>
                        ) : historyItems.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                            <Clock className="h-8 w-8 text-muted-foreground/50 mb-3" />
                            <p className="text-sm text-muted-foreground">No check-ins yet</p>
                            <p className="text-xs text-muted-foreground/70 mt-1">
                              Start your first check-in to see it here.
                            </p>
                            <Button
                              onClick={handleStartNewCheckIn}
                              className="bg-accent text-accent-foreground hover:bg-accent/90 mt-4"
                            >
                              <Sparkles className="mr-2 h-4 w-4" />
                              New Check-in
                            </Button>
                          </div>
                        ) : (
                          groupedByDate.map((group) => (
                            <div key={group.dateKey} className="py-2">
                              <div className="px-2 pb-2">
                                <p className="text-xs text-muted-foreground/70">{group.dateLabel}</p>
                              </div>
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
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </Deck>
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
                        {isHistoryLoading
                          ? "Loading check-ins…"
                          : historyItems.length === 0
                            ? "Start your wellness journey"
                            : "Select a check-in"}
                      </EmptyTitle>
                      <EmptyDescription>
                        {isHistoryLoading
                          ? "Fetching your previous check-ins."
                          : historyItems.length === 0
                            ? "Start an AI check-in to track your stress and energy levels."
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
