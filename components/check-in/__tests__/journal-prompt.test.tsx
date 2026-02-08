/**
 * JournalPrompt Component Tests
 *
 * Ensures the journal widget clearly communicates persistence state so users
 * know whether writing is actually saved before leaving the prompt.
 *
 * @vitest-environment jsdom
 */

import React from "react"
import "@testing-library/jest-dom"
import { describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { JournalPrompt } from "@/components/check-in/widgets/journal-prompt"
import type { JournalPromptWidgetState } from "@/lib/types"

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
          layout?: unknown
        }

        return ({ children, ...props }: React.HTMLAttributes<HTMLElement> & MotionOnlyProps) => {
          const {
            initial: _initial,
            animate: _animate,
            exit: _exit,
            transition: _transition,
            layout: _layout,
            ...domProps
          } = props

          return <div {...domProps}>{children}</div>
        }
      },
    }
  ),
}))

function createWidget(status: JournalPromptWidgetState["status"]): JournalPromptWidgetState {
  return {
    id: "journal-widget-1",
    type: "journal_prompt",
    createdAt: new Date().toISOString(),
    status,
    args: {
      prompt: "What felt heavy today?",
      placeholder: "Write a few sentences...",
      category: "reflection",
    },
  }
}

describe("JournalPrompt", () => {
  it("shows a saved confirmation in collapsed inline mode", () => {
    render(
      <JournalPrompt
        widget={createWidget("saved")}
        onDismiss={vi.fn()}
      />
    )

    expect(screen.getByText(/saved to your journal/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /done/i })).toBeInTheDocument()
  })

  it("reminds users that text is a draft until Save", () => {
    render(
      <JournalPrompt
        widget={createWidget("draft")}
        variant="focus"
        initialContent="I need to slow down."
        onBack={vi.fn()}
        onDismiss={vi.fn()}
      />
    )

    expect(
      screen.getByText(/draft is only saved when you tap save/i)
    ).toBeInTheDocument()
  })

  it("auto-returns to chat once the widget transitions to saved in focus mode", async () => {
    const onBack = vi.fn()

    const { rerender } = render(
      <JournalPrompt
        widget={createWidget("draft")}
        variant="focus"
        initialContent="Initial draft"
        onBack={onBack}
      />
    )

    rerender(
      <JournalPrompt
        widget={createWidget("saved")}
        variant="focus"
        initialContent="Initial draft"
        onBack={onBack}
      />
    )

    await waitFor(() => {
      expect(onBack).toHaveBeenCalledTimes(1)
    })
  })
})
