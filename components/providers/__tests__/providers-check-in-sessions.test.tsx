// @vitest-environment jsdom

import React from "react"
import "@testing-library/jest-dom"
import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: () => [],
}))

vi.mock("@/components/scene", () => ({
  default: () => null,
}))

vi.mock("@/components/persistent-navbar", () => ({
  PersistentNavbar: () => null,
}))

vi.mock("@/components/require-user-name", () => ({
  RequireUserName: () => null,
}))

vi.mock("@/components/demo", () => ({
  DemoProvider: ({ children }: { children: React.ReactNode }) => children,
  DemoOverlay: () => null,
}))

vi.mock("@/components/guidance", () => ({
  GuidanceProvider: ({ children }: { children: React.ReactNode }) => children,
  GuidancePopup: () => null,
}))

vi.mock("@/components/route-transition-overlay", () => ({
  RouteTransitionOverlay: () => null,
}))

vi.mock("@/components/color-sync", () => ({
  ColorSync: () => null,
}))

vi.mock("@/components/perf/jank-logger", () => ({
  JankLogger: () => null,
}))

vi.mock("../icon-provider", () => ({
  IconProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("../data-preloader", () => ({
  DataPreloader: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@/lib/utils", () => ({
  applySafariViewTransitionFix: () => {},
}))

vi.mock("@/lib/scene-context", () => ({
  SceneProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@/lib/navbar-context", () => ({
  NavbarProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@/lib/timezone-context", () => ({
  TimeZoneProvider: ({ children }: { children: React.ReactNode }) => children,
}))

describe("Providers", () => {
  it("wraps children with CheckInSessionsProvider so useHistory does not throw", async () => {
    vi.resetModules()
    const { Providers } = await import("../index")
    const { useHistory } = await import("@/hooks/use-history")

    function Child() {
      const { items, isLoading } = useHistory()
      return (
        <div>
          <div data-testid="loading">{String(isLoading)}</div>
          <div data-testid="count">{items.length}</div>
        </div>
      )
    }

    render(
      <Providers>
        <Child />
      </Providers>
    )

    expect(screen.getByTestId("loading")).toHaveTextContent("false")
    expect(screen.getByTestId("count")).toHaveTextContent("0")
  })
})
