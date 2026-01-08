export const DEFAULT_TIME_ZONE = "America/Los_Angeles"

export const COMMON_TIME_ZONES: string[] = [
  DEFAULT_TIME_ZONE,
  "America/New_York",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Kolkata",
  "Australia/Sydney",
  "UTC",
]

const FRIENDLY_TIME_ZONE_NAMES: Record<string, string> = {
  "America/Los_Angeles": "Pacific Time (US)",
  "America/New_York": "Eastern Time (US)",
  "Europe/London": "London",
  "Europe/Paris": "Central European (Paris)",
  "Asia/Tokyo": "Tokyo",
  "Asia/Kolkata": "India (Kolkata)",
  "Australia/Sydney": "Sydney",
  UTC: "UTC",
}

export function formatTimeZoneLabel(timeZone: string): string {
  const friendly = FRIENDLY_TIME_ZONE_NAMES[timeZone]
  return friendly ? `${friendly} (${timeZone})` : timeZone
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone })
    return true
  } catch {
    return false
  }
}

export function normalizeTimeZone(timeZone: string | undefined | null): string {
  if (!timeZone) return DEFAULT_TIME_ZONE
  return isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE
}

export function getSupportedTimeZones(): string[] {
  const supportedValuesOf = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] })
    .supportedValuesOf
  if (!supportedValuesOf) return [...COMMON_TIME_ZONES]

  try {
    const timeZones = supportedValuesOf("timeZone")
    if (Array.isArray(timeZones) && timeZones.length > 0) return timeZones
  } catch {
    // ignore
  }
  return [...COMMON_TIME_ZONES]
}
