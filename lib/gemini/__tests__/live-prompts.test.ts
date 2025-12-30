import { describe, it, expect, vi } from "vitest"

describe("buildCheckInSystemInstruction", () => {
  it("includes time context with an explicit local-time label", async () => {
    const { buildCheckInSystemInstruction } = await vi.importActual<
      typeof import("@/lib/gemini/live-prompts")
    >("@/lib/gemini/live-prompts")

    const instruction = buildCheckInSystemInstruction(undefined, {
      currentTime: "Monday, December 29, 2025 at 10:45 PM PST (America/Los_Angeles)",
      dayOfWeek: "Monday",
      timeOfDay: "night",
      daysSinceLastCheckIn: 2,
    })

    expect(instruction).toContain("CURRENT TIME CONTEXT")
    expect(instruction).toContain("Current time (user local): Monday, December 29, 2025")
    expect(instruction).toContain("Time of day: night")
    expect(instruction).toContain("Days since last check-in: 2")
  })

  it("handles first check-in messaging when daysSinceLastCheckIn is null", async () => {
    const { buildCheckInSystemInstruction } = await vi.importActual<
      typeof import("@/lib/gemini/live-prompts")
    >("@/lib/gemini/live-prompts")

    const instruction = buildCheckInSystemInstruction(undefined, {
      currentTime: "Tuesday, December 30, 2025 at 9:00 AM PST (America/Los_Angeles)",
      dayOfWeek: "Tuesday",
      timeOfDay: "morning",
      daysSinceLastCheckIn: null,
    })

    expect(instruction).toContain("This is the user's first check-in")
  })
})
