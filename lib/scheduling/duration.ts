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
