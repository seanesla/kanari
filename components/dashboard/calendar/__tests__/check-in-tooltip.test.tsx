// @vitest-environment jsdom

import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import type { CheckInSession } from "@/lib/types"

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

vi.mock("@/lib/timezone-context", () => ({
  useTimeZone: () => ({ timeZone: "UTC" }),
}))

describe("CheckInTooltip", () => {
  it("does not flash from the top-left corner before positioning completes", async () => {
    const { CheckInTooltip } = await import("../check-in-tooltip")

    const session: CheckInSession = {
      id: "c1",
      startedAt: "2026-01-11T09:00:00Z",
      messages: [],
      duration: 1200,
    }

    render(
      <CheckInTooltip
        session={session}
        open
        onOpenChange={vi.fn()}
        anchorPosition={{ x: 120, y: 240 }}
      />
    )

    const tooltip = screen.getByRole("dialog", { hidden: true })

    // If the tooltip renders before Floating UI has computed its position, it will start at (0,0)
    // and then jump/slide into place. It should remain hidden until positioned.
    expect(tooltip).not.toBeVisible()

    await waitFor(() => {
      expect(tooltip).toBeVisible()
    })

    // Regression: ensure the enter animation does not override the positioning `transform`.
    // The animation (which writes `transform`) must live on an inner wrapper, not the positioned node.
    expect(tooltip.className).not.toContain("animate-in")
    expect(tooltip.querySelector(".animate-in")).not.toBeNull()
  })
})
