// @vitest-environment jsdom

import React from "react"
import "@testing-library/jest-dom"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

const { beginMock, pushMock, pathnameMock, isDemoWorkspaceMock } = vi.hoisted(() => ({
  beginMock: vi.fn(),
  pushMock: vi.fn(),
  pathnameMock: vi.fn(() => "/overview"),
  isDemoWorkspaceMock: vi.fn(() => false),
}))

vi.mock("next/link", () => ({
  default: ({ href, onClick, children, prefetch: _prefetch, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean }) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  usePathname: () => pathnameMock(),
}))

vi.mock("@/lib/route-transition-context", () => ({
  useRouteTransition: () => ({
    begin: beginMock,
  }),
}))

vi.mock("@/lib/workspace", () => ({
  isDemoWorkspace: isDemoWorkspaceMock,
}))

describe("TransitionLink demo exit warning", () => {
  beforeEach(() => {
    beginMock.mockReset()
    pushMock.mockReset()
    pathnameMock.mockReset()
    isDemoWorkspaceMock.mockReset()

    pathnameMock.mockReturnValue("/overview")
    isDemoWorkspaceMock.mockReturnValue(false)
  })

  it("warns before leaving demo mode for landing", async () => {
    isDemoWorkspaceMock.mockReturnValue(true)
    const { TransitionLink } = await import("../transition-link")

    render(<TransitionLink href="/">Go Home</TransitionLink>)
    fireEvent.click(screen.getByRole("link", { name: "Go Home" }))

    expect(beginMock).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
  })

  it("keeps user on page when demo-exit warning is cancelled", async () => {
    isDemoWorkspaceMock.mockReturnValue(true)
    const { TransitionLink } = await import("../transition-link")

    render(<TransitionLink href="/">Go Home</TransitionLink>)
    fireEvent.click(screen.getByRole("link", { name: "Go Home" }))
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }))

    expect(beginMock).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it("navigates to landing after confirming demo-exit warning", async () => {
    isDemoWorkspaceMock.mockReturnValue(true)
    const { TransitionLink } = await import("../transition-link")

    render(<TransitionLink href="/">Go Home</TransitionLink>)
    fireEvent.click(screen.getByRole("link", { name: "Go Home" }))
    fireEvent.click(screen.getByRole("button", { name: /continue to landing/i }))

    expect(beginMock).toHaveBeenCalledWith("/")
    expect(pushMock).toHaveBeenCalledWith("/")
  })

  it("also warns for landing hash links in demo mode", async () => {
    isDemoWorkspaceMock.mockReturnValue(true)
    const { TransitionLink } = await import("../transition-link")

    render(<TransitionLink href="/#problem">Go To Landing Section</TransitionLink>)
    fireEvent.click(screen.getByRole("link", { name: "Go To Landing Section" }))

    expect(beginMock).not.toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /continue to landing/i }))
    expect(beginMock).toHaveBeenCalledWith("/#problem")
    expect(pushMock).toHaveBeenCalledWith("/#problem")
  })

  it("keeps existing behavior when not in demo mode", async () => {
    isDemoWorkspaceMock.mockReturnValue(false)
    const { TransitionLink } = await import("../transition-link")

    render(<TransitionLink href="/">Go Home</TransitionLink>)
    fireEvent.click(screen.getByRole("link", { name: "Go Home" }))

    expect(beginMock).toHaveBeenCalledWith("/")
    expect(pushMock).not.toHaveBeenCalled()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })
})
