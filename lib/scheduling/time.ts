export interface ParsedTime {
  hour: number
  minute: number
}

export function parseTimeHHMM(time: string): ParsedTime | null {
  const [hourStr, minuteStr] = time.split(":")
  const hour = Number(hourStr)
  const minute = Number(minuteStr)

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null
  if (hour < 0 || hour > 23) return null
  if (minute < 0 || minute > 59) return null

  return { hour, minute }
}

export function formatTimeHHMM(time: ParsedTime): string {
  return `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`
}

export function to24Hour(hour12: number, meridiem: "am" | "pm"): number {
  const normalized = hour12 % 12
  return meridiem === "pm" ? normalized + 12 : normalized
}

function parseHour12Token(value: string | undefined): number | null {
  if (!value) return null
  const token = value.trim()
  if (!/^\d{1,2}$/.test(token)) return null

  const parsed = Number(token)
  if (parsed >= 1 && parsed <= 12) return parsed

  // Speech-to-text can collapse "to 8pm" into "28pm".
  // Pattern doc: docs/error-patterns/schedule-transcript-short-pause-context-loss.md
  if (/^2[1-9]$/.test(token)) {
    return Number(token[1])
  }

  return null
}

export function normalizeTimeToHHMM(time: string): string | null {
  const direct = parseTimeHHMM(time)
  if (direct) return formatTimeHHMM(direct)

  const explicit = extractExplicitTimeFromText(time)
  if (explicit) return formatTimeHHMM(explicit)

  return null
}

export function extractExplicitTimeFromText(text: string): ParsedTime | null {
  // This is intentionally conservative: only treat a time as "explicit" when
  // the user provides AM/PM (or 24h time with hour>=13). This prevents us from
  // overriding the model when the user says something ambiguous like "at 9:30".
  const input = text.toLowerCase()

  const foundTimes = new Map<string, ParsedTime>()

  const push = (t: ParsedTime) => {
    const key = formatTimeHHMM(t)
    foundTimes.set(key, t)
  }

  // e.g. "9:30pm", "9:30 pm", "9.30 p.m."
  for (const match of input.matchAll(/\b(1[0-2]|0?[1-9])\s*[:.]\s*([0-5]\d)\s*(a\.?m|p\.?m)\b/g)) {
    const hour12 = Number(match[1])
    const minute = Number(match[2])
    const meridiem = match[3]?.startsWith("p") ? "pm" : "am"
    push({ hour: to24Hour(hour12, meridiem), minute })
  }

  // e.g. "9 30 pm" (common speech-to-text variant)
  for (const match of input.matchAll(/\b(1[0-2]|0?[1-9])\s+([0-5]\d)\s*(a\.?m|p\.?m)\b/g)) {
    const hour12 = Number(match[1])
    const minute = Number(match[2])
    const meridiem = match[3]?.startsWith("p") ? "pm" : "am"
    push({ hour: to24Hour(hour12, meridiem), minute })
  }

  // e.g. "9pm", "9 pm", "9 p.m."
  for (const match of input.matchAll(/\b([0-2]?\d)\s*(a\.?m|p\.?m)\b/g)) {
    // Avoid matching minute fragments from HH:MM strings (e.g. "9:07 PM" -> "07 PM").
    // Pattern doc: docs/error-patterns/schedule-activity-leading-zero-minute-time-parse.md
    if ((match.index ?? 0) > 0) {
      const previousChar = input[(match.index ?? 0) - 1]
      if (previousChar === ":" || previousChar === ".") continue
    }

    const hour12 = parseHour12Token(match[1])
    if (hour12 === null) continue
    const meridiem = match[2]?.startsWith("p") ? "pm" : "am"
    push({ hour: to24Hour(hour12, meridiem), minute: 0 })
  }

  // e.g. "2 8pm" (collapsed STT for "to 8pm")
  for (const match of input.matchAll(/\b2\s+([1-9])\s*(a\.?m|p\.?m)\b/g)) {
    const hour12 = Number(match[1])
    const meridiem = match[2]?.startsWith("p") ? "pm" : "am"
    push({ hour: to24Hour(hour12, meridiem), minute: 0 })
  }

  // e.g. "21:30" (24h). Only accept hour>=13 to avoid ambiguity with "9:30".
  for (const match of input.matchAll(/\b([01]?\d|2[0-3])\s*[:.]\s*([0-5]\d)\b/g)) {
    const hour = Number(match[1])
    if (hour < 13) continue
    const minute = Number(match[2])
    push({ hour, minute })
  }

  if (foundTimes.size !== 1) return null
  return foundTimes.values().next().value ?? null
}
