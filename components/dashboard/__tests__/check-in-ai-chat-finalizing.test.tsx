/**
 * @vitest-environment jsdom
 */

/* eslint-disable @next/next/no-img-element */

import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"

const { useCheckInMock, controls } = vi.hoisted(() => {
  const controls = {
    endSession: vi.fn<[], Promise<void>>(),
    cancelSession: vi.fn(),
    preserveSession: vi.fn(),
    hasPreservedSession: vi.fn(() => false),
    getContextFingerprint: vi.fn(async () => null),
    resumePreservedSession: vi.fn(async () => {}),
    startSession: vi.fn(async () => {}),
    interruptAssistant: vi.fn(),
    sendTextMessage: vi.fn(),
    triggerManualTool: vi.fn(),
    toggleMute: vi.fn(),
    dismissWidget: vi.fn(),
    saveJournalEntry: vi.fn(),
    runQuickAction: vi.fn(),
  }

  const checkInState = {
    state: "assistant_speaking",
    isActive: true,
    isMuted: false,
    initPhase: null,
    currentUserTranscript: "",
    messages: [{ id: "m1", role: "user", content: "hello" }],
    widgets: [],
    session: null,
    error: null,
  }

  return {
    controls,
    checkInState,
    useCheckInMock: vi.fn(() => [checkInState, controls]),
  }
})

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt ?? ""} />,
}))

vi.mock("@/hooks/use-check-in", () => ({
  useCheckIn: useCheckInMock,
}))

vi.mock("@/hooks/use-strict-mode-ready", () => ({
  useStrictModeReady: () => true,
}))

vi.mock("@/hooks/use-storage", () => ({
  useCheckInSessionActions: () => ({
    addCheckInSession: vi.fn(async () => {}),
    updateCheckInSession: vi.fn(async () => {}),
  }),
}))

vi.mock("@/lib/storage/db", () => ({
  db: {
    journalEntries: { where: () => ({ equals: () => ({ toArray: async () => [] }) }) },
    suggestions: { put: vi.fn(async () => {}) },
  },
  fromSuggestion: (input: unknown) => input,
  toJournalEntry: (input: unknown) => input,
}))

vi.mock("@/lib/gemini/synthesis-client", () => ({
  synthesizeCheckInSession: vi.fn(async () => {
    throw new Error("not used in this test")
  }),
}))

vi.mock("@/lib/ml/biomarker-fusion", () => ({
  blendAcousticAndSemanticBiomarkers: vi.fn(() => ({
    stressScore: 0,
    fatigueScore: 0,
    stressLevel: "low",
    fatigueLevel: "rested",
    confidence: 0,
  })),
}))

vi.mock("@/components/check-in/biomarker-indicator", () => ({
  BiomarkerIndicator: () => null,
}))

vi.mock("@/components/check-in/conversation-view", () => ({
  ConversationView: () => null,
}))

vi.mock("@/components/check-in/chat-input", () => ({
  ChatInput: () => null,
}))

vi.mock("@/components/check-in/widgets", () => ({
  BreathingExercise: () => null,
  JournalPrompt: () => null,
  QuickActions: () => null,
  ScheduleConfirmation: () => null,
  StressGauge: () => null,
}))

describe("AIChatContent", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it("shows a finalizing loader after End is pressed until endSession resolves", async () => {
    let resolveEndSession: (() => void) | null = null
    const endSessionPromise = new Promise<void>((resolve) => {
      resolveEndSession = resolve
    })
    controls.endSession.mockReturnValueOnce(endSessionPromise)

    const { AIChatContent } = await import("../check-in-ai-chat")

    render(<AIChatContent />)

    fireEvent.click(screen.getByLabelText("End check-in"))

    expect(screen.queryByText("Finalizing your check-in...")).not.toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(250)
    })

    expect(screen.getByText("Finalizing your check-in...")).toBeInTheDocument()
    expect(controls.endSession).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveEndSession?.()
      await endSessionPromise
    })

    expect(screen.queryByText("Finalizing your check-in...")).not.toBeInTheDocument()
  })
})
