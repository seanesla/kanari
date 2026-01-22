import type { SuggestionCategory } from "@/lib/types"

export function isScheduleRequest(text: string): boolean {
  return /\bschedule\b/i.test(text)
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

  return "Scheduled activity"
}
