// Google Calendar API v3 wrapper
// Provides methods for creating, updating, and querying calendar events

import type { CalendarEvent, Suggestion } from "@/lib/types"
import type { OAuthTokens } from "./oauth"
import { Temporal } from "temporal-polyfill"

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3"

export interface FreeBusyTimeRange {
  start: string // ISO 8601
  end: string // ISO 8601
}

export interface FreeBusyResponse {
  calendars: {
    [calendarId: string]: {
      busy: FreeBusyTimeRange[]
      errors?: Array<{
        domain: string
        reason: string
      }>
    }
  }
}

export interface CreateEventParams {
  summary: string
  description?: string
  start: string // ISO 8601
  end: string // ISO 8601
  timeZone?: string // IANA timezone id (e.g., "America/Los_Angeles")
  colorId?: string
  calendarId?: string // Defaults to "primary"
}

// ============================================
// Calendar Event Operations
// ============================================

/**
 * Create a calendar event
 */
export async function createCalendarEvent(
  params: CreateEventParams,
  tokens: OAuthTokens
): Promise<CalendarEvent> {
  const calendarId = params.calendarId || "primary"

  const eventBody = {
    summary: params.summary,
    description: params.description,
    start: buildGoogleDateTime(params.start, params.timeZone),
    end: buildGoogleDateTime(params.end, params.timeZone),
    colorId: params.colorId || "9", // Blue color for recovery events
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 10 },
        { method: "popup", minutes: 30 },
      ],
    },
  }

  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventBody),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to create event: ${error.error?.message || "Unknown error"}`)
  }

  const data = await response.json()

  return mapGoogleEventToCalendarEvent(data)
}

/**
 * Update an existing calendar event
 */
export async function updateCalendarEvent(
  eventId: string,
  params: Partial<CreateEventParams>,
  tokens: OAuthTokens
): Promise<CalendarEvent> {
  const calendarId = params.calendarId || "primary"

  const updates: Record<string, unknown> = {}
  if (params.summary) updates.summary = params.summary
  if (params.description !== undefined) updates.description = params.description
  if (params.start) {
    updates.start = buildGoogleDateTime(params.start, params.timeZone)
  }
  if (params.end) {
    updates.end = buildGoogleDateTime(params.end, params.timeZone)
  }

  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to update event: ${error.error?.message || "Unknown error"}`)
  }

  const data = await response.json()
  return mapGoogleEventToCalendarEvent(data)
}

/**
 * Delete a calendar event
 */
export async function deleteCalendarEvent(
  eventId: string,
  tokens: OAuthTokens,
  calendarId = "primary"
): Promise<void> {
  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    }
  )

  if (!response.ok && response.status !== 410) {
    // 410 Gone is OK (event already deleted)
    const error = await response.json()
    throw new Error(`Failed to delete event: ${error.error?.message || "Unknown error"}`)
  }
}

/**
 * Get a single calendar event
 */
export async function getCalendarEvent(
  eventId: string,
  tokens: OAuthTokens,
  calendarId = "primary"
): Promise<CalendarEvent> {
  const response = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to get event: ${error.error?.message || "Unknown error"}`)
  }

  const data = await response.json()
  return mapGoogleEventToCalendarEvent(data)
}

// ============================================
// Free/Busy Query
// ============================================

/**
 * Get free/busy information for a time range
 * Used to find available time slots for recovery blocks
 */
export async function getFreeBusy(
  timeMin: string,
  timeMax: string,
  tokens: OAuthTokens,
  calendarId = "primary"
): Promise<FreeBusyTimeRange[]> {
  const requestBody = {
    timeMin,
    timeMax,
    items: [{ id: calendarId }],
  }

  const response = await fetch(`${CALENDAR_API_BASE}/freeBusy`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to get free/busy: ${error.error?.message || "Unknown error"}`)
  }

  const data: FreeBusyResponse = await response.json()

  return data.calendars[calendarId]?.busy || []
}

// ============================================
// Utility Functions
// ============================================

function formatGoogleDateTime(isoString: string, timeZone: string): string {
  try {
    const instant = Temporal.Instant.from(isoString)
    return instant.toZonedDateTimeISO(timeZone).toString({ timeZoneName: "never" })
  } catch {
    return isoString
  }
}

function buildGoogleDateTime(isoString: string, timeZone?: string) {
  if (timeZone) {
    return {
      dateTime: formatGoogleDateTime(isoString, timeZone),
      timeZone,
    }
  }

  return { dateTime: isoString }
}

/**
 * Map Google Calendar API event to our CalendarEvent type
 */
function mapGoogleEventToCalendarEvent(googleEvent: {
  id: string
  summary: string
  description?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
}): CalendarEvent {
  return {
    id: googleEvent.id,
    title: googleEvent.summary,
    description: googleEvent.description,
    start: googleEvent.start.dateTime || googleEvent.start.date || "",
    end: googleEvent.end.dateTime || googleEvent.end.date || "",
    type: "recovery", // All events created by kanari are recovery events
  }
}

/**
 * Convert a Suggestion to CreateEventParams
 */
export function suggestionToEventParams(suggestion: Suggestion): CreateEventParams {
  if (!suggestion.scheduledFor) {
    throw new Error("Suggestion must have scheduledFor timestamp")
  }

  const startDate = new Date(suggestion.scheduledFor)
  const endDate = new Date(startDate.getTime() + suggestion.duration * 60 * 1000)

  const categoryEmoji: Record<typeof suggestion.category, string> = {
    break: "☕",
    exercise: "🏃",
    mindfulness: "🧘",
    social: "👥",
    rest: "😴",
  }

  const emoji = categoryEmoji[suggestion.category] || "🌟"

  return {
    summary: `${emoji} Recovery: ${suggestion.category}`,
    description: `${suggestion.content}\n\n💡 Rationale: ${suggestion.rationale}\n\n🤖 Generated by kanari based on your voice biomarker analysis.`,
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    colorId: "9", // Blue for recovery
  }
}

/**
 * Check if a time range conflicts with busy periods
 */
export function hasConflict(
  start: Date,
  end: Date,
  busyPeriods: FreeBusyTimeRange[]
): boolean {
  const startTime = start.getTime()
  const endTime = end.getTime()

  return busyPeriods.some((busy) => {
    const busyStart = new Date(busy.start).getTime()
    const busyEnd = new Date(busy.end).getTime()

    // Check for any overlap
    return startTime < busyEnd && endTime > busyStart
  })
}

/**
 * Find the next available time slot of specified duration
 */
export function findNextAvailableSlot(
  duration: number, // minutes
  busyPeriods: FreeBusyTimeRange[],
  preferredStartTime?: Date,
  searchWindowHours = 24
): Date | null {
  const now = preferredStartTime || new Date()
  const searchEnd = new Date(now.getTime() + searchWindowHours * 60 * 60 * 1000)

  // Round to next 15-minute interval
  const roundedStart = new Date(now)
  roundedStart.setMinutes(Math.ceil(roundedStart.getMinutes() / 15) * 15)
  roundedStart.setSeconds(0)
  roundedStart.setMilliseconds(0)

  const durationMs = duration * 60 * 1000
  const interval = 15 * 60 * 1000 // Check every 15 minutes

  for (let current = roundedStart; current < searchEnd; current = new Date(current.getTime() + interval)) {
    const slotEnd = new Date(current.getTime() + durationMs)

    // Skip slots outside working hours (8 AM - 8 PM)
    const hour = current.getHours()
    if (hour < 8 || hour >= 20) continue

    if (!hasConflict(current, slotEnd, busyPeriods)) {
      return current
    }
  }

  return null
}
