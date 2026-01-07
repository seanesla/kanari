/**
 * ConversationView Component Tests
 *
 * Validates transcript rendering behavior, especially around live voice
 * transcription where a streaming user message should replace the separate
 * transcript preview bubble.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from "vitest"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { ConversationView } from "../conversation-view"
import type { CheckInMessage } from "@/lib/types"

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
})
