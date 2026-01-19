// @vitest-environment jsdom

import React from "react"
import { describe, expect, it, vi } from "vitest"
import { fireEvent, render } from "@testing-library/react"
import { FloatingPanel } from "../floating-panel"

vi.mock("@react-three/drei", () => ({
  Html: ({
    children,
    transform,
    center,
    distanceFactor,
    pointerEvents,
  }: {
    children: React.ReactNode
    transform?: boolean
    center?: boolean
    distanceFactor?: number
    pointerEvents?: string
  }) => (
    <div
      data-testid="html"
      data-transform={String(Boolean(transform))}
      data-center={String(Boolean(center))}
      data-distance-factor={distanceFactor === undefined ? "" : String(distanceFactor)}
      data-pointer-events={pointerEvents ?? ""}
    >
      {children}
    </div>
  ),
  Float: ({
    children,
    speed,
    position,
  }: {
    children: React.ReactNode
    speed?: number
    position?: [number, number, number]
  }) => (
    <div
      data-testid="float"
      data-speed={speed === undefined ? "" : String(speed)}
      data-position={position ? position.join(",") : ""}
    >
      {children}
    </div>
  ),
  useContextBridge: () => ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe("FloatingPanel", () => {
  it("anchors Float at the panel position (avoids orbiting around the origin)", () => {
    const { getByTestId } = render(
      <FloatingPanel position={[1, 2, 3]} isActive>
        <div>Content</div>
      </FloatingPanel>
    )

    expect(getByTestId("float").dataset.position).toBe("1,2,3")
  })

  it("uses a responsive wrapper width for small screens", () => {
    const { getByTestId } = render(
      <FloatingPanel position={[0, 0, 0]} isActive>
        <div>Content</div>
      </FloatingPanel>
    )

    const wrapper = getByTestId("panel-wrapper")
    expect(wrapper.className).toContain("w-[min(480px,calc(100vw-2rem))]")
  })

  it("does not stop float motion on focus", () => {
    const { getByLabelText, getByTestId } = render(
      <FloatingPanel position={[0, 0, 0]} isActive>
        <input aria-label="api-key" />
      </FloatingPanel>
    )

    expect(getByTestId("float").dataset.speed).toBe("1.05")

    fireEvent.focusIn(getByLabelText("api-key"))

    // We keep motion running to avoid snapping/jumping.
    expect(getByTestId("float").dataset.speed).toBe("1.05")
  })

  it("renders the active panel without CSS3D transforms", () => {
    const { getByTestId } = render(
      <FloatingPanel position={[0, 0, 0]} isActive>
        <div>Content</div>
      </FloatingPanel>
    )

    const html = getByTestId("html")
    expect(html.dataset.transform).toBe("false")
    expect(html.dataset.center).toBe("true")
    expect(html.dataset.distanceFactor).toBe("3.25")
    expect(html.dataset.pointerEvents).toBe("auto")
  })

  it("renders inactive panels with CSS3D transforms disabled for interaction", () => {
    const { getByTestId } = render(
      <FloatingPanel position={[0, 0, 0]} isActive={false}>
        <div>Content</div>
      </FloatingPanel>
    )

    const html = getByTestId("html")
    expect(html.dataset.transform).toBe("true")
    expect(html.dataset.center).toBe("true")
    expect(html.dataset.distanceFactor).toBe("1.15")
    expect(html.dataset.pointerEvents).toBe("none")
  })

  it("avoids a no-op transform on the active panel wrapper", () => {
    const { getByTestId } = render(
      <FloatingPanel position={[0, 0, 0]} isActive>
        <div>Content</div>
      </FloatingPanel>
    )

    const wrapper = getByTestId("panel-wrapper")
    expect(wrapper.style.transform).toBe("none")
  })

  it("scales the inactive panel wrapper", () => {
    const { getByTestId } = render(
      <FloatingPanel position={[0, 0, 0]} isActive={false}>
        <div>Content</div>
      </FloatingPanel>
    )

    const wrapper = getByTestId("panel-wrapper")
    expect(wrapper.style.transform).toBe("scale(0.95)")
  })
})
