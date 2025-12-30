'use client'

import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { Temporal } from 'temporal-polyfill'
import { useNextCalendarApp, ScheduleXCalendar } from '@schedule-x/react'
import { createViewWeek, type CalendarEvent } from '@schedule-x/calendar'
import { createEventsServicePlugin } from '@schedule-x/events-service'
import { createDragAndDropPlugin } from '@schedule-x/drag-and-drop'
import { cn } from '@/lib/utils'
import type { Suggestion } from '@/lib/types'
import '@schedule-x/theme-default/dist/index.css'
import './schedule-x-theme.css'

// Extended event type with custom suggestion data
// Source: Context7 - schedule-x/schedule-x docs - CalendarEvent allows [key: string]: any
interface SuggestionEvent extends CalendarEvent {
  _suggestion: Suggestion
  _isCompleted?: boolean
}

interface ScheduleXWeekCalendarProps {
  scheduledSuggestions: Suggestion[]
  completedSuggestions?: Suggestion[]
  onEventClick?: (suggestion: Suggestion) => void
  onTimeSlotClick?: (date: Date, hour: number) => void
  onEventUpdate?: (suggestion: Suggestion, newScheduledFor: string) => void
  onExternalDrop?: (suggestionId: string, date: Date, hour: number, minute: number) => void
  pendingDragActive?: boolean
  className?: string
}

// Helper to map Suggestion to Schedule-X event format
function suggestionToEvent(suggestion: Suggestion): SuggestionEvent | null {
  if (!suggestion.scheduledFor) return null

  // Schedule-X requires ZonedDateTime for timed events (not PlainDateTime)
  // Source: Context7 - schedule-x/schedule-x docs - "Timed Event Example"
  // https://github.com/schedule-x/schedule-x/blob/main/website/app/docs/calendar/events/page.mdx
  const timeZone = Temporal.Now.timeZoneId()
  const instant = Temporal.Instant.from(suggestion.scheduledFor)
  const startDateTime = instant.toZonedDateTimeISO(timeZone)
  const endDateTime = startDateTime.add({ minutes: suggestion.duration })

  // Extract first sentence as title, max 30 chars
  const firstSentence = suggestion.content.split(/[.!?]/)[0]?.trim() || suggestion.content
  const title = firstSentence.length > 30
    ? firstSentence.slice(0, 27) + '...'
    : firstSentence

  return {
    id: suggestion.id,
    title,
    start: startDateTime,
    end: endDateTime,
    calendarId: suggestion.category,
    _suggestion: suggestion,
  }
}

// Helper to map completed suggestion to faded event
function completedToEvent(suggestion: Suggestion): SuggestionEvent | null {
  if (!suggestion.scheduledFor) return null

  const timeZone = Temporal.Now.timeZoneId()
  const instant = Temporal.Instant.from(suggestion.scheduledFor)
  const startDateTime = instant.toZonedDateTimeISO(timeZone)
  const endDateTime = startDateTime.add({ minutes: suggestion.duration })

  const firstSentence = suggestion.content.split(/[.!?]/)[0]?.trim() || suggestion.content
  const title = firstSentence.length > 30
    ? firstSentence.slice(0, 27) + '...'
    : firstSentence

  return {
    id: `completed-${suggestion.id}`,
    title: `✓ ${title}`,
    start: startDateTime,
    end: endDateTime,
    calendarId: 'completed',
    _suggestion: suggestion,
    _isCompleted: true,
  }
}

export function ScheduleXWeekCalendar({
  scheduledSuggestions,
  completedSuggestions = [],
  onEventClick,
  onTimeSlotClick,
  onEventUpdate,
  onExternalDrop,
  pendingDragActive = false,
  className = '',
}: ScheduleXWeekCalendarProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const eventsService = useMemo(() => createEventsServicePlugin(), [])

  const calendar = useNextCalendarApp({
    views: [createViewWeek()],
    defaultView: 'week',
    isDark: true,
    dayBoundaries: {
      start: '08:00',
      end: '21:00',
    },
    weekOptions: {
      gridHeight: 600,
      nDays: 7,
      eventWidth: 95,
    },
    calendars: {
      break: {
        colorName: 'break',
        lightColors: {
          main: '#d4a574',
          container: '#f5e6d3',
          onContainer: '#5c4a2f',
        },
        darkColors: {
          main: '#d4a574',
          container: '#5c4a2f',
          onContainer: '#f5e6d3',
        },
      },
      exercise: {
        colorName: 'exercise',
        lightColors: {
          main: '#22c55e',
          container: '#dcfce7',
          onContainer: '#14532d',
        },
        darkColors: {
          main: '#22c55e',
          container: '#14532d',
          onContainer: '#dcfce7',
        },
      },
      mindfulness: {
        colorName: 'mindfulness',
        lightColors: {
          main: '#a855f7',
          container: '#f3e8ff',
          onContainer: '#581c87',
        },
        darkColors: {
          main: '#a855f7',
          container: '#581c87',
          onContainer: '#f3e8ff',
        },
      },
      social: {
        colorName: 'social',
        lightColors: {
          main: '#3b82f6',
          container: '#dbeafe',
          onContainer: '#1e3a8a',
        },
        darkColors: {
          main: '#3b82f6',
          container: '#1e3a8a',
          onContainer: '#dbeafe',
        },
      },
      rest: {
        colorName: 'rest',
        lightColors: {
          main: '#6366f1',
          container: '#e0e7ff',
          onContainer: '#3730a3',
        },
        darkColors: {
          main: '#6366f1',
          container: '#3730a3',
          onContainer: '#e0e7ff',
        },
      },
      completed: {
        colorName: 'completed',
        lightColors: {
          main: '#9ca3af',
          container: '#f3f4f6',
          onContainer: '#6b7280',
        },
        darkColors: {
          main: '#6b7280',
          container: '#374151',
          onContainer: '#9ca3af',
        },
      },
    },
    events: [],
    plugins: [eventsService, createDragAndDropPlugin()],
    callbacks: {
      onEventClick(calendarEvent) {
        // CalendarEvent has [key: string]: any, so we can access _suggestion directly
        const event = calendarEvent as SuggestionEvent
        if (event._suggestion && onEventClick) {
          onEventClick(event._suggestion)
        }
      },
      onClickDateTime(dateTime) {
        if (onTimeSlotClick) {
          // Convert Temporal.ZonedDateTime to JavaScript Date
          const date = new Date(dateTime.toString().split('[')[0])
          const hour = dateTime.hour
          onTimeSlotClick(date, hour)
        }
      },
      onEventUpdate(updatedEvent) {
        // CalendarEvent has [key: string]: any, so we can access _suggestion directly
        const event = updatedEvent as SuggestionEvent
        if (event._suggestion && onEventUpdate) {
          // Convert Temporal.ZonedDateTime to ISO string (UTC)
          const zdt = updatedEvent.start as Temporal.ZonedDateTime
          const newScheduledFor = zdt.toInstant().toString()
          onEventUpdate(event._suggestion, newScheduledFor)
        }
      },
    },
  })

  // Sync events when scheduledSuggestions change
  // Source: Context7 - schedule-x/schedule-x docs - "EventsService Plugin"
  // The plugin needs the calendar to be mounted before calling .set()
  useEffect(() => {
    // Wait for calendar to be ready before setting events
    if (!calendar) return

    const scheduledEvents = scheduledSuggestions
      .map(suggestionToEvent)
      .filter((event): event is SuggestionEvent => event !== null)

    const completedEvents = completedSuggestions
      .map(completedToEvent)
      .filter((event): event is SuggestionEvent => event !== null)

    const allEvents: SuggestionEvent[] = [...scheduledEvents, ...completedEvents]

    // Use try-catch as the plugin may not be fully initialized on first render
    try {
      eventsService.set(allEvents)
    } catch (error) {
      // Calendar not fully mounted yet, will retry on next render
      if (process.env.NODE_ENV === "development") {
        console.debug("[ScheduleXCalendar] Events service not ready:", error)
      }
    }
  }, [scheduledSuggestions, completedSuggestions, eventsService, calendar])

  // Calculate drop target time from mouse position
  const calculateDropTime = useCallback((e: React.DragEvent): { date: Date; hour: number; minute: number } | null => {
    if (!containerRef.current) return null

    const calendarGrid = containerRef.current.querySelector('.sx__week-grid')
    if (!calendarGrid) return null

    const rect = calendarGrid.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Calculate which day column (excluding time column on left)
    const timeColumnWidth = 60 // Approximate width of time column
    const gridWidth = rect.width - timeColumnWidth
    const dayWidth = gridWidth / 7
    const dayIndex = Math.floor((x - timeColumnWidth) / dayWidth)

    if (dayIndex < 0 || dayIndex > 6) return null

    // Calculate the hour based on y position
    // Grid covers 08:00-21:00 (13 hours)
    const gridHeight = rect.height
    const hourHeight = gridHeight / 13
    const relativeHour = y / hourHeight
    const hour = Math.floor(8 + relativeHour)
    const minute = Math.round((relativeHour % 1) * 60 / 15) * 15 // Snap to 15 min

    if (hour < 8 || hour >= 21) return null

    // Calculate the date for this day column
    const today = new Date()
    const startOfWeek = new Date(today)
    const dayOfWeek = today.getDay()
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // Start from Monday
    startOfWeek.setDate(today.getDate() + diff)
    startOfWeek.setHours(0, 0, 0, 0)

    const targetDate = new Date(startOfWeek)
    targetDate.setDate(startOfWeek.getDate() + dayIndex)
    targetDate.setHours(hour, minute % 60, 0, 0)

    return { date: targetDate, hour, minute: minute % 60 }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only trigger if leaving the container entirely
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const suggestionId = e.dataTransfer.getData('application/suggestion-id')
    if (!suggestionId || !onExternalDrop) return

    const dropTime = calculateDropTime(e)
    if (!dropTime) return

    onExternalDrop(suggestionId, dropTime.date, dropTime.hour, dropTime.minute)
  }, [onExternalDrop, calculateDropTime])

  return (
    <div
      ref={containerRef}
      className={cn(
        className,
        'relative transition-all duration-200',
        isDragOver && 'ring-2 ring-accent ring-offset-2 ring-offset-background rounded-lg',
        pendingDragActive && !isDragOver && 'ring-1 ring-accent/30 ring-offset-1 ring-offset-background rounded-lg'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <ScheduleXCalendar calendarApp={calendar} />
      {isDragOver && (
        <div className="absolute inset-0 bg-accent/5 rounded-lg pointer-events-none flex items-center justify-center">
          <div className="bg-background/90 px-4 py-2 rounded-lg text-sm font-medium text-accent">
            Drop to schedule
          </div>
        </div>
      )}
    </div>
  )
}
