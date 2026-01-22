import { Temporal } from "temporal-polyfill"
import { normalizeTimeToHHMM } from "./time"

export function formatZonedDateTimeForMessage(dateISO: string, timeHHMM: string, timeZone: string): string {
  const [year, month, day] = dateISO.split("-").map(Number)
  const [hour, minute] = timeHHMM.split(":").map(Number)

  try {
    const zdt = Temporal.ZonedDateTime.from({
      timeZone,
      year,
      month,
      day,
      hour,
      minute,
    })

    return new Intl.DateTimeFormat([], {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(zdt.epochMilliseconds))
  } catch {
    const dt = new Date(year, month - 1, day, hour, minute, 0, 0)
    return dt.toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }
}

export function parseZonedDateTimeInstant(date: string, time: string, timeZone: string): string | null {
  const normalizedTime = normalizeTimeToHHMM(time)
  if (!normalizedTime) return null

  const [yearStr, monthStr, dayStr] = date.split("-")
  const [hourStr, minuteStr] = normalizedTime.split(":")

  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)
  const hour = Number(hourStr)
  const minute = Number(minuteStr)

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return null
  }

  if (month < 1 || month > 12) return null
  if (hour < 0 || hour > 23) return null
  if (minute < 0 || minute > 59) return null

  try {
    // Parse via ISO string to reject overflow dates like 2024-02-31.
    const plainDateTime = Temporal.PlainDateTime.from(`${yearStr}-${monthStr}-${dayStr}T${normalizedTime}`)
    const zdt = plainDateTime.toZonedDateTime(timeZone)
    return zdt.toInstant().toString()
  } catch {
    return null
  }
}
