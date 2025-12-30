/**
 * Centralized date formatting utilities
 */

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
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/**
 * Get a consistent date key for grouping (YYYY-MM-DD format)
 */
export function getDateKey(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toISOString().split("T")[0]
}

/**
 * Get human-readable date label for section dividers
 * Returns "Today", "Yesterday", or "Mon, Dec 25"
 */
export function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()

  // Reset times to compare just dates
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayOnly = new Date(todayOnly)
  yesterdayOnly.setDate(yesterdayOnly.getDate() - 1)

  if (dateOnly.getTime() === todayOnly.getTime()) return "Today"
  if (dateOnly.getTime() === yesterdayOnly.getTime()) return "Yesterday"

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

/**
 * Format scheduled time with relative dates
 * Returns "Today at 3:00 PM", "Tomorrow at 10:00 AM", or "Mon, Dec 23 at 3:00 PM"
 */
export function formatScheduledTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isTomorrow = date.toDateString() === tomorrow.toDateString()

  const timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })

  if (isToday) return `Today at ${timeStr}`
  if (isTomorrow) return `Tomorrow at ${timeStr}`

  const dateStr = date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric"
  })
  return `${dateStr} at ${timeStr}`
}
