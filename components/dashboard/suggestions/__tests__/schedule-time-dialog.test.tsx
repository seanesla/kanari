/**
 * @vitest-environment jsdom
 */

import "temporal-polyfill/global"

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { Suggestion } from "@/lib/types"

const createDatePickerMock = vi.fn((_config?: unknown) => ({
  render: vi.fn(),
  destroy: vi.fn(),
}))

vi.mock("@schedule-x/date-picker", () => ({
  createDatePicker: (config: unknown) => createDatePickerMock(config),
}))

vi.mock("@/lib/timezone-context", () => ({
  useTimeZone: () => ({
    timeZone: "UTC",
    setTimeZone: vi.fn(),
    availableTimeZones: ["UTC"],
    isLoading: false,
  }),
}))

describe("ScheduleTimeDialog", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-16T10:30:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it("initializes date/time when opened programmatically (enables Schedule button)", async () => {
    const { ScheduleTimeDialog } = await import("../schedule-time-dialog")

    const suggestion: Suggestion = {
      id: "s1",
      content: "Take a short walk outside.",
      rationale: "rationale",
      duration: 15,
      category: "break",
      status: "pending",
      createdAt: "2026-01-16T00:00:00.000Z",
    }

    const onSchedule = vi.fn()

    render(
      <ScheduleTimeDialog
        suggestion={suggestion}
        open={true}
        onOpenChange={vi.fn()}
        onSchedule={onSchedule}
      />
    )

    const scheduleButton = screen.getByRole("button", { name: "Schedule" })
    expect(scheduleButton).toBeEnabled()

    fireEvent.click(scheduleButton)

    expect(onSchedule).toHaveBeenCalledTimes(1)
    expect(onSchedule.mock.calls[0]?.[0]).toMatchObject({ id: "s1" })
    expect(onSchedule.mock.calls[0]?.[1]).toBe("2026-01-16T11:00:00Z")
  })

  it("prefills date/time from calendar defaults", async () => {
    const { ScheduleTimeDialog } = await import("../schedule-time-dialog")

    const suggestion: Suggestion = {
      id: "s2",
      content: "Do a quick stretch routine.",
      rationale: "rationale",
      duration: 10,
      category: "exercise",
      status: "pending",
      createdAt: "2026-01-16T00:00:00.000Z",
    }

    const onSchedule = vi.fn()

    render(
      <ScheduleTimeDialog
        suggestion={suggestion}
        open={true}
        onOpenChange={vi.fn()}
        onSchedule={onSchedule}
        defaultDateISO="2026-01-20"
        defaultHour={14}
        defaultMinute={15}
      />
    )

    const scheduleButton = screen.getByRole("button", { name: "Schedule" })
    expect(scheduleButton).toBeEnabled()

    fireEvent.click(scheduleButton)

    expect(onSchedule).toHaveBeenCalledTimes(1)
    expect(onSchedule.mock.calls[0]?.[0]).toMatchObject({ id: "s2" })
    expect(onSchedule.mock.calls[0]?.[1]).toBe("2026-01-20T14:15:00Z")
  })

  it("passes recurring scope when rescheduling a series occurrence", async () => {
    const { ScheduleTimeDialog } = await import("../schedule-time-dialog")

    const suggestion: Suggestion = {
      id: "s-series-2",
      content: "Evening wind-down",
      rationale: "rationale",
      duration: 20,
      category: "mindfulness",
      status: "scheduled",
      createdAt: "2026-01-16T00:00:00.000Z",
      scheduledFor: "2026-01-20T20:00:00Z",
      seriesId: "series-1",
      occurrenceDate: "2026-01-20",
      occurrenceIndex: 1,
    }

    const allSuggestions: Suggestion[] = [
      {
        ...suggestion,
        id: "s-series-1",
        occurrenceDate: "2026-01-19",
        occurrenceIndex: 0,
        scheduledFor: "2026-01-19T20:00:00Z",
      },
      suggestion,
      {
        ...suggestion,
        id: "s-series-3",
        occurrenceDate: "2026-01-21",
        occurrenceIndex: 2,
        scheduledFor: "2026-01-21T20:00:00Z",
      },
    ]

    const onSchedule = vi.fn()

    render(
      <ScheduleTimeDialog
        suggestion={suggestion}
        open={true}
        onOpenChange={vi.fn()}
        onSchedule={onSchedule}
        allSuggestions={allSuggestions}
      />
    )

    fireEvent.click(screen.getByText("Entire series"))
    fireEvent.click(screen.getByRole("button", { name: "Reschedule" }))

    expect(onSchedule).toHaveBeenCalledTimes(1)
    expect(onSchedule.mock.calls[0]?.[2]).toBe("all")
  })
})
