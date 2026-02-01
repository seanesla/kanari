// @vitest-environment jsdom

import React from "react"
import "@testing-library/jest-dom"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"

import { RouteTransitionProvider, useRouteTransition } from "@/lib/route-transition-context"

let currentPath = "/"

vi.mock("next/navigation", () => ({
  usePathname: () => currentPath,
}))

function Harness() {
  const { visible, begin } = useRouteTransition()
  return (
    <div>
      <div data-testid="visible">{String(visible)}</div>
      <button type="button" onClick={() => begin("/overview")}>
        begin
      </button>
    </div>
  )
}

describe("RouteTransitionProvider", () => {
  beforeEach(() => {
    currentPath = "/"
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it("hides the overlay shortly after the route arrives (no multi-second linger)", () => {
    const { rerender } = render(
      <RouteTransitionProvider>
        <Harness />
      </RouteTransitionProvider>
    )

    expect(screen.getByTestId("visible")).toHaveTextContent("false")

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "begin" }))
    })
    expect(screen.getByTestId("visible")).toHaveTextContent("true")

    // Simulate navigation completion.
    currentPath = "/overview"
    rerender(
      <RouteTransitionProvider>
        <Harness />
      </RouteTransitionProvider>
    )

    act(() => {
      vi.advanceTimersByTime(2500)
    })

    expect(screen.getByTestId("visible")).toHaveTextContent("false")
  })
})
