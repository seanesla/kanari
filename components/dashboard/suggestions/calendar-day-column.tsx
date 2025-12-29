"use client"

import { cn } from "@/lib/utils"
import { CalendarEventBlock } from "./calendar-event-block"
import type { Suggestion } from "@/lib/types"

interface CalendarDayColumnProps {
  date: Date
  events: Suggestion[]
  onEventClick?: (suggestion: Suggestion) => void
  onTimeSlotClick?: (date: Date, hour: number) => void
}

// Time slots from 8 AM to 8 PM (12 hours)
const TIME_SLOTS = Array.from({ length: 13 }, (_, i) => i + 8)

export function CalendarDayColumn({
  date,
  events,
  onEventClick,
  onTimeSlotClick,
}: CalendarDayColumnProps) {
  const isToday = isSameDay(date, new Date())
  const dayName = date.toLocaleDateString(undefined, { weekday: "short" })
  const dayNumber = date.getDate()

  return (
    <div className="flex flex-col min-w-[60px] flex-1">
      {/* Day header */}
      <div className={cn(
        "text-center py-2 border-b border-border/50",
        isToday && "bg-accent/10"
      )}>
        <div className="text-[10px] uppercase text-muted-foreground">
          {dayName}
        </div>
        <div className={cn(
          "text-sm font-medium",
          isToday && "text-accent"
        )}>
          {dayNumber}
        </div>
      </div>

      {/* Time slots */}
      <div className="relative flex-1">
        {TIME_SLOTS.map((hour) => (
          <button
            key={hour}
            onClick={() => onTimeSlotClick?.(date, hour)}
            className={cn(
              "w-full h-12 border-b border-border/30",
              "hover:bg-accent/5 transition-colors",
              "focus:outline-none focus:bg-accent/10"
            )}
            aria-label={`Schedule at ${formatHour(hour)} on ${date.toDateString()}`}
          />
        ))}

        {/* Event blocks */}
        {events.map((event) => {
          const startHour = event.scheduledFor
            ? new Date(event.scheduledFor).getHours()
            : 9 // Default to 9 AM

          return (
            <CalendarEventBlock
              key={event.id}
              title={event.content}
              category={event.category}
              startHour={startHour}
              duration={event.duration}
              onClick={() => onEventClick?.(event)}
            />
          )
        })}

        {/* Current time indicator */}
        {isToday && <CurrentTimeIndicator />}
      </div>
    </div>
  )
}

function CurrentTimeIndicator() {
  const now = new Date()
  const hours = now.getHours()
  const minutes = now.getMinutes()

  // Only show if within visible range (8 AM - 8 PM)
  if (hours < 8 || hours > 20) return null

  const top = (hours - 8) * 48 + (minutes / 60) * 48

  return (
    <div
      className="absolute left-0 right-0 z-10 pointer-events-none"
      style={{ top: `${top}px` }}
    >
      <div className="flex items-center">
        <div className="h-2 w-2 rounded-full bg-destructive" />
        <div className="flex-1 h-px bg-destructive" />
      </div>
    </div>
  )
}

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString()
}

function formatHour(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM"
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${displayHour} ${suffix}`
}
