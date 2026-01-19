/**
 * @vitest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { DemoTooltip } from "../demo-tooltip"
import { DemoSpotlight } from "../demo-spotlight"

vi.mock("@/lib/scene-context", () => ({
  useSceneMode: () => ({ accentColor: "#00FFB2" }),
}))

class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

describe("Demo overlay anchoring", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "ResizeObserver", {
      value: MockResizeObserver,
      configurable: true,
      writable: true,
    })
    document.body.innerHTML = ""
  })

  it("anchors DemoTooltip at viewport origin for x/y positioning", () => {
    const target = document.createElement("div")
    target.setAttribute("data-demo-id", "demo-target")
    document.body.appendChild(target)

    render(
      <DemoTooltip
        targetId="demo-target"
        title="Title"
        content="Content"
        isVisible
      />
    )

    const tooltip = screen.getByTestId("demo-tooltip")
    expect(tooltip.className).toContain("left-0")
    expect(tooltip.className).toContain("top-0")
  })

  it("anchors DemoSpotlight layers at viewport origin for x/y positioning", async () => {
    const target = document.createElement("div")
    target.setAttribute("data-demo-id", "demo-target")
    document.body.appendChild(target)

    render(<DemoSpotlight targetId="demo-target" />)

    await waitFor(() => {
      expect(screen.getByTestId("demo-spotlight-glow")).toBeInTheDocument()
      expect(screen.getByTestId("demo-spotlight-pulse")).toBeInTheDocument()
    })

    expect(screen.getByTestId("demo-spotlight-glow").className).toContain("left-0")
    expect(screen.getByTestId("demo-spotlight-glow").className).toContain("top-0")
    expect(screen.getByTestId("demo-spotlight-pulse").className).toContain("left-0")
    expect(screen.getByTestId("demo-spotlight-pulse").className).toContain("top-0")
  })
})

