import { Temporal } from "temporal-polyfill"
import type { RecurrenceFrequency, RecurrenceWeekday } from "@/lib/types"
import { normalizeTimeToHHMM } from "./time"
import { parseZonedDateTimeInstant } from "./zoned"

const WEEKDAY_TO_TEMPORAL_DAY: Record<RecurrenceWeekday, number> = {
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  sun: 7,
}

const EXPANSION_MAX_ITERATIONS = 20000

export const MAX_RECURRING_SCHEDULE_OCCURRENCES = 30

export interface ExpandRecurringScheduleInput {
  startDate: string
  time: string
  timeZone: string
  frequency: RecurrenceFrequency
  weekdays?: RecurrenceWeekday[]
  count?: number
  untilDate?: string
  maxOccurrences?: number
}

export interface RecurringScheduleOccurrence {
  date: string
  time: string
  scheduledFor: string
}

export interface ExpandedRecurringSchedule {
  occurrences: RecurringScheduleOccurrence[]
  truncated: boolean
  skippedInvalidDateTimes: number
}

function parseIsoDateOrThrow(value: string, label: string): Temporal.PlainDate {
  try {
    return Temporal.PlainDate.from(value)
  } catch {
    throw new Error(`Invalid ${label}: expected YYYY-MM-DD`)
  }
}

function normalizeWeekdaySet(weekdays: RecurrenceWeekday[] | undefined): Set<number> {
  const values = weekdays ?? []
  const normalized = new Set<number>()
  for (const weekday of values) {
    normalized.add(WEEKDAY_TO_TEMPORAL_DAY[weekday])
  }
  return normalized
}

function shouldIncludeDate(
  date: Temporal.PlainDate,
  frequency: RecurrenceFrequency,
  customWeekdaySet: Set<number>
): boolean {
  if (frequency === "daily") return true
  if (frequency === "weekly") return true
  if (frequency === "weekdays") {
    return date.dayOfWeek >= 1 && date.dayOfWeek <= 5
  }
  return customWeekdaySet.has(date.dayOfWeek)
}

export function expandRecurringScheduleOccurrences(
  input: ExpandRecurringScheduleInput
): ExpandedRecurringSchedule {
  const normalizedTime = normalizeTimeToHHMM(input.time)
  if (!normalizedTime) {
    throw new Error("Invalid time: expected parseable HH:MM or AM/PM")
  }

  const count =
    input.count == null
      ? null
      : Number.isFinite(input.count)
        ? Math.max(1, Math.floor(input.count))
        : null

  if (input.count != null && count == null) {
    throw new Error("Invalid recurrence count")
  }

  const startDate = parseIsoDateOrThrow(input.startDate, "startDate")
  const untilDate = input.untilDate
    ? parseIsoDateOrThrow(input.untilDate, "untilDate")
    : null

  if (count == null && untilDate == null) {
    throw new Error("Recurring schedule requires either count or untilDate")
  }

  const customWeekdaySet = normalizeWeekdaySet(input.weekdays)
  if (input.frequency === "custom_weekdays" && customWeekdaySet.size === 0) {
    throw new Error("Custom weekday recurrence requires at least one weekday")
  }

  const maxOccurrences = Number.isFinite(input.maxOccurrences)
    ? Math.max(1, Math.floor(input.maxOccurrences!))
    : MAX_RECURRING_SCHEDULE_OCCURRENCES

  // Validate time zone up-front so expansion does not loop with consistently invalid date-times.
  try {
    Temporal.Now.zonedDateTimeISO(input.timeZone)
  } catch {
    throw new Error("Invalid time zone")
  }

  if (untilDate && Temporal.PlainDate.compare(untilDate, startDate) < 0) {
    return {
      occurrences: [],
      truncated: false,
      skippedInvalidDateTimes: 0,
    }
  }

  const occurrences: RecurringScheduleOccurrence[] = []
  let skippedInvalidDateTimes = 0
  let truncated = false
  let cursor = startDate
  let iterations = 0

  while (true) {
    iterations += 1
    if (iterations > EXPANSION_MAX_ITERATIONS) {
      throw new Error("Recurring schedule expansion exceeded safety iteration limit")
    }

    if (untilDate && Temporal.PlainDate.compare(cursor, untilDate) > 0) {
      break
    }

    if (shouldIncludeDate(cursor, input.frequency, customWeekdaySet)) {
      const scheduledFor = parseZonedDateTimeInstant(cursor.toString(), normalizedTime, input.timeZone)
      if (scheduledFor) {
        if (occurrences.length >= maxOccurrences) {
          truncated = true
          break
        }

        occurrences.push({
          date: cursor.toString(),
          time: normalizedTime,
          scheduledFor,
        })

        if (count !== null && occurrences.length >= count) {
          break
        }
      } else {
        skippedInvalidDateTimes += 1
      }
    }

    cursor = input.frequency === "weekly"
      ? cursor.add({ weeks: 1 })
      : cursor.add({ days: 1 })
  }

  return {
    occurrences,
    truncated,
    skippedInvalidDateTimes,
  }
}
