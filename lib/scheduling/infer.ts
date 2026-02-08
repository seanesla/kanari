import type { SuggestionCategory } from "@/lib/types"

export function isScheduleRequest(text: string): boolean {
  return /\bschedule\b/i.test(text)
}

function capitalizeFirst(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

function extractScheduledActivityPhrase(text: string): string | null {
  const scheduleMatch = /\bschedule\b/i.exec(text)
  if (!scheduleMatch) return null

  let phrase = text.slice(scheduleMatch.index + scheduleMatch[0].length).trim()
  if (!phrase) return null

  // Pattern doc: docs/error-patterns/schedule-activity-generic-title-duration-drift.md
  // Keep user-specified activity wording when possible instead of collapsing to
  // generic labels like "Scheduled activity".

  // Remove leading helper words after "schedule".
  phrase = phrase
    .replace(/^(?:me|us|my|this|that)\b[\s,:-]*/i, "")
    .replace(/^(?:an?|the)\b[\s,:-]*/i, "")
    .replace(/^(?:activity|task|event)\s+(?:to|for)\s+/i, "")
    .replace(/^to\s+/i, "")

  // Strip date/time/duration tail clauses from free-form requests.
  phrase = phrase
    .replace(/\bfor\s+\d{1,3}\s*(?:min|mins|minute|minutes|m|hr|hrs|hour|hours|h)\b.*$/i, "")
    .replace(/\bon\s+\d{4}-\d{2}-\d{2}\b.*$/i, "")
    .replace(/\b(?:today|tomorrow|tonight)\b.*$/i, "")
    .replace(/\bat\s+\d{1,2}(?:(?::|\.)\d{1,2})?\s*(?:a\.?m|p\.?m)?\b.*$/i, "")
    .replace(/\bplease\b[.!?]*$/i, "")

  phrase = phrase.replace(/[\s.,!?;:]+$/g, "").replace(/\s+/g, " ").trim()
  if (!phrase) return null

  return capitalizeFirst(phrase)
}

export function inferScheduleCategory(text: string): SuggestionCategory {
  const input = text.toLowerCase()

  if (input.includes("break")) return "break"
  if (input.includes("walk") || input.includes("run") || input.includes("exercise") || input.includes("gym")) {
    return "exercise"
  }
  if (
    input.includes("meditate") ||
    input.includes("meditation") ||
    input.includes("mindfulness") ||
    input.includes("breath")
  ) {
    return "mindfulness"
  }
  if (
    input.includes("meeting") ||
    input.includes("meet ") ||
    input.includes("coffee") ||
    input.includes("call") ||
    input.includes("dinner") ||
    input.includes("lunch")
  ) {
    return "social"
  }

  return "rest"
}

export function inferScheduleTitle(text: string): string {
  const raw = text.trim()
  const input = raw.toLowerCase()

  // Prefer quoted titles if present.
  const quoted = raw.match(/["“]([^"”]{1,60})["”]/)?.[1]?.trim()
  if (quoted) return quoted

  if (input.includes("check-in") || input.includes("check in")) return "Check-in"
  if (input.includes("appointment")) return "Appointment"
  if (input.includes("meeting")) return "Meeting"
  if (input.includes("break")) return "Break"
  if (input.includes("walk")) return "Walk"

  const inferred = extractScheduledActivityPhrase(raw)
  if (inferred) return inferred

  return "Scheduled activity"
}
