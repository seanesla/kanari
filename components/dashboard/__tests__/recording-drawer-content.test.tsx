/**
 * @vitest-environment jsdom
 */

import type React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"

import { RecordingDrawerContent } from "../recording-drawer-content"
import { useRecording } from "@/hooks/use-recording"
import { useRecordingActions, useTrendDataActions } from "@/hooks/use-storage"
import { toast } from "sonner"
import { analyzeVoiceMetrics } from "@/lib/ml/inference"
import type { AudioFeatures, VoiceMetrics } from "@/lib/types"

vi.mock("next-view-transitions", () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

vi.mock("@/hooks/use-recording", () => ({
  useRecording: vi.fn(),
}))

vi.mock("@/hooks/use-storage", () => ({
  useRecordingActions: vi.fn(),
  useTrendDataActions: vi.fn(),
}))

vi.mock("@/components/dashboard/recording-waveform", () => ({
  AudioLevelMeter: ({ level }: { level: number }) => (
    <div data-testid="audio-level-meter" data-level={String(level)} />
  ),
  RecordingWaveform: ({ playheadPosition }: { playheadPosition: number }) => (
    <div data-testid="recording-waveform" data-playhead={String(playheadPosition)} />
  ),
}))

vi.mock("@/components/dashboard/audio-player", () => ({
  AudioPlayer: ({ onTimeUpdate }: { onTimeUpdate?: (time: number) => void }) => (
    <button type="button" data-testid="audio-player" onClick={() => onTimeUpdate?.(1)}>
      AudioPlayer
    </button>
  ),
}))

vi.mock("@/components/check-in", () => ({
  PostRecordingPrompt: ({
    stressScore,
    fatigueScore,
    onDismiss,
  }: {
    stressScore: number
    fatigueScore: number
    onDismiss?: () => void
  }) => (
    <div data-testid="post-recording-prompt">
      Prompt {stressScore}/{fatigueScore}
      <button type="button" onClick={() => onDismiss?.()}>
        Dismiss
      </button>
    </div>
  ),
}))

type RecordingState = "idle" | "recording" | "processing" | "complete" | "error"

type MockRecordingData = {
  state: RecordingState
  duration: number
  audioData: Float32Array | null
  features: AudioFeatures | null
  processingResult: { metadata: { speechDuration: number } } | null
  error: string | null
  audioLevel: number
}

const createMockFeatures = (overrides: Partial<AudioFeatures> = {}): AudioFeatures => ({
  mfcc: [1, 2, 3],
  spectralCentroid: 0.4,
  spectralFlux: 0.2,
  spectralRolloff: 0.5,
  rms: 0.15,
  zcr: 0.1,
  speechRate: 3.2,
  pauseRatio: 0.25,
  pauseCount: 6,
  avgPauseDuration: 180,
  pitchMean: 220,
  pitchStdDev: 18,
  pitchRange: 90,
  ...overrides,
})

const createMockMetrics = (overrides: Partial<VoiceMetrics> = {}): VoiceMetrics => ({
  stressScore: 10,
  fatigueScore: 12,
  stressLevel: "low",
  fatigueLevel: "rested",
  confidence: 0.9,
  analyzedAt: "2025-12-28T00:00:00.000Z",
  ...overrides,
})

const baseRecordingData: MockRecordingData = {
  state: "idle",
  duration: 0,
  audioData: null,
  features: null,
  processingResult: null,
  error: null,
  audioLevel: 0,
}

let mockRecordingData: MockRecordingData = { ...baseRecordingData }
const mockControls = {
  startRecording: vi.fn(async () => {}),
  stopRecording: vi.fn(async () => {}),
  reset: vi.fn(),
  cancelRecording: vi.fn(),
}

let lastUseRecordingOptions: unknown

const addRecording = vi.fn(async () => "test-uuid")
const addTrendData = vi.fn(async () => {})

beforeEach(() => {
  vi.clearAllMocks()

  mockRecordingData = { ...baseRecordingData }
  lastUseRecordingOptions = undefined

  Object.defineProperty(globalThis, "crypto", {
    value: { randomUUID: vi.fn(() => "test-uuid") },
    configurable: true,
  })

  vi.mocked(useRecording).mockImplementation((options) => {
    lastUseRecordingOptions = options
    return [mockRecordingData, mockControls] as unknown as ReturnType<typeof useRecording>
  })

  vi.mocked(useRecordingActions).mockReturnValue({
    addRecording,
  } as unknown as ReturnType<typeof useRecordingActions>)

  vi.mocked(useTrendDataActions).mockReturnValue({
    addTrendData,
  } as unknown as ReturnType<typeof useTrendDataActions>)

  vi.mocked(analyzeVoiceMetrics).mockReturnValue(createMockMetrics())
})

describe("RecordingDrawerContent", () => {
  it("renders the idle header and recommended instruction", () => {
    render(<RecordingDrawerContent />)

    expect(screen.getByRole("heading", { name: "Voice Check-in" })).toBeInTheDocument()
    expect(screen.getByText("Speak naturally for 30-60 seconds")).toBeInTheDocument()
    expect(screen.getByText("Ready to record")).toBeInTheDocument()
    expect(screen.getByText("Recommended: 30-60 seconds")).toBeInTheDocument()
  })

  it("shows a close button in idle state and calls onClose when clicked", () => {
    const onClose = vi.fn()
    const { container } = render(<RecordingDrawerContent onClose={onClose} />)

    const closeButton = container.querySelector("button.h-8.w-8")
    expect(closeButton).not.toBeNull()

    fireEvent.click(closeButton!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("hides the close button while recording", () => {
    mockRecordingData = { ...baseRecordingData, state: "recording", duration: 2 }
    const { container } = render(<RecordingDrawerContent />)

    expect(container.querySelector("button.h-8.w-8")).toBeNull()
    expect(screen.getByText("Recording...")).toBeInTheDocument()
  })

  it("initializes useRecording with VAD + autoProcess and an onError handler", () => {
    render(<RecordingDrawerContent />)

    expect(lastUseRecordingOptions).toMatchObject({
      enableVAD: true,
      autoProcess: true,
      onError: expect.any(Function),
    })
  })

  it("calls startRecording when clicking the record button", () => {
    const { container } = render(<RecordingDrawerContent />)

    const recordButton = container.querySelector("button.bg-accent")
    expect(recordButton).not.toBeNull()
    fireEvent.click(recordButton!)

    expect(mockControls.startRecording).toHaveBeenCalledTimes(1)
  })

  it("shows the recording UI state and notifies onRecordingStateChange(true)", async () => {
    const onRecordingStateChange = vi.fn()

    mockRecordingData = {
      ...baseRecordingData,
      state: "recording",
      duration: 5,
      audioLevel: 0.42,
    }

    render(<RecordingDrawerContent onRecordingStateChange={onRecordingStateChange} />)

    expect(screen.getByText("Recording...")).toBeInTheDocument()
    expect(screen.getByText("0:05")).toBeInTheDocument()
    expect(screen.getByTestId("audio-level-meter")).toHaveAttribute("data-level", "0.42")

    await waitFor(() => {
      expect(onRecordingStateChange).toHaveBeenCalledWith(true)
    })
  })

  it("shows the processing UI state and notifies onRecordingStateChange(true)", async () => {
    const onRecordingStateChange = vi.fn()

    mockRecordingData = {
      ...baseRecordingData,
      state: "processing",
      duration: 12,
    }

    const { container } = render(<RecordingDrawerContent onRecordingStateChange={onRecordingStateChange} />)

    expect(screen.getByText("Processing audio...")).toBeInTheDocument()
    expect(container.querySelector("button.bg-accent")).toBeNull()

    await waitFor(() => {
      expect(onRecordingStateChange).toHaveBeenCalledWith(true)
    })
  })

  it("notifies onRecordingStateChange(false) when idle", async () => {
    const onRecordingStateChange = vi.fn()

    render(<RecordingDrawerContent onRecordingStateChange={onRecordingStateChange} />)

    await waitFor(() => {
      expect(onRecordingStateChange).toHaveBeenCalledWith(false)
    })
  })

  it("auto-saves when recording completes, then calls onRecordingComplete", async () => {
    const onRecordingComplete = vi.fn()
    const features = createMockFeatures()

    mockRecordingData = {
      ...baseRecordingData,
      state: "complete",
      duration: 15,
      audioData: new Float32Array([0.1, 0.2, 0.3]),
      features,
      processingResult: { metadata: { speechDuration: 9.8 } },
    }

    render(<RecordingDrawerContent onRecordingComplete={onRecordingComplete} />)

    await waitFor(() => {
      expect(addRecording).toHaveBeenCalledTimes(1)
    })

    expect(vi.mocked(analyzeVoiceMetrics)).toHaveBeenCalledWith(features)
    expect(addTrendData).toHaveBeenCalledWith(
      expect.objectContaining({
        date: expect.any(String),
        stressScore: expect.any(Number),
        fatigueScore: expect.any(Number),
      })
    )

    expect(onRecordingComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "test-uuid",
        status: "complete",
        duration: 15,
        sampleRate: 16000,
      })
    )
  })

  it("shows a saved confirmation after persisting the recording", async () => {
    mockRecordingData = {
      ...baseRecordingData,
      state: "complete",
      duration: 8,
      audioData: new Float32Array([0.1, 0.2]),
      features: createMockFeatures(),
      processingResult: { metadata: { speechDuration: 4.2 } },
    }

    render(<RecordingDrawerContent />)

    await waitFor(() => {
      expect(screen.getByText("Recording saved successfully")).toBeInTheDocument()
    })
  })

  it("shows completion actions (Record Again / Done / Get Suggestions) when saved", async () => {
    mockRecordingData = {
      ...baseRecordingData,
      state: "complete",
      duration: 8,
      audioData: new Float32Array([0.1, 0.2]),
      features: createMockFeatures(),
      processingResult: { metadata: { speechDuration: 4.2 } },
    }

    render(<RecordingDrawerContent />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Record Again" })).toBeInTheDocument()
    })
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Get Suggestions" })).toBeInTheDocument()
  })

  it("calls onClose when clicking Done after save", async () => {
    const onClose = vi.fn()

    mockRecordingData = {
      ...baseRecordingData,
      state: "complete",
      duration: 8,
      audioData: new Float32Array([0.1, 0.2]),
      features: createMockFeatures(),
      processingResult: { metadata: { speechDuration: 4.2 } },
    }

    render(<RecordingDrawerContent onClose={onClose} />)

    const doneButton = await screen.findByRole("button", { name: "Done" })
    fireEvent.click(doneButton)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("resets internal saved state when clicking Record Again", async () => {
    mockRecordingData = {
      ...baseRecordingData,
      state: "complete",
      duration: 8,
      audioData: new Float32Array([0.1, 0.2]),
      features: createMockFeatures(),
      processingResult: { metadata: { speechDuration: 4.2 } },
    }

    const { rerender } = render(<RecordingDrawerContent />)

    const recordAgainButton = await screen.findByRole("button", { name: "Record Again" })
    fireEvent.click(recordAgainButton)
    expect(mockControls.reset).toHaveBeenCalledTimes(1)

    mockRecordingData = { ...baseRecordingData }
    rerender(<RecordingDrawerContent />)

    expect(screen.getByText("Ready to record")).toBeInTheDocument()
  })

  it("shows a retry button when saving fails and triggers toast.error", async () => {
    addRecording.mockRejectedValueOnce(new Error("DB unavailable"))

    mockRecordingData = {
      ...baseRecordingData,
      state: "complete",
      duration: 8,
      audioData: new Float32Array([0.1, 0.2]),
      features: createMockFeatures(),
      processingResult: { metadata: { speechDuration: 4.2 } },
    }

    render(<RecordingDrawerContent />)

    const retryButton = await screen.findByRole("button", { name: "Retry Save" })
    expect(screen.getByText("DB unavailable")).toBeInTheDocument()

    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Save failed", {
      description: "DB unavailable",
    })

    addRecording.mockResolvedValueOnce("test-uuid")
    fireEvent.click(retryButton)

    await waitFor(() => {
      expect(addRecording).toHaveBeenCalledTimes(2)
    })
  })

  it("shows the post-recording check-in prompt when stress is > 50", async () => {
    vi.mocked(analyzeVoiceMetrics).mockReturnValue(
      createMockMetrics({ stressScore: 51, stressLevel: "elevated" })
    )

    mockRecordingData = {
      ...baseRecordingData,
      state: "complete",
      duration: 8,
      audioData: new Float32Array([0.1, 0.2]),
      features: createMockFeatures(),
      processingResult: { metadata: { speechDuration: 4.2 } },
    }

    render(<RecordingDrawerContent />)

    await waitFor(() => {
      expect(screen.getByTestId("post-recording-prompt")).toBeInTheDocument()
    })
  })

  it("shows the elevated guidance (but no prompt) when stress is exactly 50", async () => {
    vi.mocked(analyzeVoiceMetrics).mockReturnValue(
      createMockMetrics({ stressScore: 50, stressLevel: "elevated", fatigueScore: 10 })
    )

    mockRecordingData = {
      ...baseRecordingData,
      state: "complete",
      duration: 8,
      audioData: new Float32Array([0.1, 0.2]),
      features: createMockFeatures(),
      processingResult: { metadata: { speechDuration: 4.2 } },
    }

    render(<RecordingDrawerContent />)

    await waitFor(() => {
      expect(screen.queryByTestId("post-recording-prompt")).not.toBeInTheDocument()
    })

    expect(screen.getByText("Your stress levels appear elevated")).toBeInTheDocument()
  })

  it("shows the low guidance when stress and fatigue are low", async () => {
    vi.mocked(analyzeVoiceMetrics).mockReturnValue(
      createMockMetrics({ stressScore: 10, stressLevel: "low", fatigueScore: 10 })
    )

    mockRecordingData = {
      ...baseRecordingData,
      state: "complete",
      duration: 8,
      audioData: new Float32Array([0.1, 0.2]),
      features: createMockFeatures(),
      processingResult: { metadata: { speechDuration: 4.2 } },
    }

    render(<RecordingDrawerContent />)

    await waitFor(() => {
      expect(screen.getByText("Looking good! Your levels are within normal range")).toBeInTheDocument()
    })
  })
})
