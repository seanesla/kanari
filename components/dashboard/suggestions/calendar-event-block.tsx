"use client"

import { Coffee, Dumbbell, Brain, Users, Moon } from "@/lib/icons"
import { cn } from "@/lib/utils"
import type { SuggestionCategory } from "@/lib/types"

const categoryIcons: Record<SuggestionCategory, typeof Coffee> = {
  break: Coffee,
  exercise: Dumbbell,
  mindfulness: Brain,
  social: Users,
  rest: Moon,
}

const categoryColors: Record<SuggestionCategory, { bg: string; border: string; text: string }> = {
  break: { bg: "bg-amber-500/20", border: "border-amber-500/40", text: "text-amber-500" },
  exercise: { bg: "bg-green-500/20", border: "border-green-500/40", text: "text-green-500" },
  mindfulness: { bg: "bg-purple-500/20", border: "border-purple-500/40", text: "text-purple-500" },
  social: { bg: "bg-blue-500/20", border: "border-blue-500/40", text: "text-blue-500" },
  rest: { bg: "bg-indigo-500/20", border: "border-indigo-500/40", text: "text-indigo-500" },
}

interface CalendarEventBlockProps {
  title: string
  category: SuggestionCategory
  startHour: number
  duration: number // in minutes
  onClick?: () => void
}

export function CalendarEventBlock({
  title,
  category,
  startHour,
  duration,
  onClick,
}: CalendarEventBlockProps) {
  const Icon = categoryIcons[category]
  const colors = categoryColors[category]

  // Calculate position and height based on time
  // Each hour is 48px (12px * 4)
  const top = (startHour - 8) * 48 // Start from 8 AM
  const height = Math.max((duration / 60) * 48, 24) // Minimum 24px height

  return (
    <button
      onClick={onClick}
      className={cn(
        "absolute left-0.5 right-0.5 rounded-md border px-1.5 py-1",
        "transition-all hover:scale-[1.02] hover:shadow-md",
        "cursor-pointer text-left overflow-hidden",
        colors.bg,
        colors.border
      )}
      style={{
        top: `${top}px`,
        height: `${height}px`,
      }}
    >
      <div className="flex items-start gap-1">
        <Icon className={cn("h-3 w-3 flex-shrink-0 mt-0.5", colors.text)} />
        <span className="text-[10px] font-medium leading-tight line-clamp-2">
          {extractTitle(title)}
        </span>
      </div>
    </button>
  )
}

function extractTitle(content: string, maxLength = 30): string {
  const firstSentence = content.split(/[.!?]/)[0]?.trim()
  if (!firstSentence) return content.slice(0, maxLength)
  if (firstSentence.length <= maxLength) return firstSentence
  return firstSentence.slice(0, maxLength) + "..."
}
