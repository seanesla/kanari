"use client"

import { useMemo, useCallback, useRef, useState } from "react"
// FullCalendar requires its base CSS for proper layout (grid/positioning).
// See docs/error-patterns/fullcalendar-missing-base-css.md
import "./fullcalendar-base.css"
import "./fullcalendar-theme.css"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction"
import type { EventClickArg, EventDropArg, EventInput } from "@fullcalendar/core"
import { Temporal } from "temporal-polyfill"
import { cn } from "@/lib/utils"
import { useSceneMode } from "@/lib/scene-context"
import { useTimeZone } from "@/lib/timezone-context"
import { generateDarkVariant } from "@/lib/color-utils"
import { CheckInTooltip } from "./check-in-tooltip"
import type { Suggestion, CheckInSession, RecoveryBlock } from "@/lib/types"
import {
  dedupeEventsById,
  suggestionToEvent,
  checkInToEvent,
  type ExtendedEventProps,
} from "./fullcalendar-event-mappers"

const EMPTY_SUGGESTIONS: Suggestion[] = []
const EMPTY_SESSIONS: CheckInSession[] = []

const CALENDAR_PLUGINS = [dayGridPlugin, interactionPlugin]
const HEADER_TOOLBAR = {
  left: "prev,next today",
  center: "title",
  right: "dayGridMonth",
} as const

const EVENT_TIME_FORMAT = { hour: "numeric", minute: "2-digit", meridiem: "short" } as const

const DEFAULT_DAY_ACTION_TIME = { hour: 9, minute: 0 } as const

interface FullCalendarViewProps {
  scheduledSuggestions: Suggestion[]
  completedSuggestions?: Suggestion[]
  checkInSessions?: CheckInSession[]
  recoveryBlocks?: RecoveryBlock[]
  variant?: "full" | "mini"
  onEventClick?: (suggestion: Suggestion) => void
  onCheckInClick?: (session: CheckInSession) => void
  onTimeSlotClick?: (dateISO: string, hour: number, minute: number) => void
  onEventUpdate?: (suggestion: Suggestion, newScheduledFor: string) => void
  onExternalDrop?: (suggestionId: string, dateISO: string, hour: number, minute: number) => void
  pendingDragActive?: boolean
  className?: string
}

// ExtendedEventProps is shared with the event mappers module.

function toInstantFromFullCalendarStart(
  start: Date | null,
  startStr: string | undefined,
  timeZone: string
): string | null {
  // Pattern doc: docs/error-patterns/fullcalendar-drag-drop-timezone-shift.md
  const raw = (startStr ?? "").trim()

  if (raw) {
    const hasOffsetOrZ = /[zZ]|[+-]\d\d:\d\d$/.test(raw)
    if (hasOffsetOrZ) {
      try {
        return Temporal.Instant.from(raw).toString()
      } catch {
        // fall through
      }
    }

    // FullCalendar may provide a "floating" datetime string without an offset.
    // Interpret it in the app-selected time zone to avoid environment-dependent shifts.
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const zdt = Temporal.PlainDate.from(raw).toZonedDateTime({
          timeZone,
          plainTime: Temporal.PlainTime.from("00:00"),
        })
        return zdt.toInstant().toString()
      }

      const plain = Temporal.PlainDateTime.from(raw)
      return plain.toZonedDateTime(timeZone).toInstant().toString()
    } catch {
      // fall through
    }
  }

  if (!start) return null
  try {
    return Temporal.Instant.from(start.toISOString()).toString()
  } catch {
    return null
  }
}

function toSlotFromFullCalendarDateClick(input: { date: Date; dateStr: string; timeZone: string }): { dateISO: string; hour: number; minute: number } {
  // Same timezone-shift pattern as drag/drop: prefer `dateStr` over the `Date` instance.
  // See docs/error-patterns/fullcalendar-drag-drop-timezone-shift.md
  const raw = (input.dateStr ?? "").trim()

  if (raw) {
    const hasOffsetOrZ = /[zZ]|[+-]\d\d:\d\d$/.test(raw)

    try {
      if (hasOffsetOrZ) {
        const zdt = Temporal.Instant.from(raw).toZonedDateTimeISO(input.timeZone)
        return { dateISO: zdt.toPlainDate().toString(), hour: zdt.hour, minute: zdt.minute }
      }

      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return { dateISO: raw, hour: DEFAULT_DAY_ACTION_TIME.hour, minute: DEFAULT_DAY_ACTION_TIME.minute }
      }

      const zdt = Temporal.PlainDateTime.from(raw).toZonedDateTime(input.timeZone)
      return { dateISO: zdt.toPlainDate().toString(), hour: zdt.hour, minute: zdt.minute }
    } catch {
      // fall through
    }
  }

  const dateISO = Temporal.PlainDate.from({
    year: input.date.getFullYear(),
    month: input.date.getMonth() + 1,
    day: input.date.getDate(),
  }).toString()

  return { dateISO, hour: input.date.getHours(), minute: input.date.getMinutes() }
}

// (Event mapping helpers live in fullcalendar-event-mappers.ts)

export function FullCalendarView({
  scheduledSuggestions,
  completedSuggestions = EMPTY_SUGGESTIONS,
  checkInSessions = EMPTY_SESSIONS,
  variant = "full",
  onEventClick,
  onCheckInClick,
  onTimeSlotClick,
  onEventUpdate,
  onExternalDrop,
  pendingDragActive = false,
  className = "",
}: FullCalendarViewProps) {
  const { accentColor } = useSceneMode()
  const { timeZone } = useTimeZone()
  const containerRef = useRef<HTMLDivElement>(null)
  const calendarRef = useRef<FullCalendar>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const isMini = variant === "mini"
  const isInteractive = !isMini

  // Tooltip state for check-in markers
  const [selectedCheckIn, setSelectedCheckIn] = useState<CheckInSession | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)
  const [tooltipOpen, setTooltipOpen] = useState(false)

  // Convert suggestions to FullCalendar events
  const events = useMemo(() => {
    const scheduledEvents = scheduledSuggestions
      .map((s) => suggestionToEvent(s, timeZone, accentColor))
      .filter((event): event is EventInput => event !== null)

    const completedEvents = completedSuggestions
      .map((s) => suggestionToEvent(s, timeZone, accentColor, true))
      .filter((event): event is EventInput => event !== null)

    const checkInEvents = checkInSessions
      .map((session) => checkInToEvent(session, timeZone, accentColor))
      .filter((event): event is EventInput => event !== null)

    return dedupeEventsById([...scheduledEvents, ...completedEvents, ...checkInEvents])
  }, [scheduledSuggestions, completedSuggestions, checkInSessions, timeZone, accentColor])

  // Handle event click
  const handleEventClick = useCallback((info: EventClickArg) => {
    const props = info.event.extendedProps as ExtendedEventProps

    // Handle check-in events - open tooltip
    if (props.isCheckIn && props.session) {
      const rect = info.el.getBoundingClientRect()
      setSelectedCheckIn(props.session)
      setTooltipPosition({
        x: rect.left,
        y: rect.top + rect.height / 2,
      })
      setTooltipOpen(true)
      onCheckInClick?.(props.session)
      return
    }

    // Handle suggestion events
    if (props.suggestion && onEventClick) {
      onEventClick(props.suggestion)
    }
  }, [onEventClick, onCheckInClick])

  // Handle event drop (drag-and-drop rescheduling)
  const handleEventDrop = useCallback((info: EventDropArg) => {
    const props = info.event.extendedProps as ExtendedEventProps

    if (props.suggestion && onEventUpdate && info.event.start) {
      const newScheduledFor = toInstantFromFullCalendarStart(
        info.event.start,
        info.event.startStr,
        timeZone
      )
      if (!newScheduledFor) return
      onEventUpdate(props.suggestion, newScheduledFor)
    }
  }, [onEventUpdate, timeZone])

  // Handle date click
  const handleDateClick = useCallback((info: DateClickArg) => {
    if (onTimeSlotClick) {
      const { dateISO, hour, minute } = toSlotFromFullCalendarDateClick({
        date: info.date,
        dateStr: info.dateStr,
        timeZone,
      })
      onTimeSlotClick(dateISO, hour, minute)
    }
  }, [onTimeSlotClick, timeZone])

  // Calculate drop target time from mouse position
  const calculateDropTime = useCallback((e: React.DragEvent): { dateISO: string; hour: number; minute: number } | null => {
    if (!containerRef.current) return null

    const hovered = document.elementFromPoint(e.clientX, e.clientY)
    const dayCell = hovered?.closest?.(".fc-daygrid-day[data-date]") as HTMLElement | null
    const dayDate = dayCell?.getAttribute("data-date")
    if (!dayDate) return null

    return { dateISO: dayDate, hour: DEFAULT_DAY_ACTION_TIME.hour, minute: DEFAULT_DAY_ACTION_TIME.minute }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const suggestionId = e.dataTransfer.getData("application/suggestion-id")
    if (!suggestionId || !onExternalDrop) return

    const dropTime = calculateDropTime(e)
    if (!dropTime) return

    onExternalDrop(suggestionId, dropTime.dateISO, dropTime.hour, dropTime.minute)
  }, [onExternalDrop, calculateDropTime])

  // Generate CSS variables for theming
  const themeStyles = useMemo(() => ({
    "--fc-border-color": "var(--border)",
    "--fc-button-bg-color": accentColor,
    "--fc-button-border-color": accentColor,
    "--fc-button-hover-bg-color": generateDarkVariant(accentColor),
    "--fc-button-hover-border-color": generateDarkVariant(accentColor),
    "--fc-button-active-bg-color": generateDarkVariant(accentColor),
    "--fc-button-active-border-color": generateDarkVariant(accentColor),
    "--fc-today-bg-color": `${accentColor}15`,
    "--fc-page-bg-color": "transparent",
    "--fc-neutral-bg-color": "var(--card)",
    "--fc-neutral-text-color": "var(--foreground)",
    "--fc-list-event-hover-bg-color": `${accentColor}20`,
  } as React.CSSProperties), [accentColor])

  return (
    <div
      ref={containerRef}
      className={cn(
        className,
        "relative transition-all duration-200 fullcalendar-wrapper",
        isInteractive && isDragOver && "ring-2 ring-accent ring-offset-2 ring-offset-background rounded-lg",
        isInteractive && pendingDragActive && !isDragOver && "ring-1 ring-accent/30 ring-offset-1 ring-offset-background rounded-lg"
      )}
      style={themeStyles}
      data-variant={variant}
      onDragOver={isInteractive ? handleDragOver : undefined}
      onDragLeave={isInteractive ? handleDragLeave : undefined}
      onDrop={isInteractive ? handleDrop : undefined}
    >
      <FullCalendar
        ref={calendarRef}
        plugins={CALENDAR_PLUGINS}
        initialView="dayGridMonth"
        headerToolbar={isMini ? false : HEADER_TOOLBAR}
        events={events}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        dateClick={handleDateClick}
        editable={isInteractive}
        droppable={isInteractive}
        selectable={false}
        dayMaxEvents={true}
        weekends={true}
        nowIndicator={!isMini}
        height="100%"
        timeZone={timeZone}
        eventTimeFormat={EVENT_TIME_FORMAT}
      />

      {isInteractive && isDragOver && (
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
