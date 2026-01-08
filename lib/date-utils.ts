/**
 * Centralized date formatting utilities
 */

function getYmdParts(date: Date, timeZone?: string): { year: number; month: number; day: number } {
  if (!timeZone) {
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  const year = Number(parts.find((p) => p.type === "year")?.value)
  const month = Number(parts.find((p) => p.type === "month")?.value)
  const day = Number(parts.find((p) => p.type === "day")?.value)

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
  }

  return { year, month, day }
}

/**
 * Get the start of the current week (Monday at 00:00:00)
 */
export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date)
  const day = d.getDay()
  // Adjust for Monday start (0 = Sunday, so Monday = 1)
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Get the end of the current week (Sunday at 23:59:59.999)
 */
export function getWeekEnd(date: Date = new Date()): Date {
  const weekStart = getWeekStart(date)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  return weekEnd
}

/**
 * Check if an ISO date string falls within the current week
 */
export function isThisWeek(isoString: string): boolean {
  const date = new Date(isoString)
  const weekStart = getWeekStart()
  const weekEnd = getWeekEnd()
  return date >= weekStart && date <= weekEnd
}

/**
 * Format duration in mm:ss format
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

/**
 * Format duration with unit labels (e.g., "1m 43s")
 */
export function formatDurationWithUnits(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}m ${secs}s`
}

/**
 * Format date for display (e.g., "Mon, Dec 23, 3:45 PM")
 */
export function formatDate(dateStr: string, timeZone?: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  })
}

/**
 * Format time only (e.g., "3:45 PM")
 */
export function formatTime(dateStr: string, timeZone?: string): string {
  const date = new Date(dateStr)
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  })
}

/**
 * Get a consistent date key for grouping (YYYY-MM-DD format)
 */
export function getDateKey(dateStr: string, timeZone?: string): string {
  const date = new Date(dateStr)
  if (timeZone) {
    const { year, month, day } = getYmdParts(date, timeZone)
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }
  return date.toISOString().split("T")[0]
}

/**
 * Get human-readable date label for section dividers
 * Returns "Today", "Yesterday", or "Mon, Dec 25"
 */
export function getDateLabel(dateStr: string, timeZone?: string): string {
  const date = new Date(dateStr)
  const now = new Date()

  const dateYmd = getYmdParts(date, timeZone)
  const nowYmd = getYmdParts(now, timeZone)

  const dateKey = `${dateYmd.year}-${dateYmd.month}-${dateYmd.day}`
  const todayKey = `${nowYmd.year}-${nowYmd.month}-${nowYmd.day}`
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const yesterdayYmd = getYmdParts(yesterday, timeZone)
  const yesterdayKey = `${yesterdayYmd.year}-${yesterdayYmd.month}-${yesterdayYmd.day}`

  if (dateKey === todayKey) return "Today"
  if (dateKey === yesterdayKey) return "Yesterday"

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(timeZone ? { timeZone } : {}),
  })
}

/**
 * Format scheduled time with relative dates
 * Returns "Today at 3:00 PM", "Tomorrow at 10:00 AM", or "Mon, Dec 23 at 3:00 PM"
 */
export function formatScheduledTime(isoString: string, timeZone?: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const dateYmd = getYmdParts(date, timeZone)
  const nowYmd = getYmdParts(now, timeZone)

  const dateKey = `${dateYmd.year}-${dateYmd.month}-${dateYmd.day}`
  const todayKey = `${nowYmd.year}-${nowYmd.month}-${nowYmd.day}`
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowYmd = getYmdParts(tomorrow, timeZone)
  const tomorrowKey = `${tomorrowYmd.year}-${tomorrowYmd.month}-${tomorrowYmd.day}`

  const isToday = dateKey === todayKey
  const isTomorrow = dateKey === tomorrowKey

  const timeStr = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  })

  if (isToday) return `Today at ${timeStr}`
  if (isTomorrow) return `Tomorrow at ${timeStr}`

  const dateStr = date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(timeZone ? { timeZone } : {}),
  })
  return `${dateStr} at ${timeStr}`
}
