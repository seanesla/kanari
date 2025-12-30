'use client'

import { useEffect, useMemo } from 'react'
import { useNextCalendarApp, ScheduleXCalendar } from '@schedule-x/react'
import { createViewWeek } from '@schedule-x/calendar'
import { createEventsServicePlugin } from '@schedule-x/events-service'
import { createDragAndDropPlugin } from '@schedule-x/drag-and-drop'
import { Temporal } from 'temporal-polyfill'
import type { Suggestion } from '@/lib/types'
import '@schedule-x/theme-default/dist/index.css'
import './schedule-x-theme.css'

interface ScheduleXWeekCalendarProps {
  scheduledSuggestions: Suggestion[]
  onEventClick?: (suggestion: Suggestion) => void
  onTimeSlotClick?: (date: Date, hour: number) => void
  onEventUpdate?: (suggestion: Suggestion, newScheduledFor: string) => void
  className?: string
}

// Helper to map Suggestion to Schedule-X event format
function suggestionToEvent(suggestion: Suggestion) {
  if (!suggestion.scheduledFor) return null

  const startDateTime = Temporal.PlainDateTime.from(suggestion.scheduledFor.replace('Z', ''))
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
    _suggestion: suggestion, // Store full suggestion for callbacks
  }
}

export function ScheduleXWeekCalendar({
  scheduledSuggestions,
  onEventClick,
  onTimeSlotClick,
  onEventUpdate,
  className = '',
}: ScheduleXWeekCalendarProps) {
  const eventsService = useMemo(() => createEventsServicePlugin(), [])

  const calendar = useNextCalendarApp({
    views: [createViewWeek()],
    defaultView: 'week',
    isDark: true,
    dayBoundaries: {
      start: '08:00',
      end: '20:00',
    },
    weekOptions: {
      gridHeight: 1800,
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
    },
    events: [],
    plugins: [eventsService, createDragAndDropPlugin()],
    callbacks: {
      onEventClick(calendarEvent) {
        const suggestion = (calendarEvent as any)._suggestion as Suggestion
        if (suggestion && onEventClick) {
          onEventClick(suggestion)
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
        const suggestion = (updatedEvent as any)._suggestion as Suggestion
        if (suggestion && onEventUpdate) {
          // Convert Temporal.PlainDateTime to ISO string
          const newScheduledFor = updatedEvent.start.toString() + 'Z'
          onEventUpdate(suggestion, newScheduledFor)
        }
      },
    },
  })

  // Sync events when scheduledSuggestions change
  useEffect(() => {
    const events = scheduledSuggestions
      .map(suggestionToEvent)
      .filter(Boolean) as any[]

    eventsService.set(events)
  }, [scheduledSuggestions, eventsService])

  return (
    <div className={className}>
      <ScheduleXCalendar calendarApp={calendar} />
    </div>
  )
}
