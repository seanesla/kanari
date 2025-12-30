'use client'

import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { Temporal } from 'temporal-polyfill'
import { useNextCalendarApp, ScheduleXCalendar } from '@schedule-x/react'
import { createViewWeek, type CalendarEvent } from '@schedule-x/calendar'
import { createEventsServicePlugin } from '@schedule-x/events-service'
import { createDragAndDropPlugin } from '@schedule-x/drag-and-drop'
import { cn } from '@/lib/utils'
import { logDebug } from '@/lib/logger'
import { useSceneMode } from '@/lib/scene-context'
import { generateDarkVariant, generateLightVariant } from '@/lib/color-utils'
import { RecordingMarker } from './recording-marker'
import { RecordingTooltip } from './recording-tooltip'
import type { Suggestion, Recording } from '@/lib/types'
import '@schedule-x/theme-default/dist/index.css'
import './schedule-x-theme.css'

// Event type enum to distinguish between different event sources
type EventType = 'suggestion' | 'recording'

// Extended event type with custom suggestion data
// Source: Context7 - schedule-x/schedule-x docs - CalendarEvent allows [key: string]: any
interface SuggestionEvent extends CalendarEvent {
  _type: 'suggestion'
  _suggestion: Suggestion
  _isCompleted?: boolean
}

// Extended event type for recording markers
interface RecordingEvent extends CalendarEvent {
  _type: 'recording'
  _recording: Recording
}

// Union type for all custom events
type CustomCalendarEvent = SuggestionEvent | RecordingEvent

interface ScheduleXWeekCalendarProps {
  scheduledSuggestions: Suggestion[]
  completedSuggestions?: Suggestion[]
  recordings?: Recording[]
  onEventClick?: (suggestion: Suggestion) => void
  onRecordingClick?: (recording: Recording) => void
  onTimeSlotClick?: (date: Date, hour: number) => void
  onEventUpdate?: (suggestion: Suggestion, newScheduledFor: string) => void
  onExternalDrop?: (suggestionId: string, date: Date, hour: number, minute: number) => void
  pendingDragActive?: boolean
  className?: string
}

interface ScheduleXWeekCalendarInnerProps extends ScheduleXWeekCalendarProps {
  accentColor: string
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
    _type: 'suggestion',
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
    _type: 'suggestion',
    _suggestion: suggestion,
    _isCompleted: true,
  }
}

// Helper to map Recording to Schedule-X event format (as marker)
function recordingToEvent(recording: Recording): RecordingEvent | null {
  if (!recording.createdAt) return null

  // Source: Context7 - schedule-x/schedule-x docs - "Timed Event Example"
  const timeZone = Temporal.Now.timeZoneId()
  const instant = Temporal.Instant.from(recording.createdAt)
  const startDateTime = instant.toZonedDateTimeISO(timeZone)
  // 20-min duration gives enough height for a proper pill-shaped event (~33px)
  const endDateTime = startDateTime.add({ minutes: 20 })

  const stressScore = recording.metrics?.stressScore
  const fatigueScore = recording.metrics?.fatigueScore
  const title = stressScore !== undefined
    ? `S:${stressScore} F:${fatigueScore ?? '?'}`
    : 'Recording'

  return {
    id: `recording-${recording.id}`,
    title,
    start: startDateTime,
    end: endDateTime,
    calendarId: 'recording',
    _type: 'recording',
    _recording: recording,
  }
}

// Wrapper component that keys on accentColor to force calendar recreation
export function ScheduleXWeekCalendar(props: ScheduleXWeekCalendarProps) {
  const { accentColor } = useSceneMode()
  return <ScheduleXWeekCalendarInner key={accentColor} {...props} accentColor={accentColor} />
}

// Inner component that creates the calendar with the given accent color
function ScheduleXWeekCalendarInner({
  scheduledSuggestions,
  completedSuggestions = [],
  recordings = [],
  onEventClick,
  onRecordingClick,
  onTimeSlotClick,
  onEventUpdate,
  onExternalDrop,
  pendingDragActive = false,
  className = '',
  accentColor,
}: ScheduleXWeekCalendarInnerProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const eventsService = useMemo(() => createEventsServicePlugin(), [])

  // Tooltip state for recording markers
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)
  const [tooltipOpen, setTooltipOpen] = useState(false)

  // Generate break category colors from accent
  const breakColors = useMemo(() => ({
    main: accentColor,
    container: generateDarkVariant(accentColor),
    onContainer: generateLightVariant(accentColor),
  }), [accentColor])

  const calendar = useNextCalendarApp({
    views: [createViewWeek()],
    defaultView: 'week',
    isDark: true,
    // Source: Context7 - /schedule-x/schedule-x docs - "dayBoundaries configuration"
    dayBoundaries: {
      start: '00:00',
      end: '24:00',
    },
    weekOptions: {
      gridHeight: 2400,
      nDays: 7,
      eventWidth: 75,
    },
    calendars: {
      break: {
        colorName: 'break',
        lightColors: {
          main: breakColors.main,
          container: breakColors.onContainer,
          onContainer: breakColors.container,
        },
        darkColors: {
          main: breakColors.main,
          container: breakColors.container,
          onContainer: breakColors.onContainer,
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
      recording: {
        colorName: 'recording',
        lightColors: {
          main: '#f59e0b',
          container: '#fef3c7',
          onContainer: '#92400e',
        },
        darkColors: {
          main: '#f59e0b',
          container: '#78350f',
          onContainer: '#fef3c7',
        },
      },
    },
    events: [],
    plugins: [eventsService, createDragAndDropPlugin()],
    callbacks: {
      onEventClick(calendarEvent, e) {
        const event = calendarEvent as CustomCalendarEvent

        // Handle recording events - open tooltip
        if (event._type === 'recording') {
          const mouseEvent = e as MouseEvent
          setSelectedRecording(event._recording)
          setTooltipPosition({ x: mouseEvent.clientX, y: mouseEvent.clientY })
          setTooltipOpen(true)
          onRecordingClick?.(event._recording)
          return
        }

        // Handle suggestion events
        if (event._type === 'suggestion' && onEventClick) {
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

  // Sync events when scheduledSuggestions or recordings change
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

    const recordingEvents = recordings
      .map(recordingToEvent)
      .filter((event): event is RecordingEvent => event !== null)

    const allEvents: CustomCalendarEvent[] = [
      ...scheduledEvents,
      ...completedEvents,
      ...recordingEvents,
    ]

    // Use try-catch as the plugin may not be fully initialized on first render
    try {
      eventsService.set(allEvents)
    } catch (error) {
      // Calendar not fully mounted yet, will retry on next render
      logDebug("ScheduleXCalendar", "Events service not ready:", error)
    }
  }, [scheduledSuggestions, completedSuggestions, recordings, eventsService, calendar])

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
    // Grid covers 00:00-24:00 (24 hours)
    const gridHeight = rect.height
    const hourHeight = gridHeight / 24
    const relativeHour = y / hourHeight
    const hour = Math.floor(relativeHour)
    const minute = Math.round((relativeHour % 1) * 60 / 15) * 15 // Snap to 15 min

    if (hour < 0 || hour >= 24) return null

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

  // Custom component renderer for time grid events
  // Source: Context7 - schedule-x/schedule-x docs - "Customize Event Modal Content in React"
  // Note: When using customComponents.timeGridEvent, we must render ALL event types ourselves
  const customComponents = useMemo(() => ({
    timeGridEvent: ({ calendarEvent }: { calendarEvent: CalendarEvent }) => {
      const event = calendarEvent as CustomCalendarEvent

      // Render recording as a compact pill event
      if (event._type === 'recording') {
        return <RecordingMarker recording={event._recording} />
      }

      // Render suggestion events with default-like styling
      // We need to render this ourselves since customComponents replaces the default
      const isCompleted = (event as SuggestionEvent)._isCompleted
      return (
        <div
          className={cn(
            "h-full w-full rounded px-2 py-1 overflow-hidden cursor-pointer",
            "text-xs font-medium leading-tight",
            isCompleted && "opacity-60"
          )}
          style={{
            // Use the calendar category colors from Schedule-X
            // The container element already has the background color set by Schedule-X
          }}
        >
          <div className="truncate">{calendarEvent.title}</div>
        </div>
      )
    },
  }), [])

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
      <ScheduleXCalendar calendarApp={calendar} customComponents={customComponents} />
      {isDragOver && (
        <div className="absolute inset-0 bg-accent/5 rounded-lg pointer-events-none flex items-center justify-center">
          <div className="bg-background/90 px-4 py-2 rounded-lg text-sm font-medium text-accent">
            Drop to schedule
          </div>
        </div>
      )}

      {/* Recording Tooltip */}
      <RecordingTooltip
        recording={selectedRecording}
        open={tooltipOpen}
        onOpenChange={setTooltipOpen}
        anchorPosition={tooltipPosition}
      />
    </div>
  )
}
