import { to24Hour } from "./time"

const DURATION_MAX_HOURS = 12
const DURATION_MAX_MINUTES = DURATION_MAX_HOURS * 60

// Accept spoken-number durations from transcripts (e.g. "five hours").
// Pattern doc: docs/error-patterns/schedule-activity-title-duration-override-miss.md
const DURATION_WORD_TO_NUMBER: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
}

const DURATION_TOKEN_PATTERN = "\\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve"

function parseDurationToken(token: string | undefined): number | null {
  if (!token) return null
  const trimmed = token.trim().toLowerCase()
  const numeric = Number(trimmed)
  if (Number.isFinite(numeric)) return numeric
  return DURATION_WORD_TO_NUMBER[trimmed] ?? null
}

function parseMeridiemToken(token: string | undefined): "am" | "pm" | null {
  if (!token) return null
  const normalized = token.trim().toLowerCase()
  if (normalized.startsWith("a")) return "am"
  if (normalized.startsWith("p")) return "pm"
  return null
}

function parseRangeHourToken(token: string | undefined): number | null {
  if (!token) return null
  const normalized = token.trim()
  if (!/^\d{1,2}$/.test(normalized)) return null

  const parsed = Number(normalized)
  if (parsed >= 1 && parsed <= 12) return parsed

  // Speech-to-text can collapse "to 8pm" into "28pm".
  // Pattern doc: docs/error-patterns/schedule-transcript-short-pause-context-loss.md
  if (/^2[1-9]$/.test(normalized)) {
    return Number(normalized[1])
  }

  return null
}

function parseRangeMinuteToken(token: string | undefined): number | null {
  if (!token) return 0
  const normalized = token.trim()
  if (!/^\d{1,2}$/.test(normalized)) return null
  const parsed = Number(normalized)
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 59) return null
  return parsed
}

function extractDurationMinutesFromTimeRange(input: string): number | null {
  // Supports variants like:
  // - "from 3pm to 8pm"
  // - "3:00 PM - 8:00 PM"
  // - "from 3 to 8pm"
  // - "from 3pm to 28pm" (collapsed STT)
  const rangePattern =
    /(?:\bfrom\s+)?(\d{1,2})(?::([0-5]?\d))?\s*(a\.?m|p\.?m)?\s*(?:to|through|until|-)\s*(\d{1,2})(?::([0-5]?\d))?\s*(a\.?m|p\.?m)\b/g

  for (const match of input.matchAll(rangePattern)) {
    const startHour12 = parseRangeHourToken(match[1])
    const endHour12 = parseRangeHourToken(match[4])
    const endMeridiem = parseMeridiemToken(match[6])
    const startMeridiem = parseMeridiemToken(match[3]) ?? endMeridiem
    const startMinute = parseRangeMinuteToken(match[2])
    const endMinute = parseRangeMinuteToken(match[5])

    if (
      startHour12 === null
      || endHour12 === null
      || startMeridiem === null
      || endMeridiem === null
      || startMinute === null
      || endMinute === null
    ) {
      continue
    }

    const startTotalMinutes = to24Hour(startHour12, startMeridiem) * 60 + startMinute
    let endTotalMinutes = to24Hour(endHour12, endMeridiem) * 60 + endMinute

    // Handle ranges that pass midnight.
    if (endTotalMinutes <= startTotalMinutes) {
      endTotalMinutes += 24 * 60
    }

    const durationMinutes = endTotalMinutes - startTotalMinutes
    if (durationMinutes > 0 && durationMinutes <= DURATION_MAX_MINUTES) {
      return durationMinutes
    }
  }

  return null
}

export function extractDurationMinutesFromText(text: string): number | null {
  const input = text.toLowerCase()

  // "for 30 minutes", "30 min", "30mins", "for five minutes"
  const minutes = input.match(new RegExp(`\\b(${DURATION_TOKEN_PATTERN})\\s*-?\\s*(?:min|mins|minute|minutes|m)\\b`))
  if (minutes) {
    const value = parseDurationToken(minutes[1])
    if (value !== null && value > 0 && value <= DURATION_MAX_MINUTES) return value
  }

  // "for 1 hour", "2 hours", "1hr", "1 h", "for five hours"
  const hours = input.match(new RegExp(`\\b(${DURATION_TOKEN_PATTERN})\\s*-?\\s*(?:hr|hrs|hour|hours|h)\\b`))
  if (hours) {
    const value = parseDurationToken(hours[1])
    if (value !== null && value > 0 && value <= DURATION_MAX_HOURS) return value * 60
  }

  // "from 3pm to 8pm", "3:00 PM - 8:00 PM"
  // Pattern doc: docs/error-patterns/schedule-transcript-short-pause-context-loss.md
  const rangeDuration = extractDurationMinutesFromTimeRange(input)
  if (rangeDuration !== null) {
    return rangeDuration
  }

  return null
}

export function inferScheduleDurationMinutes(text: string): number {
  const explicit = extractDurationMinutesFromText(text)
  if (explicit) return explicit

  const input = text.toLowerCase()
  if (input.includes("check-in") || input.includes("check in")) return 20
  if (input.includes("break")) return 15
  if (input.includes("exercise") || input.includes("walk") || input.includes("run") || input.includes("gym")) return 10
  if (input.includes("meditate") || input.includes("meditation") || input.includes("mindfulness") || input.includes("breath")) {
    return 10
  }
  if (input.includes("appointment") || input.includes("meeting")) return 30

  return 30
}

export function clampDurationMinutes(duration: number): number {
  if (!Number.isFinite(duration)) return 20
  return Math.max(5, Math.min(DURATION_MAX_MINUTES, Math.round(duration)))
}
