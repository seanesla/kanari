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

vi.mock("@/hooks/use-strict-mode-ready", () => ({
  useStrictModeReady: () => true,
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
  ChatInput: ({
    onSendText,
    modalityHint,
    disabled,
  }: {
    onSendText: (text: string) => void
    modalityHint?: string
    disabled?: boolean
  }) => (
    <div>
      <button type="button" disabled={disabled} onClick={() => onSendText("hello")}>
        Send text
      </button>
      {modalityHint ? <p>{modalityHint}</p> : null}
    </div>
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
  }, 10000)

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

  it("shows an info-only hint when voice biomarkers are not available yet", async () => {
    useCheckInMock.mockReturnValue([
      {
        state: "listening",
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
    render(<AIChatContent />)

    expect(
      screen.getByText(/speak for about 1-2 seconds to generate voice biomarkers/i)
    ).toBeInTheDocument()
  })

  it("shows a muted hint when the microphone is muted", async () => {
    useCheckInMock.mockReturnValue([
      {
        state: "listening",
        initPhase: null,
        isActive: true,
        session: { id: "s1", startedAt: new Date().toISOString(), messages: [], acousticMetrics: null },
        messages: [],
        currentUserTranscript: "",
        widgets: [],
        error: null,
        isMuted: true,
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
    render(<AIChatContent />)

    expect(
      screen.getByText(/mic is muted\. typing still works, but voice biomarkers will pause/i)
    ).toBeInTheDocument()
  })

  it("shows a speaking-benefit hint after biomarkers are available", async () => {
    useCheckInMock.mockReturnValue([
      {
        state: "listening",
        initPhase: null,
        isActive: true,
        session: {
          id: "s1",
          startedAt: new Date().toISOString(),
          messages: [],
          acousticMetrics: {
            stressScore: 42,
            fatigueScore: 37,
            stressLevel: "moderate",
            fatigueLevel: "normal",
            confidence: 0.8,
            features: {} as AudioFeatures,
          },
        },
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
    render(<AIChatContent />)

    expect(
      screen.getByText(/typing keeps the chat moving\. speaking gives kanari richer biomarker context/i)
    ).toBeInTheDocument()
  })

  it("disables chat input and shows scheduling copy while schedule sync is in-flight", async () => {
    useCheckInMock.mockReturnValue([
      {
        state: "processing",
        initPhase: null,
        isActive: true,
        session: { id: "s1", startedAt: new Date().toISOString(), messages: [], acousticMetrics: null },
        messages: [],
        currentUserTranscript: "",
        widgets: [
          {
            id: "w1",
            type: "schedule_activity",
            createdAt: new Date().toISOString(),
            args: {
              title: "Super Bowl game with dad",
              category: "social",
              date: "2026-02-08",
              time: "15:30",
              duration: 240,
            },
            status: "scheduled",
            suggestionId: "sg1",
            isSyncing: true,
          },
        ],
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
    render(<AIChatContent />)

    expect(screen.getByRole("button", { name: /send text/i })).toBeDisabled()
    expect(
      screen.getByText(/scheduling your activity now\. chat input will re-enable as soon as it is saved\./i)
    ).toBeInTheDocument()
  })

  it("saves sessions with voice metrics even when message count is <= 1", async () => {
    let capturedOptions: { onSessionEnd?: UseCheckInOptions["onSessionEnd"] } | null = null

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
    const { synthesizeCheckInSession } = await import("@/lib/gemini/synthesis-client")
    render(<AIChatContent />)

    const onSessionEnd = (capturedOptions as { onSessionEnd?: (session: CheckInSession) => void } | null)?.onSessionEnd
    expect(onSessionEnd).toEqual(expect.any(Function))

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
      await Promise.resolve(onSessionEnd?.(session))
    })

    expect(addCheckInSessionMock).toHaveBeenCalledTimes(1)
    expect(addCheckInSessionMock).toHaveBeenCalledWith(session)
    expect(vi.mocked(synthesizeCheckInSession)).not.toHaveBeenCalled()
    expect(
      screen.getByText(/check-in ended too quickly to synthesize/i)
    ).toBeInTheDocument()
  })

  it("does not keep the Start button disabled forever if auto-start fails before state advances", async () => {
    const startSession = vi.fn(async () => {
      throw new Error("start failed")
    })

    useCheckInMock.mockReturnValue([
      {
        state: "idle",
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
        startSession,
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
    render(<AIChatContent autoStart />)

    // Auto-start failure should release the UI so the user can manually start.
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(startSession).toHaveBeenCalledTimes(1)
    const startButton = screen.getByRole("button", { name: /start check-in/i })
    expect(startButton).toBeEnabled()
  })
})
