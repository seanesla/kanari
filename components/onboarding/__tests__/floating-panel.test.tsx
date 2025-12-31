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
    pointerEvents,
  }: {
    children: React.ReactNode
    transform?: boolean
    center?: boolean
    pointerEvents?: string
  }) => (
    <div
      data-testid="html"
      data-transform={String(Boolean(transform))}
      data-center={String(Boolean(center))}
      data-pointer-events={pointerEvents ?? ""}
    >
      {children}
    </div>
  ),
  Float: ({
    children,
    speed,
  }: {
    children: React.ReactNode
    speed?: number
  }) => (
    <div data-testid="float" data-speed={speed === undefined ? "" : String(speed)}>
      {children}
    </div>
  ),
  useContextBridge: () => ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe("FloatingPanel", () => {
  it("freezes the float motion while focused within", () => {
    const { getByLabelText, getByTestId } = render(
      <FloatingPanel position={[0, 0, 0]} isActive>
        <input aria-label="api-key" />
      </FloatingPanel>
    )

    expect(getByTestId("float").dataset.speed).toBe("0.6")

    fireEvent.focusIn(getByLabelText("api-key"))

    expect(getByTestId("float").dataset.speed).toBe("0")
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
    expect(html.dataset.pointerEvents).toBe("none")
  })

  it("avoids a no-op transform on the active panel wrapper", () => {
    const { getByText } = render(
      <FloatingPanel position={[0, 0, 0]} isActive>
        <div>Content</div>
      </FloatingPanel>
    )

    const inner = getByText("Content")
    expect(inner.parentElement?.style.transform).toBe("none")
  })

  it("scales the inactive panel wrapper", () => {
    const { getByText } = render(
      <FloatingPanel position={[0, 0, 0]} isActive={false}>
        <div>Content</div>
      </FloatingPanel>
    )

    const inner = getByText("Content")
    expect(inner.parentElement?.style.transform).toBe("scale(0.95)")
  })
})
