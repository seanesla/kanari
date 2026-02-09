// @vitest-environment jsdom

import React from "react"
import "@testing-library/jest-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { CheckInSession } from "@/lib/types"

const useLiveQueryMock = vi.fn()
const audioPlayerSpy = vi.fn()

vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: (...args: unknown[]) => useLiveQueryMock(...args),
}))

vi.mock("@/hooks/use-coach-avatar", () => ({
  useCoachAvatar: () => ({ avatarBase64: null, isLoading: false }),
}))

vi.mock("@/lib/timezone-context", () => ({
  useTimeZone: () => ({ timeZone: "UTC" }),
}))

vi.mock("@/components/check-in/message-bubble", () => ({
  MessageBubble: ({ message }: { message: { content: string } }) => <div>{message.content}</div>,
}))

vi.mock("@/components/check-in/voice-biomarker-report", () => ({
  VoiceBiomarkerReport: () => <div data-testid="voice-report" />,
}))

vi.mock("@/components/dashboard/recording-waveform", () => ({
  RecordingWaveform: () => <div data-testid="waveform" />,
}))

vi.mock("@/components/dashboard/audio-player", () => ({
  AudioPlayer: (props: Record<string, unknown>) => {
    audioPlayerSpy(props)
    return <div data-testid="audio-player" />
  },
}))

describe("AIChatDetailView audio playback", () => {
  beforeEach(() => {
    useLiveQueryMock.mockReset()
    audioPlayerSpy.mockReset()
    useLiveQueryMock.mockReturnValue(null)
  })

  const baseSession: CheckInSession = {
    id: "session-1",
    startedAt: "2026-02-01T10:00:00.000Z",
    messages: [],
  }

  it("plays linked recording audio when session audio is missing", async () => {
    useLiveQueryMock.mockReturnValue({
      audioData: new Float32Array([0.1, -0.2, 0.15]),
      sampleRate: 24000,
    })

    const { AIChatDetailView } = await import("../ai-chat-detail-view")

    render(
      <AIChatDetailView
        session={{ ...baseSession, recordingId: "rec-1" }}
        onDelete={() => {}}
      />
    )

    expect(screen.getByTestId("audio-player")).toBeInTheDocument()
    expect(audioPlayerSpy).toHaveBeenCalledWith(
      expect.objectContaining({ sampleRate: 24000 })
    )
  })

  it("prefers session audio over linked recording fallback", async () => {
    useLiveQueryMock.mockReturnValue({
      audioData: new Float32Array([0.9, 0.8, 0.7]),
      sampleRate: 24000,
    })

    const { AIChatDetailView } = await import("../ai-chat-detail-view")

    render(
      <AIChatDetailView
        session={{
          ...baseSession,
          audioData: [0.01, -0.02, 0.03],
          sampleRate: 16000,
          recordingId: "rec-1",
        }}
        onDelete={() => {}}
      />
    )

    expect(screen.getByTestId("audio-player")).toBeInTheDocument()

    const firstCall = audioPlayerSpy.mock.calls[0]?.[0] as { audioData?: Float32Array; sampleRate?: number }
    expect(firstCall.sampleRate).toBe(16000)
    expect(firstCall.audioData).toBeInstanceOf(Float32Array)
    const values = Array.from(firstCall.audioData ?? new Float32Array())
    expect(values[0]).toBeCloseTo(0.01, 6)
    expect(values[1]).toBeCloseTo(-0.02, 6)
    expect(values[2]).toBeCloseTo(0.03, 6)
  })
})
