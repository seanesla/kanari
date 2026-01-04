/**
 * MessageBubble Component Tests
 *
 * Validates streaming assistant rendering (should show live text, not a placeholder).
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from "vitest"
import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"
import { MessageBubble } from "../message-bubble"
import type { CheckInMessage } from "@/lib/types"

describe("MessageBubble", () => {
  it("shows assistant content while streaming (no Speaking... placeholder)", () => {
    const message: CheckInMessage = {
      id: "asst-1",
      role: "assistant",
      content: "Hello there",
      timestamp: new Date().toISOString(),
      isStreaming: true,
    }

    render(<MessageBubble message={message} />)

    expect(screen.getByText("Hello there")).toBeInTheDocument()
    expect(screen.getByText("▍")).toBeInTheDocument()
    expect(screen.queryByText("Speaking...")).not.toBeInTheDocument()
  })

  it("does not show the cursor when not streaming", () => {
    const message: CheckInMessage = {
      id: "asst-2",
      role: "assistant",
      content: "All set",
      timestamp: new Date().toISOString(),
      isStreaming: false,
    }

    render(<MessageBubble message={message} />)

    expect(screen.getByText("All set")).toBeInTheDocument()
    expect(screen.queryByText("▍")).not.toBeInTheDocument()
  })
})

