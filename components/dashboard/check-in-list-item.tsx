/**
 * Check-in List Item Component
 *
 * A compact sidebar list item for displaying AI chat check-ins
 * in the ChatGPT-style sidebar. Uses shadcn/ui SidebarMenuButton.
 */

"use client"

import { MessageSquare } from "@/lib/icons"
import { motion } from "framer-motion"
import { SidebarMenuButton } from "@/components/ui/sidebar"
import { Checkbox } from "@/components/ui/checkbox"
import { formatTime } from "@/lib/date-utils"
import { useTimeZone } from "@/lib/timezone-context"
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
function scoreToBand(score: number | undefined): "low" | "medium" | "high" | "unknown" {
  if (score === undefined) return "unknown"
  if (score < 34) return "low"
  if (score < 67) return "medium"
  return "high"
}

function getPreviewText(item: HistoryItem): string {
  // AI Chat - show metrics or first user message
  if (item.session.acousticMetrics) {
    const stress = scoreToBand(item.session.acousticMetrics.stressScore)
    const fatigue = scoreToBand(item.session.acousticMetrics.fatigueScore)
    return `Stress: ${stress} • Fatigue: ${fatigue}`
  }
  const firstUserMessage = item.session.messages.find((m) => m.role === "user")
  if (firstUserMessage) {
    return firstUserMessage.content
  }
  return `${item.session.messages.length} messages`
}

export function CheckInListItem({
  item,
  isSelected,
  onSelect,
  showCheckbox = false,
  isChecked = false,
  onCheckChange,
}: CheckInListItemProps) {
  const { timeZone } = useTimeZone()
  const Icon = MessageSquare
  const preview = getPreviewText(item)
  const time = formatTime(item.timestamp, timeZone)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      if (showCheckbox) {
        onCheckChange?.(!isChecked)
      } else {
        onSelect()
      }
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
        onClick={showCheckbox ? () => onCheckChange?.(!isChecked) : onSelect}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        className="h-auto py-2.5 px-3 cursor-pointer"
        tooltip={preview}
      >
        <div className="flex items-start gap-2.5 w-full min-w-0">
          {/* Checkbox for multi-select */}
          {showCheckbox && (
            <div className="shrink-0 pt-0.5">
              <Checkbox
                checked={isChecked}
                onCheckedChange={(checked) => onCheckChange?.(checked === true)}
                className="border-muted-foreground/50 data-[state=checked]:bg-accent data-[state=checked]:border-accent"
              />
            </div>
          )}
          <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{time}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                Chat
              </span>
            </div>
            <p className="text-sm truncate mt-0.5">{preview}</p>
          </div>
        </div>
      </SidebarMenuButton>
    </motion.div>
  )
}
