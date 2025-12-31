// @vitest-environment jsdom

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, waitFor, cleanup } from "@testing-library/react"
import { FloatingPanel } from "../floating-panel"

let htmlProps: Record<string, unknown> | null = null

vi.mock("@react-three/drei", async () => {
  const React = await import("react")
  return {
    Html: ({ children, ...props }: { children: React.ReactNode }) => {
      htmlProps = props
      return React.createElement("div", { "data-testid": "html" }, children)
    },
    Float: ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "float" }, children),
    useContextBridge: () => ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  }
})

const originalNavigator = {
  userAgent: navigator.userAgent,
  platform: navigator.platform,
  maxTouchPoints: navigator.maxTouchPoints,
}

const setNavigator = (values: { userAgent: string; platform: string; maxTouchPoints: number }) => {
  Object.defineProperty(window.navigator, "userAgent", {
    value: values.userAgent,
    configurable: true,
  })
  Object.defineProperty(window.navigator, "platform", {
    value: values.platform,
    configurable: true,
  })
  Object.defineProperty(window.navigator, "maxTouchPoints", {
    value: values.maxTouchPoints,
    configurable: true,
  })
}

beforeEach(() => {
  htmlProps = null
})

afterEach(() => {
  cleanup()
})

afterAll(() => {
  setNavigator({
    userAgent: originalNavigator.userAgent,
    platform: originalNavigator.platform,
    maxTouchPoints: originalNavigator.maxTouchPoints,
  })
})

describe("FloatingPanel", () => {
  it("disables Html transform on iOS user agents", async () => {
    setNavigator({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      platform: "iPhone",
      maxTouchPoints: 0,
    })

    render(
      <FloatingPanel position={[0, 0, 0]} isActive>
        <div>Content</div>
      </FloatingPanel>
    )

    await waitFor(() => {
      expect(htmlProps?.transform).toBe(false)
    })
  })

  it("keeps Html transform on non-iOS user agents", async () => {
    setNavigator({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      platform: "Win32",
      maxTouchPoints: 0,
    })

    render(
      <FloatingPanel position={[0, 0, 0]} isActive>
        <div>Content</div>
      </FloatingPanel>
    )

    await waitFor(() => {
      expect(htmlProps?.transform).toBe(true)
    })
  })
})
