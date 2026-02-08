// @vitest-environment jsdom

import React from "react"
import "@testing-library/jest-dom"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

const { isDemoWorkspaceMock, setWorkspaceMock, hardReloadMock } = vi.hoisted(() => ({
  isDemoWorkspaceMock: vi.fn(() => true),
  setWorkspaceMock: vi.fn(),
  hardReloadMock: vi.fn(),
}))

vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: () => {
        type MotionOnlyProps = {
          initial?: unknown
          animate?: unknown
          exit?: unknown
          transition?: unknown
          layoutId?: unknown
        }

        return ({ children, ...props }: React.HTMLAttributes<HTMLElement> & MotionOnlyProps) => {
          const {
            initial: _initial,
            animate: _animate,
            exit: _exit,
            transition: _transition,
            layoutId: _layoutId,
            ...domProps
          } = props

          return <div {...domProps}>{children}</div>
        }
      },
    }
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("next/navigation", () => ({
  usePathname: () => "/overview",
}))

vi.mock("@/lib/scene-context", () => ({
  useSceneMode: () => ({ isLoading: false }),
}))

vi.mock("@/lib/navbar-context", () => ({
  ONBOARDING_STEPS: [],
  useNavbar: () => ({
    navbarMode: "dashboard",
    activeDashboardRoute: "/overview",
    activeSection: null,
    onboardingStep: 0,
    setOnboardingStep: vi.fn(),
    highestStepReached: 0,
  }),
}))

vi.mock("@/components/liquid-glass-navbar", () => ({
  LiquidGlassNavbar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/logo", () => ({
  Logo: () => <span>logo</span>,
}))

vi.mock("@/components/transition-link", () => ({
  TransitionLink: ({ children, prefetch: _prefetch, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => (
    <a {...props}>{children}</a>
  ),
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock("@/lib/workspace", () => ({
  isDemoWorkspace: isDemoWorkspaceMock,
  setWorkspace: setWorkspaceMock,
}))

vi.mock("@/lib/navigation/hard-reload", () => ({
  hardReload: hardReloadMock,
}))

describe("PersistentNavbar demo exit warning", () => {
  beforeEach(() => {
    isDemoWorkspaceMock.mockReset()
    setWorkspaceMock.mockReset()
    hardReloadMock.mockReset()
    isDemoWorkspaceMock.mockReturnValue(true)

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it("shows a confirmation dialog before exiting demo mode", async () => {
    const { PersistentNavbar } = await import("../persistent-navbar")
    render(<PersistentNavbar />)

    const exitButtons = await screen.findAllByRole("button", { name: /^Exit$/i })
    fireEvent.click(exitButtons[0])

    expect(setWorkspaceMock).not.toHaveBeenCalled()
    expect(hardReloadMock).not.toHaveBeenCalled()
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
  })

  it("keeps demo mode when confirmation is cancelled", async () => {
    const { PersistentNavbar } = await import("../persistent-navbar")
    render(<PersistentNavbar />)

    const exitButtons = await screen.findAllByRole("button", { name: /^Exit$/i })
    fireEvent.click(exitButtons[0])
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }))

    expect(setWorkspaceMock).not.toHaveBeenCalled()
    expect(hardReloadMock).not.toHaveBeenCalled()
  })

  it("exits demo mode after confirmation", async () => {
    const { PersistentNavbar } = await import("../persistent-navbar")
    render(<PersistentNavbar />)

    const exitButtons = await screen.findAllByRole("button", { name: /^Exit$/i })
    fireEvent.click(exitButtons[0])
    fireEvent.click(screen.getByRole("button", { name: /exit demo/i }))

    expect(setWorkspaceMock).toHaveBeenCalledWith("real")
    expect(hardReloadMock).toHaveBeenCalledTimes(1)
  })
})
