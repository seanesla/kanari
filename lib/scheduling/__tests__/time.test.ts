import { describe, expect, it } from "vitest"
import { extractExplicitTimeFromText, normalizeTimeToHHMM } from "@/lib/scheduling/time"

describe("scheduling/time", () => {
  it("extracts a single explicit AM/PM time", () => {
    expect(extractExplicitTimeFromText("Schedule at 9:30PM")).toEqual({ hour: 21, minute: 30 })
  })

  it("handles speech-to-text variants and punctuation", () => {
    expect(extractExplicitTimeFromText("Let's meet at 9.30 p.m.")).toEqual({ hour: 21, minute: 30 })
    expect(extractExplicitTimeFromText("Let's meet at 9 30 pm")).toEqual({ hour: 21, minute: 30 })
  })

  it("returns null when multiple distinct times are present", () => {
    expect(extractExplicitTimeFromText("at 9pm or 10pm")).toBeNull()
  })

  it("dedupes repeated references to the same time", () => {
    expect(extractExplicitTimeFromText("9pm, 9 pm"))
      // Map key is HH:MM, so duplicates collapse to one.
      .toEqual({ hour: 21, minute: 0 })
  })

  it("does not treat ambiguous 9:30 as explicit", () => {
    expect(extractExplicitTimeFromText("Schedule a break at 9:30 tomorrow")).toBeNull()
  })

  it("accepts 24h time only when hour >= 13", () => {
    expect(extractExplicitTimeFromText("at 21:30"))
      // Accepted (hour >= 13).
      .toEqual({ hour: 21, minute: 30 })

    expect(extractExplicitTimeFromText("at 09:30"))
      // Rejected to avoid ambiguity with 9:30am vs 9:30pm.
      .toBeNull()
  })

  it("normalizes various time strings to HH:MM", () => {
    expect(normalizeTimeToHHMM("9:3")).toBe("09:03")
    expect(normalizeTimeToHHMM("10:00 PM")).toBe("22:00")
    expect(normalizeTimeToHHMM("09:30")).toBe("09:30")
  })
})
