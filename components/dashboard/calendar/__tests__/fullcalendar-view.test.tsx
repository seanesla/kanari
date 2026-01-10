// @vitest-environment jsdom

import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render } from "@testing-library/react"
import type { EventInput } from "@fullcalendar/core"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

let lastFullCalendarProps: Record<string, unknown> | null = null

vi.mock("@/lib/scene-context", () => ({
  useSceneMode: () => ({ accentColor: "#f59e0b" }),
}))

vi.mock("@/lib/timezone-context", () => ({
  useTimeZone: () => ({ timeZone: "UTC" }),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}))

vi.mock("@fullcalendar/react", () => ({
  default: (props: Record<string, unknown>) => {
    lastFullCalendarProps = props
    return <div data-testid="fullcalendar" />
  },
}))

describe("FullCalendarView", () => {
  beforeEach(() => {
    lastFullCalendarProps = null
  })

  it("imports FullCalendar base CSS files required for layout", () => {
    const currentDir = dirname(fileURLToPath(import.meta.url))
    const fullCalendarViewPath = resolve(currentDir, "../fullcalendar-view.tsx")
    const source = readFileSync(fullCalendarViewPath, "utf8")

    expect(source).toContain('import "./fullcalendar-base.css"')
  })

  it("maps scheduled, completed, and check-in items into calendar events", async () => {
    const { FullCalendarView } = await import("../fullcalendar-view")

    render(
      <FullCalendarView
        scheduledSuggestions={[
          {
            id: "s1",
            content: "This is a very long suggestion sentence that definitely exceeds thirty characters.",
            rationale: "rationale",
            duration: 30,
            category: "exercise",
            status: "scheduled",
            createdAt: "2026-01-01T00:00:00Z",
            scheduledFor: "2026-01-09T10:00:00Z",
          },
        ]}
        completedSuggestions={[
          {
            id: "s2",
            content: "Meditate quietly for a while.",
            rationale: "rationale",
            duration: 15,
            category: "rest",
            status: "completed",
            createdAt: "2026-01-01T00:00:00Z",
            scheduledFor: "2026-01-10T12:00:00Z",
          },
        ]}
        checkInSessions={[
          {
            id: "c1",
            startedAt: "2026-01-11T09:00:00Z",
            messages: [],
            duration: 1200,
            acousticMetrics: {
              stressScore: 42,
              fatigueScore: 70,
              stressLevel: "moderate",
              fatigueLevel: "tired",
              confidence: 0.8,
              analyzedAt: "2026-01-11T09:20:00Z",
              features: {
                mfcc: [],
                spectralCentroid: 0,
                spectralFlux: 0,
                spectralRolloff: 0,
                rms: 0,
                zcr: 0,
                speechRate: 0,
                pauseRatio: 0,
                pauseCount: 0,
                avgPauseDuration: 0,
                pitchMean: 0,
                pitchStdDev: 0,
                pitchRange: 0,
              },
            },
          },
        ]}
      />
    )

    expect(lastFullCalendarProps).not.toBeNull()
    const events = (lastFullCalendarProps?.events ?? []) as EventInput[]
    expect(events).toHaveLength(3)

    const scheduledEvent = events.find((e) => e.id === "s1") as EventInput
    expect(scheduledEvent.title).toMatch(/\.\.\.$/)
    expect(scheduledEvent.start).toBe("2026-01-09T10:00:00+00:00")
    expect(scheduledEvent.end).toBe("2026-01-09T10:30:00+00:00")
    expect(scheduledEvent.backgroundColor).toBe("#14532d")
    expect(scheduledEvent.borderColor).toBe("#22c55e")
    expect(scheduledEvent.textColor).toBe("#dcfce7")

    const completedEvent = events.find((e) => e.id === "completed-s2") as EventInput
    expect(completedEvent.title).toMatch(/^✓ /)
    expect(completedEvent.backgroundColor).toBe("#374151")
    expect(completedEvent.borderColor).toBe("#6b7280")
    expect(completedEvent.textColor).toBe("#9ca3af")

    const checkInEvent = events.find((e) => e.id === "checkin-c1") as EventInput
    expect(checkInEvent.title).toBe("✓ Check-in • S:42 F:70")
    expect(checkInEvent.backgroundColor).toBe("#78350f")
    expect(checkInEvent.borderColor).toBe("#f59e0b")
    expect(checkInEvent.textColor).toBe("#fef3c7")
    expect(checkInEvent.classNames).toEqual(["checkin-event"])
  })

  it("memoizes computed events when inputs are referentially stable", async () => {
    const { FullCalendarView } = await import("../fullcalendar-view")

    const scheduledSuggestions = [
      {
        id: "s1",
        content: "Take a short break.",
        rationale: "rationale",
        duration: 15,
        category: "break",
        status: "scheduled",
        createdAt: "2026-01-01T00:00:00Z",
        scheduledFor: "2026-01-09T10:00:00Z",
      },
    ]

    const completedSuggestions = [
      {
        id: "s2",
        content: "Stretch lightly.",
        rationale: "rationale",
        duration: 5,
        category: "exercise",
        status: "completed",
        createdAt: "2026-01-01T00:00:00Z",
        scheduledFor: "2026-01-09T12:00:00Z",
      },
    ]

    const checkInSessions = [
      {
        id: "c1",
        startedAt: "2026-01-09T09:00:00Z",
        messages: [],
      },
    ]

    const { rerender } = render(
      <FullCalendarView
        scheduledSuggestions={scheduledSuggestions}
        completedSuggestions={completedSuggestions}
        checkInSessions={checkInSessions}
      />
    )

    const firstEventsRef = (lastFullCalendarProps?.events ?? null) as EventInput[] | null

    rerender(
      <FullCalendarView
        scheduledSuggestions={scheduledSuggestions}
        completedSuggestions={completedSuggestions}
        checkInSessions={checkInSessions}
      />
    )

    const secondEventsRef = (lastFullCalendarProps?.events ?? null) as EventInput[] | null
    expect(secondEventsRef).toBe(firstEventsRef)
  })
})
