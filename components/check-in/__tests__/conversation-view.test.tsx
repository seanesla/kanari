/**
 * ConversationView Component Tests
 *
 * Validates transcript rendering behavior, especially around live voice
 * transcription where a streaming user message should replace the separate
 * transcript preview bubble.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { ConversationView } from "../conversation-view"
import type { CheckInMessage } from "@/lib/types"

const originalScrollIntoView = Element.prototype.scrollIntoView

beforeEach(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  })
})

afterEach(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: originalScrollIntoView,
  })
})

describe("ConversationView", () => {
  it("shows transcript preview while user is speaking (no streaming user message)", () => {
    render(
      <ConversationView
        state="user_speaking"
        messages={[]}
        currentUserTranscript="Hello there"
      />
    )

    expect(screen.getByText("Hello there...")).toBeInTheDocument()
  })

  it("does not show transcript preview when a streaming user message exists", () => {
    const messages: CheckInMessage[] = [{
      id: "msg-1",
      role: "user",
      content: "Hello there",
      timestamp: new Date().toISOString(),
      isStreaming: true,
    }]

    render(
      <ConversationView
        state="user_speaking"
        messages={messages}
        currentUserTranscript="Hello there"
      />
    )

    expect(screen.queryByText("Hello there...")).not.toBeInTheDocument()
    expect(screen.getByText("Hello there")).toBeInTheDocument()
  })

  it("shows an AI-first empty state while waiting for the greeting", () => {
    render(<ConversationView state="ai_greeting" messages={[]} />)

    expect(screen.getByText(/kanari will greet you first/i)).toBeInTheDocument()
    expect(screen.getByText(/respond as soon as it starts speaking/i)).toBeInTheDocument()
  })

  it("does not auto-scroll when only state changes during quiet periods", () => {
    const messages: CheckInMessage[] = [{
      id: "msg-quiet",
      role: "assistant",
      content: "I heard you.",
      timestamp: new Date().toISOString(),
    }]

    const scrollSpy = vi.spyOn(Element.prototype, "scrollIntoView")

    const { rerender } = render(
      <ConversationView
        state="processing"
        messages={messages}
      />
    )

    scrollSpy.mockClear()

    rerender(
      <ConversationView
        state="assistant_speaking"
        messages={messages}
      />
    )

    expect(scrollSpy).not.toHaveBeenCalled()
  })

  it("uses non-smooth auto-scroll for streaming transcript updates", () => {
    const timestamp = new Date().toISOString()
    const scrollSpy = vi.spyOn(Element.prototype, "scrollIntoView")

    const { rerender } = render(
      <ConversationView
        state="assistant_speaking"
        messages={[{
          id: "msg-stream",
          role: "assistant",
          content: "Got it, I have",
          timestamp,
          isStreaming: true,
        }]}
      />
    )

    scrollSpy.mockClear()

    rerender(
      <ConversationView
        state="assistant_speaking"
        messages={[{
          id: "msg-stream",
          role: "assistant",
          content: "Got it, I have scheduled that",
          timestamp,
          isStreaming: true,
        }]}
      />
    )

    expect(scrollSpy).toHaveBeenCalledWith({ behavior: "auto" })
  })
})
