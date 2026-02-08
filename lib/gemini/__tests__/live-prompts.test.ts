import { describe, it, expect, vi } from "vitest"

describe("buildCheckInSystemInstruction", () => {
  it("instructs schedule_activity to preserve specific titles and explicit durations", async () => {
    const { CHECK_IN_SYSTEM_PROMPT } = await vi.importActual<
      typeof import("@/lib/gemini/live-prompts")
    >("@/lib/gemini/live-prompts")

    expect(CHECK_IN_SYSTEM_PROMPT).toContain("avoid generic titles")
    expect(CHECK_IN_SYSTEM_PROMPT).toContain("Preserve explicit user duration exactly")
  })

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

  it("includes scheduled suggestion times in follow-up context", async () => {
    const { buildCheckInSystemInstruction } = await vi.importActual<
      typeof import("@/lib/gemini/live-prompts")
    >("@/lib/gemini/live-prompts")

    const instruction = buildCheckInSystemInstruction(
      {
        patternSummary: "Work stress has been up this week.",
        keyObservations: ["Evening check-ins are more tense"],
        contextNotes: "Keep the opener warm and brief.",
        recentSuggestions: [
          {
            id: "soup_1",
            content: "Make chicken noodle soup",
            rationale: "A warm meal can be grounding.",
            duration: 30,
            category: "rest",
            status: "scheduled",
            createdAt: "2026-02-07T18:15:00.000Z",
            scheduledFor: "2026-02-08T02:00:00.000Z",
          },
        ],
      },
      {
        currentTime: "Saturday, February 07, 2026 at 6:30 PM PST (America/Los_Angeles)",
        dayOfWeek: "Saturday",
        timeOfDay: "evening",
        daysSinceLastCheckIn: 1,
      },
      "balanced"
    )

    expect(instruction).toContain("Recently accepted/scheduled suggestions")
    expect(instruction).toContain("Make chicken noodle soup")
    expect(instruction).toContain("Scheduled for:")
  })

  it("keeps scheduled suggestion context available in supportive mode", async () => {
    const { buildCheckInSystemInstruction } = await vi.importActual<
      typeof import("@/lib/gemini/live-prompts")
    >("@/lib/gemini/live-prompts")

    const instruction = buildCheckInSystemInstruction(
      {
        patternSummary: "Keep things gentle.",
        keyObservations: [],
        contextNotes: "No pressure.",
        recentSuggestions: [
          {
            id: "soup_2",
            content: "Make chicken noodle soup",
            rationale: "Comfort food can help unwind.",
            duration: 30,
            category: "rest",
            status: "scheduled",
            createdAt: "2026-02-07T18:15:00.000Z",
            scheduledFor: "2026-02-08T02:00:00.000Z",
          },
        ],
      },
      {
        currentTime: "Saturday, February 07, 2026 at 6:30 PM PST (America/Los_Angeles)",
        dayOfWeek: "Saturday",
        timeOfDay: "evening",
        daysSinceLastCheckIn: 1,
      },
      "supportive"
    )

    expect(instruction).toContain("Recently accepted/scheduled suggestions")
  })
})
