export function extractDurationMinutesFromText(text: string): number | null {
  const input = text.toLowerCase()

  // "for 30 minutes", "30 min", "30mins"
  const minutes = input.match(/\b(\d{1,3})\s*(?:min|mins|minute|minutes|m)\b/)
  if (minutes) {
    const value = Number(minutes[1])
    if (Number.isFinite(value) && value > 0 && value <= 240) return value
  }

  // "for 1 hour", "2 hours", "1hr", "1 h"
  const hours = input.match(/\b(\d{1,2})\s*(?:hr|hrs|hour|hours|h)\b/)
  if (hours) {
    const value = Number(hours[1])
    if (Number.isFinite(value) && value > 0 && value <= 12) return value * 60
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
  return Math.max(5, Math.min(240, Math.round(duration)))
}
