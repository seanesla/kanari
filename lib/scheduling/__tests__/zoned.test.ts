import { describe, expect, it } from "vitest"
import { parseZonedDateTimeInstant } from "@/lib/scheduling/zoned"
import { Temporal } from "temporal-polyfill"

describe("scheduling/zoned", () => {
  it("parses an Instant for UTC date/time", () => {
    const instant = parseZonedDateTimeInstant("2025-01-01", "22:00", "UTC")
    expect(instant).toBeTruthy()
    expect(Temporal.Instant.from(instant!).epochMilliseconds).toBe(Temporal.Instant.from("2025-01-01T22:00:00Z").epochMilliseconds)
  })

  it("accepts AM/PM time strings", () => {
    const instant = parseZonedDateTimeInstant("2025-01-01", "10:00 PM", "UTC")
    expect(instant).toBeTruthy()
    expect(Temporal.Instant.from(instant!).epochMilliseconds).toBe(Temporal.Instant.from("2025-01-01T22:00:00Z").epochMilliseconds)
  })

  it("rejects overflow dates like 2024-02-31", () => {
    expect(parseZonedDateTimeInstant("2024-02-31", "09:30", "UTC")).toBeNull()
  })
})
