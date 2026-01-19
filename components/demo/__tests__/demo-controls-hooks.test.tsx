/**
 * @vitest-environment jsdom
 */

import { render } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import { DemoControls } from "../demo-controls"

vi.mock("@/lib/scene-context", () => ({
  useSceneMode: () => ({ accentColor: "#00FFB2" }),
}))

type DemoState = {
  isActive: boolean
  currentStepIndex: number
  totalSteps: number
  isNavigating: boolean
  isTransitioning: boolean
  nextStep: () => void
  previousStep: () => void
  stopDemo: () => void
}

let demoState: DemoState

vi.mock("../demo-provider", () => ({
  useDemo: () => demoState,
}))

describe("DemoControls hook ordering", () => {
  beforeEach(() => {
    demoState = {
      isActive: true,
      currentStepIndex: 0,
      totalSteps: 3,
      isNavigating: false,
      isTransitioning: false,
      nextStep: vi.fn(),
      previousStep: vi.fn(),
      stopDemo: vi.fn(),
    }

    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it("does not throw when demo becomes inactive", () => {
    const { rerender } = render(<DemoControls />)

    demoState = { ...demoState, isActive: false }

    expect(() => rerender(<DemoControls />)).not.toThrow()
  })

  it("does not throw when demo becomes complete", () => {
    const { rerender } = render(<DemoControls />)

    demoState = { ...demoState, currentStepIndex: 3 }

    expect(() => rerender(<DemoControls />)).not.toThrow()
  })
})
