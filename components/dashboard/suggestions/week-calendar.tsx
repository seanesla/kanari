"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CalendarHeader } from "./calendar-header"
import { CalendarDayColumn } from "./calendar-day-column"
import type { Suggestion } from "@/lib/types"

interface WeekCalendarProps {
  scheduledSuggestions: Suggestion[]
  onEventClick?: (suggestion: Suggestion) => void
  onTimeSlotClick?: (date: Date, hour: number) => void
  className?: string
}

// Time labels for the left column
const TIME_LABELS = Array.from({ length: 13 }, (_, i) => i + 8)

export function WeekCalendar({
  scheduledSuggestions,
  onEventClick,
  onTimeSlotClick,
  className,
}: WeekCalendarProps) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))

  // Generate 7 days of the week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart)
      date.setDate(date.getDate() + i)
      return date
    })
  }, [weekStart])

  // Group suggestions by day
  const eventsByDay = useMemo(() => {
    const grouped: Record<string, Suggestion[]> = {}

    weekDays.forEach((day) => {
      grouped[day.toDateString()] = []
    })

    scheduledSuggestions.forEach((suggestion) => {
      if (!suggestion.scheduledFor) return
      const date = new Date(suggestion.scheduledFor)
      const key = date.toDateString()
      if (grouped[key]) {
        grouped[key].push(suggestion)
      }
    })

    return grouped
  }, [scheduledSuggestions, weekDays])

  const handlePrevWeek = () => {
    const newStart = new Date(weekStart)
    newStart.setDate(newStart.getDate() - 7)
    setWeekStart(newStart)
  }

  const handleNextWeek = () => {
    const newStart = new Date(weekStart)
    newStart.setDate(newStart.getDate() + 7)
    setWeekStart(newStart)
  }

  const handleToday = () => {
    setWeekStart(getWeekStart(new Date()))
  }

  return (
    <div className={cn(
      "flex flex-col h-full rounded-xl border border-border/50 bg-card/20 backdrop-blur-sm",
      className
    )}>
      {/* Header */}
      <div className="p-4">
        <CalendarHeader
          weekStart={weekStart}
          onPrevWeek={handlePrevWeek}
          onNextWeek={handleNextWeek}
          onToday={handleToday}
        />
      </div>

      {/* Calendar grid */}
      <ScrollArea className="flex-1">
        <div className="flex min-h-[600px]">
          {/* Time labels column */}
          <div className="flex-shrink-0 w-12 pt-[52px]">
            {TIME_LABELS.map((hour) => (
              <div
                key={hour}
                className="h-12 pr-2 text-right text-[10px] text-muted-foreground -mt-2"
              >
                {formatHour(hour)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div className="flex flex-1 divide-x divide-border/30">
            {weekDays.map((date) => (
              <CalendarDayColumn
                key={date.toISOString()}
                date={date}
                events={eventsByDay[date.toDateString()] || []}
                onEventClick={onEventClick}
                onTimeSlotClick={onTimeSlotClick}
              />
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Start week on Monday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatHour(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM"
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${displayHour}${suffix}`
}
