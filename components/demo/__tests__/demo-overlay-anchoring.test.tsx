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
    const rect = new DOMRect(32, 48, 200, 120)

    render(
      <DemoTooltip
        targetRect={rect}
        safeAreas={{ top: 0, bottom: 0 }}
        viewport={{ width: 1200, height: 900 }}
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
    const rect = new DOMRect(32, 48, 200, 120)

    render(<DemoSpotlight rect={rect} isScrolling={false} />)

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
