// @vitest-environment jsdom

import React from "react"
import "@testing-library/jest-dom"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import type { UseCheckInOptions } from "@/hooks/use-check-in"
import type { AudioFeatures, CheckInSession } from "@/lib/types"

const useCheckInMock = vi.fn()
const addCheckInSessionMock = vi.fn(async () => {})
const updateCheckInSessionMock = vi.fn(async () => {})

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
    addCheckInSession: addCheckInSessionMock,
    updateCheckInSession: updateCheckInSessionMock,
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
    addCheckInSessionMock.mockClear()
    updateCheckInSessionMock.mockClear()
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

  it("saves sessions with voice metrics even when message count is <= 1", async () => {
    let capturedOptions: UseCheckInOptions | null = null

    useCheckInMock.mockImplementation((options: UseCheckInOptions) => {
      capturedOptions = options
      return [
        {
          state: "complete",
          initPhase: null,
          isActive: false,
          session: null,
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
      ]
    })

    const { AIChatContent } = await import("../check-in-ai-chat")
    render(<AIChatContent />)

    expect(capturedOptions?.onSessionEnd).toEqual(expect.any(Function))

    const features: AudioFeatures = {
      mfcc: [1, 2, 3],
      spectralCentroid: 2000,
      spectralFlux: 0.1,
      spectralRolloff: 3000,
      rms: 0.1,
      zcr: 0.05,
      speechRate: 4,
      pauseRatio: 0.2,
      pauseCount: 2,
      avgPauseDuration: 200,
      pitchMean: 200,
      pitchStdDev: 20,
      pitchRange: 100,
    }

    const session: CheckInSession = {
      id: "s1",
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      messages: [
        {
          id: "m1",
          role: "assistant",
          content: "Hello",
          timestamp: new Date().toISOString(),
        },
      ],
      acousticMetrics: {
        stressScore: 42,
        fatigueScore: 55,
        stressLevel: "moderate",
        fatigueLevel: "tired",
        confidence: 0.9,
        features,
      },
      audioData: [0, 1, 2],
      sampleRate: 16000,
    }

    await act(async () => {
      await capturedOptions.onSessionEnd(session)
    })

    expect(addCheckInSessionMock).toHaveBeenCalledTimes(1)
    expect(addCheckInSessionMock).toHaveBeenCalledWith(session)
  })
})
