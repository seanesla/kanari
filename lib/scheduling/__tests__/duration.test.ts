import { describe, expect, it } from "vitest"
import { clampDurationMinutes, extractDurationMinutesFromText, inferScheduleDurationMinutes } from "@/lib/scheduling/duration"

describe("scheduling/duration", () => {
  it("extracts durations in minutes and hours", () => {
    expect(extractDurationMinutesFromText("for 30 minutes")).toBe(30)
    expect(extractDurationMinutesFromText("2 hours")).toBe(120)
    expect(extractDurationMinutesFromText("for five hours")).toBe(300)
  })

  it("infers duration from explicit time ranges", () => {
    expect(extractDurationMinutesFromText("Schedule study from 3pm to 8pm Monday through Friday.")).toBe(300)
    expect(extractDurationMinutesFromText("It's from 3pm to 28pm.")).toBe(300)
  })

  it("clamps durations to a safe range", () => {
    expect(clampDurationMinutes(3)).toBe(5)
    expect(clampDurationMinutes(900)).toBe(720)
    expect(clampDurationMinutes(Number.NaN)).toBe(20)
  })

  it("prefers explicit durations over heuristics", () => {
    expect(inferScheduleDurationMinutes("Schedule an appointment for 30 minutes.")).toBe(30)
    expect(inferScheduleDurationMinutes("Schedule a break")).toBe(15)
  })
})
