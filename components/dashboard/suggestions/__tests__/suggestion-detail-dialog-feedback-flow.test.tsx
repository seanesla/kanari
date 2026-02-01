// @vitest-environment jsdom

import React, { useState } from "react"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import { describe, expect, it, vi } from "vitest"
import { SuggestionDetailDialog } from "../suggestion-detail-dialog"
import type { Suggestion, EffectivenessFeedback } from "@/lib/types"

// Mock framer-motion to avoid animation issues in tests (matches existing dialog tests)
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
    id: "suggestion-1",
    content: "Take a 10 minute walk outside",
    rationale: "A short walk can reduce stress and reset attention.",
    duration: 10,
    category: "break",
    status: "scheduled",
    createdAt: now,
    scheduledFor: now,
  }
}

describe("SuggestionDetailDialog feedback flow", () => {
  it("shows effectiveness feedback immediately after Mark Complete (even if parent clears selected suggestion)", async () => {
    const onCompleteWithFeedback = vi.fn<
      (suggestion: Suggestion, feedback: EffectivenessFeedback) => void
    >()

    function Harness() {
      const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(
        createScheduledSuggestion()
      )

      return (
        <SuggestionDetailDialog
          suggestion={selectedSuggestion}
          open={!!selectedSuggestion}
          onOpenChange={(open) => {
            if (!open) setSelectedSuggestion(null)
          }}
          onCompleteWithFeedback={onCompleteWithFeedback}
        />
      )
    }

    render(<Harness />)

    fireEvent.click(screen.getByRole("button", { name: /mark complete/i }))

    expect(onCompleteWithFeedback).not.toHaveBeenCalled()

    // Feedback dialog should appear immediately on first click.
    expect(await screen.findByText("Nice work!")).toBeInTheDocument()

    fireEvent.click(screen.getByText("Very Helpful"))
    await waitFor(
      () => {
        expect(onCompleteWithFeedback).toHaveBeenCalledTimes(1)
      },
      { timeout: 1500 }
    )

    expect(onCompleteWithFeedback.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ id: "suggestion-1" })
    )
    expect(onCompleteWithFeedback.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        rating: "very_helpful",
        ratedAt: expect.any(String),
      })
    )
  })
})
