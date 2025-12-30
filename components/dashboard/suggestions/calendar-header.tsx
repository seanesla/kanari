"use client"

import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CalendarHeaderProps {
  weekStart: Date
  onPrevWeek: () => void
  onNextWeek: () => void
  onToday: () => void
}

export function CalendarHeader({ weekStart, onPrevWeek, onNextWeek, onToday }: CalendarHeaderProps) {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  }

  const isCurrentWeek = isThisWeek(weekStart)

  return (
    <div className="flex items-center justify-between pb-4 border-b border-border/50">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-accent" />
        <h3 className="font-medium text-sm">
          {formatDate(weekStart)} – {formatDate(weekEnd)}
        </h3>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onPrevWeek}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={onToday}
          disabled={isCurrentWeek}
        >
          Today
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onNextWeek}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function isThisWeek(weekStart: Date): boolean {
  const now = new Date()
  const currentWeekStart = getWeekStart(now)
  return weekStart.toDateString() === currentWeekStart.toDateString()
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Sunday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}
