"use client"

import { useState } from "react"
import { Clock, Coffee, Dumbbell, Brain, Users, Moon } from "lucide-react"
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

const categoryColors: Record<SuggestionCategory, { text: string; bg: string; border: string }> = {
  break: { text: "text-accent", bg: "bg-accent/10", border: "border-accent/30" },
  exercise: { text: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/30" },
  mindfulness: { text: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/30" },
  social: { text: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  rest: { text: "text-indigo-500", bg: "bg-indigo-500/10", border: "border-indigo-500/30" },
}

interface DraggableSuggestionCardProps {
  suggestion: Suggestion
  onClick?: () => void
  onDragStart?: (suggestion: Suggestion) => void
  onDragEnd?: () => void
}

export function DraggableSuggestionCard({
  suggestion,
  onClick,
  onDragStart,
  onDragEnd
}: DraggableSuggestionCardProps) {
  const [isDragging, setIsDragging] = useState(false)

  const Icon = categoryIcons[suggestion.category]
  const colors = categoryColors[suggestion.category]
  const title = extractTitle(suggestion.content)

  const handleDragStart = (e: React.DragEvent) => {
    // Store suggestion ID in dataTransfer for drop handler
    e.dataTransfer.setData("application/suggestion-id", suggestion.id)
    e.dataTransfer.setData("text/plain", suggestion.id)
    e.dataTransfer.effectAllowed = "move"

    setIsDragging(true)
    onDragStart?.(suggestion)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    onDragEnd?.()
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={onClick}
      className={cn(
        "group rounded-lg border bg-card/40 backdrop-blur-sm p-3 transition-all cursor-grab active:cursor-grabbing",
        "hover:border-accent/50 hover:bg-card/60",
        colors.border,
        isDragging && "opacity-50 scale-95 border-accent/70"
      )}
      role="listitem"
      aria-label={`${suggestion.category} suggestion: ${title}. Duration: ${suggestion.duration} minutes. Drag to calendar to schedule.`}
    >
      <div className="flex items-start gap-3">
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
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
              <Clock className="h-2.5 w-2.5 mr-1" aria-hidden="true" />
              {suggestion.duration}m
            </Badge>
          </div>

          <p className="text-sm font-medium leading-snug line-clamp-2">
            {title}
          </p>

          {/* Drag hint */}
          <p className="text-[10px] text-muted-foreground/70 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            Drag to calendar or click to schedule
          </p>
        </div>
      </div>
    </div>
  )
}

// Helper to extract short title
function extractTitle(content: string, maxLength = 50): string {
  const firstSentence = content.split(/[.!?]/)[0]?.trim()
  if (!firstSentence) return content.slice(0, maxLength)
  if (firstSentence.length <= maxLength) return firstSentence
  const truncated = firstSentence.slice(0, maxLength)
  const lastSpace = truncated.lastIndexOf(" ")
  return (lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated) + "..."
}
