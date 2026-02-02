/**
 * @vitest-environment jsdom
 */

import React from "react"
import { describe, expect, it, vi } from "vitest"
import { render, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { AnimatedLogo } from "../animated-logo"

const { startMock } = vi.hoisted(() => ({
  startMock: vi.fn(() => Promise.resolve()),
}))

vi.mock("framer-motion", () => ({
  motion: {
    path: ({ children, ...props }: React.SVGProps<SVGPathElement>) => {
      type MotionOnlyProps = {
        initial?: unknown
        animate?: unknown
        variants?: unknown
        transition?: unknown
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { initial, animate, variants, transition, ...domProps } = props as React.SVGProps<SVGPathElement> &
        MotionOnlyProps
      return <path {...domProps}>{children}</path>
    },
  },
  useAnimation: () => ({ start: startMock }),
}))

describe("AnimatedLogo", () => {
  it("does not restart the animation when onComplete identity changes", async () => {
    const onCompleteA = vi.fn()
    const onCompleteB = vi.fn()

    const { rerender } = render(<AnimatedLogo onComplete={onCompleteA} />)

    await waitFor(() => expect(startMock).toHaveBeenCalledTimes(3))
    await waitFor(() => expect(onCompleteA).toHaveBeenCalledTimes(1))

    expect(startMock.mock.calls.map((call) => call[0])).toEqual(["drawing", "filling", "complete"])

    rerender(<AnimatedLogo onComplete={onCompleteB} />)

    // Allow effects to run; the animation sequence should not re-trigger.
    await Promise.resolve()

    expect(startMock).toHaveBeenCalledTimes(3)
    expect(onCompleteB).toHaveBeenCalledTimes(0)
  })
})

