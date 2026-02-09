/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { ScheduleActivityWidgetState } from "@/lib/types"

vi.mock("@/lib/timezone-context", () => ({
  useTimeZone: () => ({
    timeZone: "UTC",
    setTimeZone: vi.fn(),
    availableTimeZones: ["UTC"],
    isLoading: false,
  }),
}))

describe("ScheduleConfirmation", () => {
  it("shows start and end times instead of duration minutes", async () => {
    const { ScheduleConfirmation } = await import("../schedule-confirmation")

    const widget: ScheduleActivityWidgetState = {
      id: "widget-1",
      type: "schedule_activity",
      createdAt: "2026-02-09T00:00:00.000Z",
      args: {
        title: "Deep work block",
        category: "rest",
        date: "2026-02-09",
        time: "08:00",
        duration: 120,
      },
      status: "scheduled",
      suggestionId: "s1",
    }

    render(<ScheduleConfirmation widget={widget} />)

    expect(screen.getByText(/8:00 AM to 10:00 AM/i)).toBeInTheDocument()
    expect(screen.queryByText(/120m/i)).not.toBeInTheDocument()
  })
})
