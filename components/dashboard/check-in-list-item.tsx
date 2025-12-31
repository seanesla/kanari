/**
 * Check-in List Item Component
 *
 * A compact sidebar list item for displaying voice notes and AI chats
 * in the ChatGPT-style sidebar. Uses shadcn/ui SidebarMenuButton.
 */

"use client"

import { Mic, MessageSquare } from "lucide-react"
import { motion } from "framer-motion"
import { SidebarMenuButton } from "@/components/ui/sidebar"
import { Checkbox } from "@/components/ui/checkbox"
import { formatTime } from "@/lib/date-utils"
import type { HistoryItem } from "@/lib/types"

interface CheckInListItemProps {
  item: HistoryItem
  isSelected: boolean
  onSelect: () => void
  /** Show checkbox for multi-select mode */
  showCheckbox?: boolean
  /** Whether this item is checked */
  isChecked?: boolean
  /** Callback when checkbox state changes */
  onCheckChange?: (checked: boolean) => void
}

/**
 * Get a preview string for the check-in item
 */
function getPreviewText(item: HistoryItem): string {
  if (item.type === "voice_note") {
    // Use semantic analysis summary if available, otherwise show duration
    if (item.recording.semanticAnalysis?.summary) {
      return item.recording.semanticAnalysis.summary
    }
    if (item.recording.metrics) {
      return `Stress: ${item.recording.metrics.stressScore} • Fatigue: ${item.recording.metrics.fatigueScore}`
    }
    return "Voice recording"
  }

  // AI Chat - show first user message
  const firstUserMessage = item.session.messages.find((m) => m.role === "user")
  if (firstUserMessage) {
    return firstUserMessage.content
  }
  return `${item.session.messages.length} messages`
}

/**
 * Get the timestamp for display
 */
function getTimestamp(item: HistoryItem): string {
  const dateStr = item.type === "voice_note"
    ? item.recording.createdAt
    : item.session.startedAt
  return formatTime(dateStr)
}

export function CheckInListItem({
  item,
  isSelected,
  onSelect,
  showCheckbox = false,
  isChecked = false,
  onCheckChange,
}: CheckInListItemProps) {
  const Icon = item.type === "voice_note" ? Mic : MessageSquare
  const preview = getPreviewText(item)
  const time = getTimestamp(item)

  // Handle checkbox click without triggering item selection
  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onSelect()
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
    >
      <SidebarMenuButton
        asChild
        isActive={isSelected}
        onClick={onSelect}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        className="h-auto py-2.5 px-3 cursor-pointer"
        tooltip={preview}
      >
        <div className="flex items-start gap-2.5 w-full min-w-0">
          {/* Checkbox for multi-select */}
          {showCheckbox && (
            <div onClick={handleCheckboxClick} className="shrink-0 pt-0.5">
              <Checkbox
                checked={isChecked}
                onCheckedChange={(checked) => onCheckChange?.(checked === true)}
                className="data-[state=checked]:bg-accent data-[state=checked]:border-accent"
              />
            </div>
          )}
          <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{time}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                {item.type === "voice_note" ? "Voice" : "Chat"}
              </span>
            </div>
            <p className="text-sm truncate mt-0.5">{preview}</p>
          </div>
        </div>
      </SidebarMenuButton>
    </motion.div>
  )
}
