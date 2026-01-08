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
import { useTimeZone } from '@/lib/timezone-context'
import { generateDarkVariant, generateLightVariant } from '@/lib/color-utils'
import { CheckInMarker } from './check-in-marker'
import { CheckInTooltip } from './check-in-tooltip'
import type { Suggestion, CheckInSession, RecoveryBlock } from '@/lib/types'
import '@schedule-x/theme-default/dist/index.css'
import './schedule-x-theme.css'

// Extended event type with custom suggestion data
// Source: Context7 - schedule-x/schedule-x docs - CalendarEvent allows [key: string]: any
interface SuggestionEvent extends CalendarEvent {
  _type: 'suggestion'
  _suggestion: Suggestion
  _isCompleted?: boolean
  _recoveryBlock?: RecoveryBlock
}

// Extended event type for check-in markers
interface CheckInEvent extends CalendarEvent {
  _type: 'checkin'
  _session: CheckInSession
}

// Union type for all custom events
type CustomCalendarEvent = SuggestionEvent | CheckInEvent

interface ScheduleXWeekCalendarProps {
  scheduledSuggestions: Suggestion[]
  completedSuggestions?: Suggestion[]
  checkInSessions?: CheckInSession[]
  recoveryBlocks?: RecoveryBlock[]
  onEventClick?: (suggestion: Suggestion) => void
  onCheckInClick?: (session: CheckInSession) => void
  onTimeSlotClick?: (dateISO: string, hour: number, minute: number) => void
  onEventUpdate?: (suggestion: Suggestion, newScheduledFor: string) => void
  onExternalDrop?: (suggestionId: string, dateISO: string, hour: number, minute: number) => void
  pendingDragActive?: boolean
  className?: string
}

interface ScheduleXWeekCalendarInnerProps extends ScheduleXWeekCalendarProps {
  accentColor: string
  timeZone: string
}

// Helper to map Suggestion to Schedule-X event format
function suggestionToEvent(
  suggestion: Suggestion,
  timeZone: string,
  recoveryBlock?: RecoveryBlock
): SuggestionEvent | null {
  if (!suggestion.scheduledFor) return null

  // Schedule-X requires ZonedDateTime for timed events (not PlainDateTime)
  // Source: Context7 - schedule-x/schedule-x docs - "Timed Event Example"
  // https://github.com/schedule-x/schedule-x/blob/main/website/app/docs/calendar/events/page.mdx
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
    ...(recoveryBlock ? { _recoveryBlock: recoveryBlock } : {}),
  }
}

// Helper to map completed suggestion to faded event
function completedToEvent(
  suggestion: Suggestion,
  timeZone: string,
  recoveryBlock?: RecoveryBlock
): SuggestionEvent | null {
  if (!suggestion.scheduledFor) return null

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
    ...(recoveryBlock ? { _recoveryBlock: recoveryBlock } : {}),
  }
}

// Helper to map check-ins to Schedule-X event format (as marker)
function checkInToEvent(session: CheckInSession, timeZone: string): CheckInEvent | null {
  if (!session.startedAt) return null

  // Source: Context7 - schedule-x/schedule-x docs - "Timed Event Example"
  const instant = Temporal.Instant.from(session.startedAt)
  const startDateTime = instant.toZonedDateTimeISO(timeZone)
  // 20-min duration gives enough height for a proper pill-shaped event (~33px)
  const endDateTime = startDateTime.add({ minutes: 20 })

  const stressScore = session.acousticMetrics?.stressScore
  const fatigueScore = session.acousticMetrics?.fatigueScore
  const title = stressScore !== undefined
    ? `S:${stressScore} F:${fatigueScore ?? '?'}`
    : 'Check-in'

  return {
    id: `checkin-${session.id}`,
    title,
    start: startDateTime,
    end: endDateTime,
    calendarId: 'checkin',
    _type: 'checkin',
    _session: session,
  }
}

// Wrapper component that keys on accentColor to force calendar recreation
export function ScheduleXWeekCalendar(props: ScheduleXWeekCalendarProps) {
  const { accentColor } = useSceneMode()
  const { timeZone } = useTimeZone()
  return (
    <ScheduleXWeekCalendarInner
      key={`${accentColor}-${timeZone}`}
      {...props}
      accentColor={accentColor}
      timeZone={timeZone}
    />
  )
}

// Inner component that creates the calendar with the given accent color
function ScheduleXWeekCalendarInner({
  scheduledSuggestions,
  completedSuggestions = [],
  checkInSessions = [],
  recoveryBlocks = [],
  onEventClick,
  onCheckInClick,
  onTimeSlotClick,
  onEventUpdate,
  onExternalDrop,
  pendingDragActive = false,
  className = '',
  accentColor,
  timeZone,
}: ScheduleXWeekCalendarInnerProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const eventsService = useMemo(() => createEventsServicePlugin(), [])

  // Tooltip state for check-in markers
  const [selectedCheckIn, setSelectedCheckIn] = useState<CheckInSession | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)
  const [tooltipOpen, setTooltipOpen] = useState(false)

  // Note: Scroll dismissal is handled by Floating UI's useDismiss with ancestorScroll: true

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
      checkin: {
        colorName: 'checkin',
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

        // Handle check-in events - open tooltip
        if (event._type === 'checkin') {
          // Fix 10: Stop propagation to prevent Schedule-X internal handling
          e.stopPropagation()
          // Find the Schedule-X event wrapper element, not just the clicked child
          // e.target could be an icon, dot, or internal element with wrong position
          const target = e.target as HTMLElement | null
          const eventWrapper = target?.closest('.sx__time-grid-event') as HTMLElement | null
          const element = eventWrapper ?? target
          if (!element) return
          const rect = element.getBoundingClientRect()
          setSelectedCheckIn(event._session)
          setTooltipPosition({
            x: rect.left,
            y: rect.top + rect.height / 2
          })
          setTooltipOpen(true)
          onCheckInClick?.(event._session)
          return
        }

        // Handle suggestion events
        if (event._type === 'suggestion' && onEventClick) {
          onEventClick(event._suggestion)
        }
      },
      onClickDateTime(dateTime) {
        if (onTimeSlotClick) {
          const dateISO = dateTime.toPlainDate().toString()
          onTimeSlotClick(dateISO, dateTime.hour, dateTime.minute)
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

  // Sync events when scheduledSuggestions or check-ins change
  // Source: Context7 - schedule-x/schedule-x docs - "EventsService Plugin"
  // The plugin needs the calendar to be mounted before calling .set()
  useEffect(() => {
    // Wait for calendar to be ready before setting events
    if (!calendar) return

    const recoveryBySuggestionId = new Map<string, RecoveryBlock>()
    for (const block of recoveryBlocks) {
      // If multiple blocks exist for a suggestion, keep the latest scheduled one.
      const existing = recoveryBySuggestionId.get(block.suggestionId)
      if (!existing) {
        recoveryBySuggestionId.set(block.suggestionId, block)
        continue
      }
      if (new Date(block.scheduledAt).getTime() > new Date(existing.scheduledAt).getTime()) {
        recoveryBySuggestionId.set(block.suggestionId, block)
      }
    }

    const scheduledEvents = scheduledSuggestions
      .map((s) => suggestionToEvent(s, timeZone, recoveryBySuggestionId.get(s.id)))
      .filter((event): event is SuggestionEvent => event !== null)

    const completedEvents = completedSuggestions
      .map((s) => completedToEvent(s, timeZone, recoveryBySuggestionId.get(s.id)))
      .filter((event): event is SuggestionEvent => event !== null)

    const checkInEvents = checkInSessions
      .map((session) => checkInToEvent(session, timeZone))
      .filter((event): event is CheckInEvent => event !== null)

    const allEvents: CustomCalendarEvent[] = [
      ...scheduledEvents,
      ...completedEvents,
      ...checkInEvents,
    ]

    // Use try-catch as the plugin may not be fully initialized on first render
    try {
      eventsService.set(allEvents)
    } catch (error) {
      // Calendar not fully mounted yet, will retry on next render
      logDebug("ScheduleXCalendar", "Events service not ready:", error)
    }
  }, [scheduledSuggestions, completedSuggestions, checkInSessions, recoveryBlocks, eventsService, calendar, timeZone])

  // Calculate drop target time from mouse position
  const calculateDropTime = useCallback((e: React.DragEvent): { dateISO: string; hour: number; minute: number } | null => {
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

    const now = Temporal.Now.zonedDateTimeISO(timeZone)
    const startOfWeek = now.toPlainDate().subtract({ days: now.dayOfWeek - 1 }) // Monday
    const targetDate = startOfWeek.add({ days: dayIndex })

    return { dateISO: targetDate.toString(), hour, minute: minute % 60 }
  }, [timeZone])

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

    onExternalDrop(suggestionId, dropTime.dateISO, dropTime.hour, dropTime.minute)
  }, [onExternalDrop, calculateDropTime])

  // Fix 4: Handler to open tooltip (used for both click and keyboard)
  const openCheckInTooltip = useCallback((session: CheckInSession, position: { x: number; y: number }) => {
    setSelectedCheckIn(session)
    setTooltipPosition(position)
    setTooltipOpen(true)
    onCheckInClick?.(session)
  }, [onCheckInClick])

  // Custom component renderer for time grid events
  // Source: Context7 - schedule-x/schedule-x docs - "Customize Event Modal Content in React"
  // Note: When using customComponents.timeGridEvent, we must render ALL event types ourselves
  const customComponents = useMemo(() => ({
    timeGridEvent: ({ calendarEvent }: { calendarEvent: CalendarEvent }) => {
      const event = calendarEvent as CustomCalendarEvent

      // Render check-in as a compact pill event with keyboard support
      if (event._type === 'checkin') {
        return (
          <div
            onKeyDown={(e) => {
              // Fix 4: Keyboard accessibility - Enter/Space opens tooltip
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                // Find the Schedule-X event wrapper for correct positioning
                const eventWrapper = e.currentTarget.closest('.sx__time-grid-event') as HTMLElement | null
                const element = eventWrapper ?? e.currentTarget
                if (!element) return
                const rect = element.getBoundingClientRect()
                openCheckInTooltip(event._session, {
                  x: rect.left,
                  y: rect.top + rect.height / 2,
                })
              }
            }}
            className="h-full w-full"
          >
            <CheckInMarker session={event._session} />
          </div>
        )
      }

      // Render suggestion events with default-like styling
      // We need to render this ourselves since customComponents replaces the default
      const isCompleted = (event as SuggestionEvent)._isCompleted
      const isSynced = !!(event as SuggestionEvent)._recoveryBlock
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
          <div className="flex items-center gap-1">
            <div className="truncate">{calendarEvent.title}</div>
            {isSynced && (
              <span
                className="text-[10px] font-medium text-muted-foreground/80"
                title="Synced to Google Calendar"
              >
                GC
              </span>
            )}
          </div>
        </div>
      )
    },
  }), [openCheckInTooltip])

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

      {/* Check-in Tooltip */}
      <CheckInTooltip
        session={selectedCheckIn}
        open={tooltipOpen}
        onOpenChange={setTooltipOpen}
        anchorPosition={tooltipPosition}
      />
    </div>
  )
}
