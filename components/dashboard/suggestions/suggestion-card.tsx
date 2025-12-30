"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Clock, GripVertical, Coffee, Dumbbell, Brain, Users, Moon, CheckCircle2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { Suggestion, SuggestionCategory } from "@/lib/types"

const categoryIcons: Record<SuggestionCategory, typeof Coffee> = {
  break: Coffee,
  exercise: Dumbbell,
  mindfulness: Brain,
  social: Users,
  rest: Moon,
}

const categoryColors: Record<SuggestionCategory, { text: string; bg: string }> = {
  break: { text: "text-accent", bg: "bg-accent/10" },
  exercise: { text: "text-green-500", bg: "bg-green-500/10" },
  mindfulness: { text: "text-purple-500", bg: "bg-purple-500/10" },
  social: { text: "text-blue-500", bg: "bg-blue-500/10" },
  rest: { text: "text-indigo-500", bg: "bg-indigo-500/10" },
}

interface SuggestionCardProps {
  suggestion: Suggestion
  onClick?: () => void
  isDragging?: boolean
}

export function SuggestionCard({ suggestion, onClick, isDragging }: SuggestionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: suggestion.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const Icon = categoryIcons[suggestion.category]
  const colors = categoryColors[suggestion.category]
  const isCompleted = suggestion.status === "accepted" || suggestion.status === "dismissed" || suggestion.status === "completed"
  const isScheduled = suggestion.status === "scheduled"
  const isDismissed = suggestion.status === "dismissed"

  // Extract a short title from content
  const title = extractTitle(suggestion.content)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group rounded-lg border bg-card/40 backdrop-blur-sm p-3 transition-all",
        "hover:border-accent/50 hover:bg-card/60",
        isDragging || isSortableDragging
          ? "border-accent/70 bg-card/70 shadow-lg shadow-accent/10 scale-[1.02] cursor-grabbing"
          : "border-border/70 cursor-pointer",
        isCompleted && "opacity-70",
        isDismissed && "opacity-50"
      )}
      onClick={onClick}
      role="listitem"
      aria-label={`${suggestion.category} suggestion: ${title}. Duration: ${suggestion.duration} minutes. Status: ${suggestion.status}`}
    >
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className={cn(
            "flex-shrink-0 mt-1 cursor-grab active:cursor-grabbing",
            "opacity-0 group-hover:opacity-60 transition-opacity",
            "focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-accent/50 rounded",
            (isDragging || isSortableDragging) && "opacity-60"
          )}
          aria-label={`Drag to reorder ${suggestion.category} suggestion`}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </button>

        {/* Category Icon */}
        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0", colors.bg)}>
          <Icon className={cn("h-4 w-4", colors.text)} aria-hidden="true" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className={cn("text-xs font-medium capitalize", colors.text)}>
              {suggestion.category}
            </span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5" aria-label={`${suggestion.duration} minutes`}>
              <Clock className="h-2.5 w-2.5 mr-1" aria-hidden="true" />
              {suggestion.duration}m
            </Badge>
          </div>

          <p className={cn(
            "text-sm font-medium leading-snug line-clamp-2",
            isDismissed && "line-through text-muted-foreground"
          )}>
            {title}
          </p>

          {/* Rationale */}
          {suggestion.rationale && (
            <p className="text-xs text-muted-foreground mt-1 italic line-clamp-1">
              {suggestion.rationale}
            </p>
          )}

          {/* Status indicator for scheduled items */}
          {isScheduled && suggestion.scheduledFor && (
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {formatScheduledTime(suggestion.scheduledFor)}
            </p>
          )}

          {/* Completed indicator */}
          {isCompleted && !isDismissed && (
            <div className="flex items-center gap-1 mt-1.5 text-xs text-success" aria-label="Completed">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              <span>Completed</span>
            </div>
          )}

          {isDismissed && (
            <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground" aria-label="Dismissed">
              <X className="h-3 w-3" aria-hidden="true" />
              <span>Dismissed</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Overlay version for drag preview
export function SuggestionCardOverlay({ suggestion }: { suggestion: Suggestion }) {
  return <SuggestionCard suggestion={suggestion} isDragging />
}

// Helper to extract short title
function extractTitle(content: string, maxLength = 60): string {
  const firstSentence = content.split(/[.!?]/)[0]?.trim()
  if (!firstSentence) return content.slice(0, maxLength)
  if (firstSentence.length <= maxLength) return firstSentence
  const truncated = firstSentence.slice(0, maxLength)
  const lastSpace = truncated.lastIndexOf(" ")
  return (lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated) + "..."
}

// Helper to format scheduled time
function formatScheduledTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const isTomorrow = date.toDateString() === new Date(now.getTime() + 86400000).toDateString()

  const timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })

  if (isToday) return `Today at ${timeStr}`
  if (isTomorrow) return `Tomorrow at ${timeStr}`
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) + ` at ${timeStr}`
}
