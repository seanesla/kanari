/**
 * @vitest-environment jsdom
 */

import React from "react"
import { describe, expect, it, vi } from "vitest"
import { act, render } from "@testing-library/react"
import "@testing-library/jest-dom"
import { WelcomeParticles } from "../welcome-particles"

vi.mock("@react-three/fiber", () => ({
  useFrame: () => undefined,
}))

describe("WelcomeParticles", () => {
  it("does not reschedule completion when onComplete identity changes", () => {
    const originalError = console.error
    const errorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      const first = args[0]
      if (
        typeof first === "string" &&
        (first.includes("is using incorrect casing") ||
          first.includes("The tag <") ||
          first.includes("React does not recognize") ||
          first.includes("non-boolean attribute") ||
          first.includes("Not implemented: HTMLCanvasElement's getContext"))
      ) {
        return
      }
      originalError(...(args as Parameters<typeof console.error>))
    })

    const originalGetContext = HTMLCanvasElement.prototype.getContext
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () => null,
    })

    vi.useFakeTimers()

    const onCompleteA = vi.fn()
    const onCompleteB = vi.fn()

    // Matches TOTAL_DURATION_MS in `components/onboarding/welcome-particles.tsx`.
    const TOTAL_DURATION_MS = 4700

    const { rerender } = render(<WelcomeParticles accentColor="#ffffff" onComplete={onCompleteA} text="kanari" />)

    act(() => {
      vi.advanceTimersByTime(Math.floor(TOTAL_DURATION_MS / 2))
    })

    rerender(<WelcomeParticles accentColor="#ffffff" onComplete={onCompleteB} text="kanari" />)

    act(() => {
      vi.advanceTimersByTime(Math.ceil(TOTAL_DURATION_MS / 2) + 5)
    })

    expect(onCompleteA).toHaveBeenCalledTimes(0)
    expect(onCompleteB).toHaveBeenCalledTimes(1)

    vi.useRealTimers()

    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: originalGetContext,
    })
    errorSpy.mockRestore()
  })
})
