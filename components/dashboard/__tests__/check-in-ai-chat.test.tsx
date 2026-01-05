// @vitest-environment jsdom

import React from "react"
import "@testing-library/jest-dom"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

const useCheckInMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

vi.mock("@/hooks/use-check-in", () => ({
  useCheckIn: (...args: unknown[]) => useCheckInMock(...args),
}))

vi.mock("@/hooks/use-storage", () => ({
  useCheckInSessionActions: () => ({
    addCheckInSession: vi.fn(async () => {}),
    updateCheckInSession: vi.fn(async () => {}),
  }),
}))

vi.mock("@/lib/storage/db", () => ({
  db: {
    journalEntries: {
      where: () => ({
        equals: () => ({
          toArray: async () => [],
        }),
      }),
    },
    suggestions: {
      put: async () => {},
    },
  },
}))

vi.mock("@/lib/gemini/synthesis-client", () => ({
  synthesizeCheckInSession: vi.fn(async () => ({ meta: { generatedAt: "" }, suggestions: [] })),
}))

vi.mock("@/components/check-in/chat-input", () => ({
  ChatInput: ({ onSendText }: { onSendText: (text: string) => void }) => (
    <button type="button" onClick={() => onSendText("hello")}>
      Send text
    </button>
  ),
}))

describe("AIChatContent", () => {
  beforeEach(() => {
    useCheckInMock.mockReset()
  })

  it("shows an Interrupt button while the assistant is speaking", async () => {
    const interruptAssistant = vi.fn()

    useCheckInMock.mockReturnValue([
      {
        state: "assistant_speaking",
        initPhase: null,
        isActive: true,
        session: { id: "s1", startedAt: new Date().toISOString(), messages: [], acousticMetrics: null },
        messages: [],
        currentUserTranscript: "",
        widgets: [],
        error: null,
        isMuted: false,
      },
      {
        startSession: vi.fn(async () => {}),
        endSession: vi.fn(async () => {}),
        cancelSession: vi.fn(),
        getSession: vi.fn(() => null),
        toggleMute: vi.fn(),
        dismissWidget: vi.fn(),
        undoScheduledActivity: vi.fn(async () => {}),
        runQuickAction: vi.fn(),
        saveJournalEntry: vi.fn(async () => {}),
        triggerManualTool: vi.fn(),
        sendTextMessage: vi.fn(),
        preserveSession: vi.fn(),
        hasPreservedSession: vi.fn(() => false),
        resumePreservedSession: vi.fn(async () => {}),
        getContextFingerprint: vi.fn(async () => ""),
        interruptAssistant,
      },
    ])

    const { AIChatContent } = await import("../check-in-ai-chat")

    render(<AIChatContent />)

    expect(screen.getByRole("button", { name: /interrupt/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /interrupt/i }))
    expect(interruptAssistant).toHaveBeenCalledTimes(1)
  })

  it("applies glass chrome styles when chrome=\"glass\"", async () => {
    useCheckInMock.mockReturnValue([
      {
        state: "assistant_speaking",
        initPhase: null,
        isActive: true,
        session: { id: "s1", startedAt: new Date().toISOString(), messages: [], acousticMetrics: null },
        messages: [],
        currentUserTranscript: "",
        widgets: [],
        error: null,
        isMuted: false,
      },
      {
        startSession: vi.fn(async () => {}),
        endSession: vi.fn(async () => {}),
        cancelSession: vi.fn(),
        getSession: vi.fn(() => null),
        toggleMute: vi.fn(),
        dismissWidget: vi.fn(),
        undoScheduledActivity: vi.fn(async () => {}),
        runQuickAction: vi.fn(),
        saveJournalEntry: vi.fn(async () => {}),
        triggerManualTool: vi.fn(),
        sendTextMessage: vi.fn(),
        preserveSession: vi.fn(),
        hasPreservedSession: vi.fn(() => false),
        resumePreservedSession: vi.fn(async () => {}),
        getContextFingerprint: vi.fn(async () => ""),
        interruptAssistant: vi.fn(),
      },
    ])

    const { AIChatContent } = await import("../check-in-ai-chat")

    const { rerender } = render(<AIChatContent chrome="default" />)
    expect(screen.getByText(/listening for voice biomarkers/i).parentElement).not.toHaveClass("bg-transparent")

    rerender(<AIChatContent chrome="glass" />)
    expect(screen.getByText(/listening for voice biomarkers/i).parentElement).toHaveClass("bg-transparent")
  })
})

