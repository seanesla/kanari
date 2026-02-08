// @vitest-environment jsdom

import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { describe, expect, it, vi } from "vitest"
import { SuggestionDetailDialog } from "../suggestion-detail-dialog"
import type { Suggestion } from "@/lib/types"

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
    button: ({ children, className, onClick, disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
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
        props as React.ButtonHTMLAttributes<HTMLButtonElement> & MotionOnlyProps
      return (
        <button className={className} onClick={onClick} disabled={disabled} {...domProps}>
          {children}
        </button>
      )
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

function createScheduledSuggestion(): Suggestion {
  const now = new Date().toISOString()
  return {
    id: "suggestion-cancel-guard",
    content: "Watch the Super Bowl",
    rationale: "Planned social time can help you recharge.",
    duration: 300,
    category: "social",
    status: "scheduled",
    createdAt: now,
    scheduledFor: now,
  }
}

describe("SuggestionDetailDialog cancel guard", () => {
  it("uses explicit cancel-event wording", () => {
    render(
      <SuggestionDetailDialog
        suggestion={createScheduledSuggestion()}
        open
        onOpenChange={vi.fn()}
        onDismiss={vi.fn()}
      />
    )

    expect(screen.getByRole("button", { name: "Cancel Event" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^cancel$/i })).not.toBeInTheDocument()
  })

  it("requires confirmation before cancelling a scheduled event", () => {
    const onDismiss = vi.fn()

    render(
      <SuggestionDetailDialog
        suggestion={createScheduledSuggestion()}
        open
        onOpenChange={vi.fn()}
        onDismiss={onDismiss}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Cancel Event" }))

    expect(onDismiss).not.toHaveBeenCalled()
    expect(screen.getByText("Cancel this event?")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Keep Event" }))
    expect(onDismiss).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Cancel Event" }))
    fireEvent.click(screen.getByRole("button", { name: "Yes, cancel event" }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
