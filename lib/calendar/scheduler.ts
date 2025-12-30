// Recovery block scheduling logic
// Finds optimal time slots and creates RecoveryBlock records

import type { Suggestion, RecoveryBlock, UserSettings } from "@/lib/types"
import type { OAuthTokens } from "./oauth"
import { getFreeBusy, findNextAvailableSlot, createCalendarEvent, suggestionToEventParams } from "./api"

export interface ScheduleResult {
  success: boolean
  recoveryBlock?: RecoveryBlock
  error?: string
}

// ============================================
// Scheduling Logic
// ============================================

/**
 * Schedule a recovery block from a suggestion
 * Finds the next available time slot respecting user preferences
 */
export async function scheduleRecoveryBlock(
  suggestion: Suggestion,
  tokens: OAuthTokens,
  settings?: UserSettings
): Promise<ScheduleResult> {
  try {
    // Determine search window based on time of day and user preferences
    const scheduledTime = await findOptimalTimeSlot(
      suggestion.duration,
      tokens,
      settings?.preferredRecoveryTimes
    )

    if (!scheduledTime) {
      return {
        success: false,
        error: "No available time slots found in the next 24 hours",
      }
    }

    // Update suggestion with scheduled time
    const updatedSuggestion: Suggestion = {
      ...suggestion,
      scheduledFor: scheduledTime.toISOString(),
    }

    // Create calendar event
    const eventParams = suggestionToEventParams(updatedSuggestion)
    const calendarEvent = await createCalendarEvent(eventParams, tokens)

    // Create recovery block record
    const recoveryBlock: RecoveryBlock = {
      id: generateRecoveryBlockId(),
      suggestionId: suggestion.id,
      calendarEventId: calendarEvent.id,
      scheduledAt: scheduledTime.toISOString(),
      duration: suggestion.duration,
      completed: false,
    }

    return {
      success: true,
      recoveryBlock,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}

/**
 * Find optimal time slot for a recovery block
 * Considers user's preferred recovery times and calendar availability
 */
async function findOptimalTimeSlot(
  duration: number,
  tokens: OAuthTokens,
  preferredTimes?: string[]
): Promise<Date | null> {
  const now = new Date()
  const searchEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours ahead

  // Get busy periods from calendar
  const busyPeriods = await getFreeBusy(
    now.toISOString(),
    searchEnd.toISOString(),
    tokens
  )

  // If user has preferred times, try those first
  if (preferredTimes && preferredTimes.length > 0) {
    const preferredSlot = findPreferredTimeSlot(
      duration,
      preferredTimes,
      busyPeriods,
      now
    )

    if (preferredSlot) return preferredSlot
  }

  // Fall back to next available slot
  return findNextAvailableSlot(duration, busyPeriods, now)
}

/**
 * Find a time slot matching user's preferred recovery times
 */
function findPreferredTimeSlot(
  duration: number,
  preferredTimes: string[], // Array of "HH:mm" strings
  busyPeriods: Array<{ start: string; end: string }>,
  searchStart: Date
): Date | null {
  // Check today and tomorrow
  for (let dayOffset = 0; dayOffset < 2; dayOffset++) {
    const targetDate = new Date(searchStart)
    targetDate.setDate(targetDate.getDate() + dayOffset)

    // Try each preferred time
    for (const timeStr of preferredTimes) {
      const [hours, minutes] = timeStr.split(":").map(Number)

      const slotStart = new Date(targetDate)
      slotStart.setHours(hours, minutes, 0, 0)

      // Skip if slot is in the past
      if (slotStart < searchStart) continue

      const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000)

      // Check if slot is available
      const hasConflict = busyPeriods.some((busy) => {
        const busyStart = new Date(busy.start).getTime()
        const busyEnd = new Date(busy.end).getTime()
        const slotStartTime = slotStart.getTime()
        const slotEndTime = slotEnd.getTime()

        return slotStartTime < busyEnd && slotEndTime > busyStart
      })

      if (!hasConflict) {
        return slotStart
      }
    }
  }

  return null
}

/**
 * Batch schedule multiple recovery blocks
 * Useful for auto-scheduling when elevated stress is detected
 */
export async function scheduleMultipleRecoveryBlocks(
  suggestions: Suggestion[],
  tokens: OAuthTokens,
  settings?: UserSettings
): Promise<ScheduleResult[]> {
  const results: ScheduleResult[] = []

  // Schedule sequentially to avoid conflicts
  for (const suggestion of suggestions) {
    const result = await scheduleRecoveryBlock(suggestion, tokens, settings)
    results.push(result)

    // If scheduling failed, don't try to schedule more
    if (!result.success) break
  }

  return results
}

/**
 * Check if a recovery block is upcoming (within next 2 hours)
 */
export function isUpcoming(recoveryBlock: RecoveryBlock): boolean {
  const scheduledTime = new Date(recoveryBlock.scheduledAt).getTime()
  const now = Date.now()
  const twoHours = 2 * 60 * 60 * 1000

  return scheduledTime > now && scheduledTime - now < twoHours
}

/**
 * Check if a recovery block is overdue
 */
export function isOverdue(recoveryBlock: RecoveryBlock): boolean {
  const scheduledTime = new Date(recoveryBlock.scheduledAt).getTime()
  const duration = recoveryBlock.duration * 60 * 1000

  return !recoveryBlock.completed && Date.now() > scheduledTime + duration
}

/**
 * Get recommended recovery times based on time of day
 * Used when user hasn't set preferred times
 */
export function getDefaultRecoveryTimes(): string[] {
  const now = new Date()
  const hour = now.getHours()

  // Morning: suggest afternoon break
  if (hour < 12) {
    return ["14:00", "15:30", "17:00"]
  }

  // Afternoon: suggest late afternoon/evening
  if (hour < 17) {
    return ["17:00", "18:30", "20:00"]
  }

  // Evening: suggest tomorrow morning
  return ["10:00", "14:00", "16:00"]
}

// ============================================
// Utility Functions
// ============================================

/**
 * Generate a unique ID for a recovery block
 */
function generateRecoveryBlockId(): string {
  return `rb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Calculate total recovery time scheduled in a period
 */
export function calculateTotalRecoveryTime(recoveryBlocks: RecoveryBlock[]): number {
  return recoveryBlocks.reduce((total, block) => total + block.duration, 0)
}

/**
 * Get recovery blocks scheduled for today
 */
export function getTodayRecoveryBlocks(recoveryBlocks: RecoveryBlock[]): RecoveryBlock[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  return recoveryBlocks.filter((block) => {
    const scheduledDate = new Date(block.scheduledAt)
    return scheduledDate >= today && scheduledDate < tomorrow
  })
}

/**
 * Format duration for display
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`
  }

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (mins === 0) {
    return `${hours} hr`
  }

  return `${hours} hr ${mins} min`
}
