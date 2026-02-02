/**
 * @vitest-environment jsdom
 */

import React from "react"
import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { CelebrationToast } from "../achievement-toast"
import type { MilestoneBadge } from "@/lib/achievements"

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
      type MotionOnlyProps = {
        whileHover?: unknown
        whileTap?: unknown
        initial?: unknown
        animate?: unknown
        exit?: unknown
        transition?: unknown
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { whileHover, whileTap, initial, animate, exit, transition, ...domProps } =
        props as React.HTMLAttributes<HTMLDivElement> & MotionOnlyProps
      return (
        <div className={className} {...domProps}>
          {children}
        </div>
      )
    },
    h2: ({ children, className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
      <h2 className={className} {...props}>
        {children}
      </h2>
    ),
    p: ({ children, className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
      <p className={className} {...props}>
        {children}
      </p>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const milestone: MilestoneBadge = {
  id: "m1",
  type: "7day",
  title: "7-day streak",
  description: "You completed your daily achievements for 7 days in a row.",
  earnedAt: "2026-02-01T00:00:00.000Z",
  streakDays: 7,
  seen: false,
}

describe("CelebrationToast", () => {
  it("dismisses when clicking the Awesome button", () => {
    const onOpenChange = vi.fn()
    const onDismiss = vi.fn()

    render(
      <CelebrationToast
        item={{ kind: "milestone", milestone }}
        open={true}
        onOpenChange={onOpenChange}
        onDismiss={onDismiss}
        autoDismissMs={0}
      />
    )

    const glow = screen.getByTestId("celebration-toast-glow")
    expect(glow.getAttribute("class")).toEqual(expect.stringContaining("pointer-events-none"))

    const awesomeButton = screen.getByRole("button", { name: "Awesome!" })
    expect(awesomeButton.getAttribute("class")).toEqual(expect.stringContaining("hover:bg-accent/10"))

    fireEvent.click(awesomeButton)

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it("dismisses when clicking outside the toast card", () => {
    const onOpenChange = vi.fn()
    const onDismiss = vi.fn()

    render(
      <CelebrationToast
        item={{ kind: "milestone", milestone }}
        open={true}
        onOpenChange={onOpenChange}
        onDismiss={onDismiss}
        autoDismissMs={0}
      />
    )

    fireEvent.click(screen.getByTestId("celebration-toast-overlay"))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
