// @vitest-environment jsdom

import React from "react"
import "@testing-library/jest-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

const {
  guidanceState,
  nextMock,
  prevMock,
  skipMock,
  exitGuideMock,
  startGuideMock,
} = vi.hoisted(() => {
  const next = vi.fn()
  const prev = vi.fn()
  const skip = vi.fn()
  const exitGuide = vi.fn()
  const startGuide = vi.fn()

  return {
    nextMock: next,
    prevMock: prev,
    skipMock: skip,
    exitGuideMock: exitGuide,
    startGuideMock: startGuide,
    guidanceState: {
      activeGuide: "first-time" as const,
      currentStep: {
        id: "ft-welcome",
        title: "Welcome to Kanari",
        message: "Welcome message",
      },
      currentStepIndex: 0,
      totalSteps: 4,
      next,
      prev,
      skip,
      exitGuide,
      canAdvance: true,
      skippedStepIds: [] as string[],
      startGuide,
    },
  }
})

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
        }

        return ({ children, ...props }: React.HTMLAttributes<HTMLElement> & MotionOnlyProps) => {
          const {
            initial: _initial,
            animate: _animate,
            exit: _exit,
            transition: _transition,
            ...domProps
          } = props

          return <div {...domProps}>{children}</div>
        }
      },
    }
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/lib/scene-context", () => ({
  useSceneMode: () => ({ accentColor: "#22c55e" }),
}))

vi.mock("@/hooks/use-demo-position", () => ({
  useDemoPosition: () => ({
    targetRect: null,
    isScrolling: false,
    viewport: { width: 1280, height: 720 },
    safeAreas: { top: 0, bottom: 0 },
  }),
}))

vi.mock("../guidance-provider", () => ({
  useGuidance: () => guidanceState,
}))

describe("GuidancePopup exit confirmation", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    nextMock.mockReset()
    prevMock.mockReset()
    skipMock.mockReset()
    exitGuideMock.mockReset()
    startGuideMock.mockReset()

    guidanceState.activeGuide = "first-time"
    guidanceState.currentStep = {
      id: "ft-welcome",
      title: "Welcome to Kanari",
      message: "Welcome message",
    }
    guidanceState.currentStepIndex = 0
    guidanceState.totalSteps = 4
    guidanceState.canAdvance = true
    guidanceState.skippedStepIds = []
  })

  it("asks for confirmation before exiting", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false)
    const { GuidancePopup } = await import("../guidance-popup")

    render(<GuidancePopup />)
    fireEvent.click(screen.getByRole("button", { name: /exit walkthrough/i }))

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(exitGuideMock).not.toHaveBeenCalled()
  })

  it("exits walkthrough when confirmed", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true)
    const { GuidancePopup } = await import("../guidance-popup")

    render(<GuidancePopup />)
    fireEvent.click(screen.getByRole("button", { name: /exit walkthrough/i }))

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(exitGuideMock).toHaveBeenCalledTimes(1)
  })
})
