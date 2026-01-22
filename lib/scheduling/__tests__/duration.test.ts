import { describe, expect, it } from "vitest"
import { clampDurationMinutes, extractDurationMinutesFromText, inferScheduleDurationMinutes } from "@/lib/scheduling/duration"

describe("scheduling/duration", () => {
  it("extracts durations in minutes and hours", () => {
    expect(extractDurationMinutesFromText("for 30 minutes")).toBe(30)
    expect(extractDurationMinutesFromText("2 hours")).toBe(120)
  })

  it("clamps durations to a safe range", () => {
    expect(clampDurationMinutes(3)).toBe(5)
    expect(clampDurationMinutes(260)).toBe(240)
    expect(clampDurationMinutes(Number.NaN)).toBe(20)
  })

  it("prefers explicit durations over heuristics", () => {
    expect(inferScheduleDurationMinutes("Schedule an appointment for 30 minutes.")).toBe(30)
    expect(inferScheduleDurationMinutes("Schedule a break")).toBe(15)
  })
})
