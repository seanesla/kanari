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
 * - Filter toggle (All / AI Chats)
 * - Mobile: sidebar becomes a Sheet
 */

"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Clock, Plus, MessageSquare, Sparkles, CheckSquare } from "@/lib/icons"
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
import { useHistory } from "@/hooks/use-history"
import { useCheckInSessionActions } from "@/hooks/use-storage"
import { CheckInListItem } from "@/components/dashboard/check-in-list-item"
import { AIChatDetailView } from "@/components/dashboard/ai-chat-detail-view"
import { CheckInInputBar } from "@/components/dashboard/check-in-input-bar"
import { AIChatContent } from "@/components/dashboard/check-in-ai-chat"
import { getDateKey, getDateLabel } from "@/lib/date-utils"
import { SelectionActionBar } from "@/components/dashboard/selection-action-bar"
import { BatchDeleteConfirmDialog } from "@/components/dashboard/batch-delete-confirm-dialog"
import { useCursorGlow } from "@/hooks/use-cursor-glow"
import { CursorBorderGlow } from "@/components/ui/cursor-border-glow"
import { useTimeZone } from "@/lib/timezone-context"
import type { HistoryItem, CheckInSession } from "@/lib/types"

/** Filter options for the check-ins list */
type FilterType = "all" | "ai_chat"

/**
 * Main sidebar content component
 * Uses offcanvas collapsible - fully hides when collapsed
 */
function CheckInsSidebar({
  groupedByDate,
  selectedItemId,
  onSelectItem,
  filter,
  onFilterChange,
  onNewCheckIn,
  historyItems,
  isSelectMode,
  selectedIds,
  onToggleSelect,
  onToggleSelectMode,
}: {
  groupedByDate: { dateKey: string; dateLabel: string; items: HistoryItem[] }[]
  selectedItemId: string | null
  onSelectItem: (item: HistoryItem) => void
  filter: FilterType
  onFilterChange: (filter: FilterType) => void
  onNewCheckIn: () => void
  historyItems: HistoryItem[]
  isSelectMode: boolean
  selectedIds: Set<string>
  onToggleSelect: (id: string, checked: boolean) => void
  onToggleSelectMode: () => void
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
    >
      <div
        className="relative h-full w-full rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.02)] backdrop-blur-2xl backdrop-saturate-200 flex flex-col group"
        onMouseMove={glow.onMouseMove}
        onMouseLeave={glow.onMouseLeave}
        style={{
          ...glow.style,
          boxShadow:
            "inset 0 1px 0 0 rgba(255, 255, 255, 0.06), inset 0 -1px 0 0 rgba(0, 0, 0, 0.02), 0 8px 32px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.1)",
        }}
      >
        <CursorBorderGlow
          className="rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          size={300}
          borderWidth={2}
        />

        {/* Header with New Check-in button and select mode toggle */}
        <SidebarHeader className="px-4 py-4 border-b border-border/30">
          <div className="flex items-center gap-2">
            <Button
              onClick={onNewCheckIn}
              className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 gap-2"
            >
              <Sparkles className="h-4 w-4" />
              New Check-in
            </Button>
            {historyItems.length > 0 && (
              <Button
                variant={isSelectMode ? "secondary" : "ghost"}
                size="icon"
                onClick={onToggleSelectMode}
                title={isSelectMode ? "Cancel selection" : "Select items"}
              >
                <CheckSquare className="h-4 w-4" />
              </Button>
            )}
          </div>
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
                        showCheckbox={isSelectMode}
                        isChecked={selectedIds.has(item.id)}
                        onCheckChange={(checked) => onToggleSelect(item.id, checked)}
                      />
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            ))
          )}
        </SidebarContent>

        {/* Footer with filter toggle */}
        <SidebarFooter className="px-4 py-3 border-t border-border/30">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onFilterChange("all")}
              className={cn(
                "flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors",
                filter === "all"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              All
            </button>
            <button
              onClick={() => onFilterChange("ai_chat")}
              className={cn(
                "flex-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1",
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
      </div>
    </Sidebar>
  )
}

/**
 * New Check-in inline content (AI chat only)
 */
function NewCheckInContent({
  onClose,
  onSessionComplete,
  isSessionActive,
  onSessionChange,
}: {
  onClose: () => void
  onSessionComplete?: (session: CheckInSession) => void
  isSessionActive: boolean
  onSessionChange: (active: boolean) => void
}) {
  return (
    <div className={cn("flex flex-col h-full", isSessionActive && "p-3 md:p-4")}>
      <div
        className={cn(
          "flex flex-col h-full",
          isSessionActive &&
            "rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.02)] backdrop-blur-2xl backdrop-saturate-200 overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-1px_0_rgba(0,0,0,0.02),0_8px_32px_rgba(0,0,0,0.25),0_2px_8px_rgba(0,0,0,0.1)]"
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-center justify-between px-6 py-4 border-b",
            isSessionActive ? "border-white/10" : "border-accent/30"
          )}
        >
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

        <div className="flex-1 overflow-hidden">
          <AIChatContent
            onClose={onClose}
            onSessionChange={onSessionChange}
            onSessionComplete={onSessionComplete}
            chrome={isSessionActive ? "glass" : "default"}
          />
        </div>
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
  const { timeZone } = useTimeZone()

  // Animation state
  const [visible, setVisible] = useState(!shouldAnimate)

  // Selection and creation state
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [isSessionActive, setIsSessionActive] = useState(false)

  // Highlight state for newly created items
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null)

  // Filter state
  const [filter, setFilter] = useState<FilterType>("all")

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

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
  }, [filteredItems, timeZone])

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

  // Multi-select handlers
  const handleToggleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(filteredItems.map((item) => item.id)))
  }, [filteredItems])

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleToggleSelectMode = useCallback(() => {
    setIsSelectMode((prev) => !prev)
    if (isSelectMode) {
      setSelectedIds(new Set())
    }
  }, [isSelectMode])

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      deleteCheckInSession(sessionId)
      if (selectedItemId === sessionId) {
        setSelectedItemId(null)
      }
    },
    [deleteCheckInSession, selectedItemId]
  )

  // Handle batch delete
  const handleBatchDelete = useCallback(async () => {
    for (const id of selectedIds) {
      const item = historyItems.find((h) => h.id === id)
      if (item) {
        await deleteCheckInSession(item.session.id)
      }
    }
    setSelectedIds(new Set())
    setShowDeleteConfirm(false)
    setIsSelectMode(false)
    if (selectedItemId && selectedIds.has(selectedItemId)) {
      setSelectedItemId(null)
    }
  }, [selectedIds, historyItems, deleteCheckInSession, selectedItemId])

  const handleSessionComplete = useCallback((session: CheckInSession) => {
    setHighlightedItemId(session.id)
    setSelectedItemId(session.id)
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

  return (
    <div
      className={cn(
        "h-svh bg-transparent relative overflow-hidden transition-all duration-500",
        visible ? "opacity-100" : "opacity-0"
      )}
    >
      <SidebarProvider defaultOpen={true} transparent className="h-full">
        <CheckInsSidebar
          groupedByDate={groupedByDate}
          selectedItemId={selectedItemId}
          onSelectItem={handleSelectItem}
          filter={filter}
          onFilterChange={setFilter}
          onNewCheckIn={handleStartNewCheckIn}
          historyItems={historyItems}
          isSelectMode={isSelectMode}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleSelectMode={handleToggleSelectMode}
        />

        <SidebarInset transparent className="flex flex-col bg-transparent pb-3">
          {/* Header - mobile shows full header, desktop shows glassmorphic trigger */}
          <header className="md:hidden flex items-center gap-2 px-4 py-3 border-b border-accent/30">
            <SidebarTrigger className="-ml-1" />
            <h1 className="text-sm font-medium">Check-ins</h1>
          </header>

          {/* Desktop: Glassmorphic trigger button aligned with sidebar top */}
          <div className="hidden md:block absolute top-3 left-3 z-10">
            <div
              className="flex items-center justify-center rounded-xl border border-white/10 bg-[rgba(255,255,255,0.02)] backdrop-blur-2xl backdrop-saturate-200"
              style={{
                boxShadow:
                  "inset 0 1px 0 0 rgba(255, 255, 255, 0.06), inset 0 -1px 0 0 rgba(0, 0, 0, 0.02), 0 8px 32px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.1)",
              }}
            >
              <SidebarTrigger className="h-10 w-10 hover:bg-accent/10" />
            </div>
          </div>

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
                  <AIChatDetailView
                    session={selectedItem.session}
                    onDelete={() => handleDeleteSession(selectedItem.session.id)}
                  />
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

      {/* Selection action bar (floating at bottom) */}
      <SelectionActionBar
        selectedCount={selectedIds.size}
        totalCount={filteredItems.length}
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
        onDeleteSelected={() => setShowDeleteConfirm(true)}
      />

      {/* Delete confirmation dialog */}
      <BatchDeleteConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        selectedCount={selectedIds.size}
        onConfirm={handleBatchDelete}
      />
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
