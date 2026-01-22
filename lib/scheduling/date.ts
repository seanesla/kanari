import { Temporal } from "temporal-polyfill"

export function extractDateISOFromText(text: string, timeZone: string): string | null {
  const input = text.toLowerCase()

  const explicitDate = input.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0]
  if (explicitDate) return explicitDate

  const today = Temporal.Now.zonedDateTimeISO(timeZone).toPlainDate()

  if (input.includes("tomorrow")) {
    return today.add({ days: 1 }).toString()
  }

  if (input.includes("today") || input.includes("tonight")) {
    return today.toString()
  }

  return null
}
