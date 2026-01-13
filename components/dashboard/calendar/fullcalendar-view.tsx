"use client"

import { useMemo, useCallback, useRef, useState } from "react"
// FullCalendar requires its base CSS for proper layout (grid/positioning).
// See docs/error-patterns/fullcalendar-missing-base-css.md
import "./fullcalendar-base.css"
import "./fullcalendar-theme.css"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import timeGridPlugin from "@fullcalendar/timegrid"
import interactionPlugin, { type DateClickArg } from "@fullcalendar/interaction"
import type { EventClickArg, EventDropArg, EventInput } from "@fullcalendar/core"
import { Temporal } from "temporal-polyfill"
import { cn } from "@/lib/utils"
import { useSceneMode } from "@/lib/scene-context"
import { useTimeZone } from "@/lib/timezone-context"
import { generateDarkVariant, generateLightVariant } from "@/lib/color-utils"
import { CheckInTooltip } from "./check-in-tooltip"
import type { Suggestion, CheckInSession, RecoveryBlock, SuggestionCategory } from "@/lib/types"

function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace("#", "").trim()
  const a = Math.max(0, Math.min(1, alpha))

  const parseChannel = (start: number) => Number.parseInt(cleaned.slice(start, start + 2), 16)

  // #rgb
  if (cleaned.length === 3) {
    const r = Number.parseInt(cleaned[0]! + cleaned[0]!, 16)
    const g = Number.parseInt(cleaned[1]! + cleaned[1]!, 16)
    const b = Number.parseInt(cleaned[2]! + cleaned[2]!, 16)
    if ([r, g, b].some((v) => Number.isNaN(v))) return `rgba(0, 0, 0, ${a})`
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }

  // #rrggbb
  if (cleaned.length === 6) {
    const r = parseChannel(0)
    const g = parseChannel(2)
    const b = parseChannel(4)
    if ([r, g, b].some((v) => Number.isNaN(v))) return `rgba(0, 0, 0, ${a})`
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }

  return `rgba(0, 0, 0, ${a})`
}

// Category colors - fixed colors for each category
const CATEGORY_COLORS: Record<SuggestionCategory, { bg: string; border: string; text: string }> = {
  // Use translucent, tinted backgrounds so events match the app's glassy UI.
  exercise: { bg: "rgba(34, 197, 94, 0.10)", border: "#22c55e", text: "#dcfce7" },
  mindfulness: { bg: "rgba(168, 85, 247, 0.10)", border: "#a855f7", text: "#f3e8ff" },
  social: { bg: "rgba(59, 130, 246, 0.10)", border: "#3b82f6", text: "#dbeafe" },
  rest: { bg: "rgba(99, 102, 241, 0.10)", border: "#6366f1", text: "#e0e7ff" },
  break: { bg: "rgba(245, 158, 11, 0.10)", border: "#f59e0b", text: "#fef3c7" }, // Will be overridden by accent
}

// Check-in marker colors
const CHECKIN_COLORS = { bg: "rgba(245, 158, 11, 0.10)", border: "#f59e0b", text: "#fef3c7" }

// Completed event colors (gray)
const COMPLETED_COLORS = { bg: "rgba(107, 114, 128, 0.10)", border: "#6b7280", text: "#9ca3af" }

const EMPTY_SUGGESTIONS: Suggestion[] = []
const EMPTY_SESSIONS: CheckInSession[] = []

const CALENDAR_PLUGINS = [dayGridPlugin, timeGridPlugin, interactionPlugin]
const HEADER_TOOLBAR = {
  left: "prev,next today",
  center: "title",
  right: "timeGridWeek,dayGridMonth",
} as const

const EVENT_TIME_FORMAT = { hour: "numeric", minute: "2-digit", meridiem: "short" } as const
const SLOT_LABEL_FORMAT = { hour: "numeric", minute: "2-digit", hour12: true } as const

interface FullCalendarViewProps {
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

interface ExtendedEventProps {
  suggestion?: Suggestion
  session?: CheckInSession
  isCompleted?: boolean
  isCheckIn?: boolean
}

type MetricBand = "low" | "medium" | "high"

function scoreToBand(score: number): MetricBand {
  if (!Number.isFinite(score)) return "medium"
  if (score < 34) return "low"
  if (score < 67) return "medium"
  return "high"
}

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

// Helper to map Suggestion to FullCalendar event format
function suggestionToEvent(
  suggestion: Suggestion,
  timeZone: string,
  accentColor: string,
  isCompleted = false
): EventInput | null {
  if (!suggestion.scheduledFor) return null

  const instant = Temporal.Instant.from(suggestion.scheduledFor)
  const startDateTime = instant.toZonedDateTimeISO(timeZone)
  const endDateTime = startDateTime.add({ minutes: suggestion.duration })

  // Extract first sentence as title, max 30 chars
  const firstSentence = suggestion.content.split(/[.!?]/)[0]?.trim() || suggestion.content
  const title = firstSentence.length > 30
    ? firstSentence.slice(0, 27) + "..."
    : firstSentence

  // Get category colors, with break using accent color
  let colors = CATEGORY_COLORS[suggestion.category]
  if (suggestion.category === "break") {
    colors = {
      bg: hexToRgba(accentColor, 0.10),
      border: accentColor,
      text: generateLightVariant(accentColor),
    }
  }

  if (isCompleted) {
    colors = COMPLETED_COLORS
  }

  return {
    id: isCompleted ? `completed-${suggestion.id}` : suggestion.id,
    title: isCompleted ? `✓ ${title}` : title,
    start: startDateTime.toString({ timeZoneName: "never" }),
    end: endDateTime.toString({ timeZoneName: "never" }),
    backgroundColor: colors.bg,
    borderColor: colors.border,
    textColor: colors.text,
    extendedProps: {
      suggestion,
      isCompleted,
    } as ExtendedEventProps,
    editable: !isCompleted, // Can only drag non-completed events
    classNames: isCompleted ? ["opacity-60"] : [],
  }
}

// Helper to map check-ins to FullCalendar event format
function checkInToEvent(session: CheckInSession, timeZone: string): EventInput | null {
  if (!session.startedAt) return null

  const instant = Temporal.Instant.from(session.startedAt)
  const startDateTime = instant.toZonedDateTimeISO(timeZone)
  const endDateTime = startDateTime.add({ minutes: 20 })

  const stressScore = session.acousticMetrics?.stressScore
  const fatigueScore = session.acousticMetrics?.fatigueScore
  const metrics = stressScore !== undefined
    ? `S: ${scoreToBand(stressScore)} • F: ${fatigueScore !== undefined ? scoreToBand(fatigueScore) : "?"}`
    : null
  const title = metrics ? `✓ Check-in • ${metrics}` : "✓ Check-in"

  return {
    id: `checkin-${session.id}`,
    title,
    start: startDateTime.toString({ timeZoneName: "never" }),
    end: endDateTime.toString({ timeZoneName: "never" }),
    backgroundColor: CHECKIN_COLORS.bg,
    borderColor: CHECKIN_COLORS.border,
    textColor: CHECKIN_COLORS.text,
    extendedProps: {
      session,
      isCheckIn: true,
    } as ExtendedEventProps,
    editable: false, // Check-ins cannot be dragged
    classNames: ["checkin-event"],
  }
}

export function FullCalendarView({
  scheduledSuggestions,
  completedSuggestions = EMPTY_SUGGESTIONS,
  checkInSessions = EMPTY_SESSIONS,
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
      .map((session) => checkInToEvent(session, timeZone))
      .filter((event): event is EventInput => event !== null)

    return [...scheduledEvents, ...completedEvents, ...checkInEvents]
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
      const date = info.date
      const dateISO = Temporal.PlainDate.from({
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
      }).toString()
      onTimeSlotClick(dateISO, date.getHours(), date.getMinutes())
    }
  }, [onTimeSlotClick])

  // Calculate drop target time from mouse position
  const calculateDropTime = useCallback((e: React.DragEvent): { dateISO: string; hour: number; minute: number } | null => {
    if (!containerRef.current) return null

    // Get the time grid element from container
    const timeGrid = containerRef.current.querySelector(".fc-timegrid-body")
    if (!timeGrid) return null

    const rect = timeGrid.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Calculate which day column
    const dayHeaders = containerRef.current.querySelectorAll(".fc-col-header-cell")
    if (dayHeaders.length === 0) return null

    const colWidth = rect.width / dayHeaders.length
    const dayIndex = Math.floor(x / colWidth)
    if (dayIndex < 0 || dayIndex >= dayHeaders.length) return null

    // Get the date from the header
    const dayHeader = dayHeaders[dayIndex]
    const dateAttr = dayHeader.getAttribute("data-date")
    if (!dateAttr) return null

    // Calculate the hour based on y position
    const gridHeight = rect.height
    const hourHeight = gridHeight / 24
    const relativeHour = y / hourHeight
    const hour = Math.floor(relativeHour)
    const minute = Math.round((relativeHour % 1) * 60 / 15) * 15

    if (hour < 0 || hour >= 24) return null

    return { dateISO: dateAttr, hour, minute: minute % 60 }
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
    "--fc-border-color": "oklch(0.30 0.01 var(--hue, 60))",
    "--fc-button-bg-color": accentColor,
    "--fc-button-border-color": accentColor,
    "--fc-button-hover-bg-color": generateDarkVariant(accentColor),
    "--fc-button-hover-border-color": generateDarkVariant(accentColor),
    "--fc-button-active-bg-color": generateDarkVariant(accentColor),
    "--fc-button-active-border-color": generateDarkVariant(accentColor),
    "--fc-today-bg-color": `${accentColor}15`,
    "--fc-page-bg-color": "transparent",
    "--fc-neutral-bg-color": "oklch(0.14 0.01 var(--hue, 60))",
    "--fc-list-event-hover-bg-color": `${accentColor}20`,
  } as React.CSSProperties), [accentColor])

  return (
    <div
      ref={containerRef}
      className={cn(
        className,
        "relative transition-all duration-200 fullcalendar-wrapper",
        isDragOver && "ring-2 ring-accent ring-offset-2 ring-offset-background rounded-lg",
        pendingDragActive && !isDragOver && "ring-1 ring-accent/30 ring-offset-1 ring-offset-background rounded-lg"
      )}
      style={themeStyles}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <FullCalendar
        ref={calendarRef}
        plugins={CALENDAR_PLUGINS}
        initialView="timeGridWeek"
        headerToolbar={HEADER_TOOLBAR}
        events={events}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        dateClick={handleDateClick}
        editable={true}
        droppable={true}
        selectable={false}
        dayMaxEvents={true}
        weekends={true}
        nowIndicator={true}
        slotMinTime="00:00:00"
        slotMaxTime="24:00:00"
        allDaySlot={false}
        height="100%"
        timeZone={timeZone}
        eventTimeFormat={EVENT_TIME_FORMAT}
        slotLabelFormat={SLOT_LABEL_FORMAT}
      />

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
