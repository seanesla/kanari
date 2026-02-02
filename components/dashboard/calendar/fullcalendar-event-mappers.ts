import type { EventInput } from "@fullcalendar/core"
import { Temporal } from "temporal-polyfill"
import { logWarn } from "@/lib/logger"
import { generateLightVariant } from "@/lib/color-utils"
import { extractSuggestionTitle, type CheckInSession, type Suggestion, type SuggestionCategory } from "@/lib/types"

export interface ExtendedEventProps {
  suggestion?: Suggestion
  session?: CheckInSession
  isCompleted?: boolean
  isCheckIn?: boolean
}

const DEFAULT_SUGGESTION_DURATION_MINUTES = 15

// Category colors - fixed colors for each category
const CATEGORY_COLORS: Record<SuggestionCategory, { bg: string; border: string; text: string }> = {
  // Use translucent, tinted backgrounds so events match the app's glassy UI.
  exercise: { bg: "rgba(34, 197, 94, 0.10)", border: "#22c55e", text: "#dcfce7" },
  mindfulness: { bg: "rgba(168, 85, 247, 0.10)", border: "#a855f7", text: "#f3e8ff" },
  social: { bg: "rgba(59, 130, 246, 0.10)", border: "#3b82f6", text: "#dbeafe" },
  rest: { bg: "rgba(99, 102, 241, 0.10)", border: "#6366f1", text: "#e0e7ff" },
  break: { bg: "rgba(245, 158, 11, 0.10)", border: "#f59e0b", text: "#fef3c7" }, // Will be overridden by accent
}

// Completed event colors (gray)
const COMPLETED_COLORS = { bg: "rgba(107, 114, 128, 0.10)", border: "#6b7280", text: "#9ca3af" }

function categoryLabel(category: SuggestionCategory): string {
  switch (category) {
    case "break":
      return "Break"
    case "exercise":
      return "Exercise"
    case "mindfulness":
      return "Mindfulness"
    case "social":
      return "Social"
    case "rest":
      return "Rest"
  }
}

export function dedupeEventsById(events: EventInput[]): EventInput[] {
  const seen = new Set<string>()
  const unique: EventInput[] = []
  for (const event of events) {
    const id = typeof event.id === "string" ? event.id : event.id ? String(event.id) : null
    // If the upstream data contains duplicates (e.g. duplicated suggestions), FullCalendar will
    // render them as stacked events. De-dupe defensively.
    if (!id) {
      unique.push(event)
      continue
    }
    if (seen.has(id)) continue
    seen.add(id)
    unique.push(event)
  }
  return unique
}

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

function buildAccentEventColors(accentColor: string): { bg: string; border: string; text: string } {
  return {
    bg: hexToRgba(accentColor, 0.10),
    border: accentColor,
    text: generateLightVariant(accentColor),
  }
}

function safeDurationMinutes(value: unknown): number {
  if (typeof value !== "number") return DEFAULT_SUGGESTION_DURATION_MINUTES
  if (!Number.isFinite(value)) return DEFAULT_SUGGESTION_DURATION_MINUTES
  if (value <= 0) return DEFAULT_SUGGESTION_DURATION_MINUTES
  return value
}

function safeSuggestionContent(value: unknown, fallbackCategory: SuggestionCategory): string {
  if (typeof value === "string" && value.trim()) return value
  return categoryLabel(fallbackCategory)
}

function toZonedDateTimeFromInstant(instantISO: string, timeZone: string): Temporal.ZonedDateTime | null {
  try {
    const instant = Temporal.Instant.from(instantISO)
    return instant.toZonedDateTimeISO(timeZone)
  } catch (error) {
    logWarn("calendar", "Skipping calendar event due to invalid instant", { instantISO, timeZone, error })
    return null
  }
}

// Helper to map Suggestion to FullCalendar event format
export function suggestionToEvent(
  suggestion: Suggestion,
  timeZone: string,
  accentColor: string,
  isCompleted = false
): EventInput | null {
  const scheduledFor = (suggestion as unknown as { scheduledFor?: unknown }).scheduledFor
  if (typeof scheduledFor !== "string" || !scheduledFor.trim()) return null

  const startDateTime = toZonedDateTimeFromInstant(scheduledFor, timeZone)
  if (!startDateTime) return null

  const duration = safeDurationMinutes((suggestion as unknown as { duration?: unknown }).duration)
  const endDateTime = startDateTime.add({ minutes: duration })

  const content = safeSuggestionContent((suggestion as unknown as { content?: unknown }).content, suggestion.category)
  const title = extractSuggestionTitle(content, 30)

  // Get category colors, with break using accent color
  let colors = CATEGORY_COLORS[suggestion.category]
  if (suggestion.category === "break") {
    colors = buildAccentEventColors(accentColor)
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

type MetricBand = "low" | "medium" | "high"

function scoreToBand(score: number): MetricBand {
  if (!Number.isFinite(score)) return "medium"
  if (score < 34) return "low"
  if (score < 67) return "medium"
  return "high"
}

// Helper to map check-ins to FullCalendar event format
export function checkInToEvent(session: CheckInSession, timeZone: string, accentColor: string): EventInput | null {
  const startedAt = (session as unknown as { startedAt?: unknown }).startedAt
  if (typeof startedAt !== "string" || !startedAt.trim()) return null

  const startDateTime = toZonedDateTimeFromInstant(startedAt, timeZone)
  if (!startDateTime) return null

  const endDateTime = startDateTime.add({ minutes: 20 })

  const stressScore = session.acousticMetrics?.stressScore
  const fatigueScore = session.acousticMetrics?.fatigueScore
  const metrics = stressScore !== undefined
    ? `S: ${scoreToBand(stressScore)} • F: ${fatigueScore !== undefined ? scoreToBand(fatigueScore) : "?"}`
    : null
  const title = metrics ? `✓ Check-in • ${metrics}` : "✓ Check-in"

  const colors = buildAccentEventColors(accentColor)

  return {
    id: `checkin-${session.id}`,
    title,
    start: startDateTime.toString({ timeZoneName: "never" }),
    end: endDateTime.toString({ timeZoneName: "never" }),
    backgroundColor: colors.bg,
    borderColor: colors.border,
    textColor: colors.text,
    extendedProps: {
      session,
      isCheckIn: true,
    } as ExtendedEventProps,
    editable: false, // Check-ins cannot be dragged
    classNames: ["checkin-event"],
  }
}

