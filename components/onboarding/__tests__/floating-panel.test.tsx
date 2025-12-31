// @vitest-environment jsdom

import React from "react"
import { describe, expect, it, vi } from "vitest"
import { render } from "@testing-library/react"
import { FloatingPanel } from "../floating-panel"

vi.mock("@react-three/drei", () => ({
  Html: ({ children }: { children: React.ReactNode }) => <div data-testid="html">{children}</div>,
  Float: ({ children }: { children: React.ReactNode }) => <div data-testid="float">{children}</div>,
  useContextBridge: () => ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

describe("FloatingPanel", () => {
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
