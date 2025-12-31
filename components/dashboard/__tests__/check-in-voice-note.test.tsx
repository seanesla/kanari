/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from "vitest"
import type React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"

import { VoiceNoteContent } from "../check-in-voice-note"
import { useRecording } from "@/hooks/use-recording"
import { useRecordingActions, useTrendDataActions } from "@/hooks/use-storage"
import { toast } from "sonner"
import { analyzeVoiceMetrics } from "@/lib/ml/inference"
import { getGeminiApiKey } from "@/lib/utils"
import type { AudioFeatures, GeminiSemanticAnalysis, VoiceMetrics } from "@/lib/types"

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
  EmotionTimeline: ({ analysis }: { analysis: GeminiSemanticAnalysis }) => (
    <div data-testid="emotion-timeline">{analysis.overallEmotion}</div>
  ),
}))

vi.mock("@/lib/utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/utils")>("@/lib/utils")
  return {
    ...actual,
    getGeminiApiKey: vi.fn(),
  }
})

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

const createMockSemanticAnalysis = (
  overrides: Partial<GeminiSemanticAnalysis> = {}
): GeminiSemanticAnalysis => ({
  overallEmotion: "neutral",
  emotionConfidence: 0.8,
  segments: [
    {
      timestamp: "00:00",
      emotion: "neutral",
      content: "sample",
    },
  ],
  observations: [
    {
      type: "positive_cue",
      observation: "Looks steady",
      relevance: "low",
    },
  ],
  stressInterpretation: "Low stress signals",
  fatigueInterpretation: "Low fatigue signals",
  summary: "Sample summary",
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
const updateRecording = vi.fn(async () => {})
const addTrendData = vi.fn(async () => {})

beforeEach(() => {
  vi.clearAllMocks()

  mockRecordingData = { ...baseRecordingData }
  lastUseRecordingOptions = undefined

  Object.defineProperty(globalThis, "crypto", {
    value: { randomUUID: vi.fn(() => "test-uuid") },
    configurable: true,
  })

  vi.stubGlobal("fetch", vi.fn())

  vi.mocked(useRecording).mockImplementation((options) => {
    lastUseRecordingOptions = options
    return [mockRecordingData, mockControls] as unknown as ReturnType<typeof useRecording>
  })

  vi.mocked(useRecordingActions).mockReturnValue({
    addRecording,
    updateRecording,
    deleteRecording: vi.fn(),
    clearAllRecordings: vi.fn(),
  } as unknown as ReturnType<typeof useRecordingActions>)

  vi.mocked(useTrendDataActions).mockReturnValue({
    addTrendData,
    updateTrendData: vi.fn(),
  } as unknown as ReturnType<typeof useTrendDataActions>)

  vi.mocked(analyzeVoiceMetrics).mockReturnValue(createMockMetrics())
  vi.mocked(getGeminiApiKey).mockResolvedValue(undefined)
})

describe("VoiceNoteContent", () => {
  it("renders the idle state UI", () => {
    render(<VoiceNoteContent />)

    expect(screen.getByText("Ready to record")).toBeInTheDocument()
    expect(screen.getByText("0:00")).toBeInTheDocument()
    expect(screen.getByText("Stop when you're ready")).toBeInTheDocument()
    expect(screen.getByText("Tips for best results:")).toBeInTheDocument()
  })

  it("initializes useRecording with VAD + autoProcess and an onError handler", () => {
    render(<VoiceNoteContent />)

    expect(lastUseRecordingOptions).toMatchObject({
      enableVAD: true,
      autoProcess: true,
      onError: expect.any(Function),
    })
  })

  it("calls startRecording when clicking the record button", () => {
    const { container } = render(<VoiceNoteContent />)

    const recordButton = container.querySelector("button.bg-accent")
    expect(recordButton).not.toBeNull()
    fireEvent.click(recordButton!)

    expect(mockControls.startRecording).toHaveBeenCalledTimes(1)
  })

  it("shows the recording UI state and notifies onSessionChange(true)", async () => {
    const onSessionChange = vi.fn()

    mockRecordingData = {
      ...baseRecordingData,
      state: "recording",
      duration: 5,
      audioLevel: 0.42,
    }

    render(<VoiceNoteContent onSessionChange={onSessionChange} />)

    expect(screen.getByText("Recording...")).toBeInTheDocument()
    expect(screen.getByText("0:05")).toBeInTheDocument()
    expect(screen.getByTestId("audio-level-meter")).toHaveAttribute("data-level", "0.42")

    await waitFor(() => {
      expect(onSessionChange).toHaveBeenCalledWith(true)
    })
  })

  it("shows the processing UI state and hides the record button", async () => {
    const onSessionChange = vi.fn()

    mockRecordingData = {
      ...baseRecordingData,
      state: "processing",
      duration: 12,
    }

    const { container } = render(<VoiceNoteContent onSessionChange={onSessionChange} />)

    expect(screen.getByText("Processing audio...")).toBeInTheDocument()
    expect(container.querySelector("button.bg-accent")).toBeNull()

    await waitFor(() => {
      expect(onSessionChange).toHaveBeenCalledWith(true)
    })
  })

  it("renders an error message when in the error state", () => {
    mockRecordingData = {
      ...baseRecordingData,
      state: "error",
      error: "Mic permission denied",
    }

    render(<VoiceNoteContent />)

    expect(screen.getByText("Error")).toBeInTheDocument()
    expect(screen.getByText("Mic permission denied")).toBeInTheDocument()
  })

  it("surfaces recording errors via the useRecording onError callback", () => {
    render(<VoiceNoteContent />)

    const { onError } = lastUseRecordingOptions as { onError?: (error: Error) => void }
    expect(onError).toBeDefined()

    onError?.(new Error("boom"))

    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Recording failed", {
      description: "boom",
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

    render(<VoiceNoteContent onRecordingComplete={onRecordingComplete} />)

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

    render(<VoiceNoteContent />)

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

    render(<VoiceNoteContent />)

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

    render(<VoiceNoteContent onClose={onClose} />)

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

    const { rerender } = render(<VoiceNoteContent />)

    const recordAgainButton = await screen.findByRole("button", { name: "Record Again" })
    fireEvent.click(recordAgainButton)
    expect(mockControls.reset).toHaveBeenCalledTimes(1)

    mockRecordingData = { ...baseRecordingData }
    rerender(<VoiceNoteContent />)

    expect(screen.getByText("Ready to record")).toBeInTheDocument()
    expect(screen.getByText("Tips for best results:")).toBeInTheDocument()
  })

  it("shows a retry button when saving fails, and retries on click", async () => {
    addRecording.mockRejectedValueOnce(new Error("DB unavailable"))

    mockRecordingData = {
      ...baseRecordingData,
      state: "complete",
      duration: 8,
      audioData: new Float32Array([0.1, 0.2]),
      features: createMockFeatures(),
      processingResult: { metadata: { speechDuration: 4.2 } },
    }

    render(<VoiceNoteContent />)

    const retryButton = await screen.findByRole("button", { name: "Retry Save" })
    expect(screen.getByText("DB unavailable")).toBeInTheDocument()

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

    render(<VoiceNoteContent />)

    await waitFor(() => {
      expect(screen.getByTestId("post-recording-prompt")).toBeInTheDocument()
    })
  })

  it("hides the post-recording check-in prompt when stress/fatigue are <= 50", async () => {
    vi.mocked(analyzeVoiceMetrics).mockReturnValue(
      createMockMetrics({ stressScore: 50, stressLevel: "elevated", fatigueScore: 20 })
    )

    mockRecordingData = {
      ...baseRecordingData,
      state: "complete",
      duration: 8,
      audioData: new Float32Array([0.1, 0.2]),
      features: createMockFeatures(),
      processingResult: { metadata: { speechDuration: 4.2 } },
    }

    render(<VoiceNoteContent />)

    await waitFor(() => {
      expect(screen.queryByTestId("post-recording-prompt")).not.toBeInTheDocument()
    })

    expect(screen.getByText("Your stress levels appear elevated")).toBeInTheDocument()
  })

  it("skips emotion analysis when no Gemini API key is configured", async () => {
    const fetchSpy = vi.mocked(globalThis.fetch)

    vi.mocked(getGeminiApiKey).mockResolvedValue(undefined)

    mockRecordingData = {
      ...baseRecordingData,
      state: "complete",
      duration: 8,
      audioData: new Float32Array([0.1, 0.2]),
      features: createMockFeatures(),
      processingResult: { metadata: { speechDuration: 4.2 } },
    }

    render(<VoiceNoteContent />)

    await waitFor(() => {
      expect(addRecording).toHaveBeenCalledTimes(1)
    })

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(updateRecording).not.toHaveBeenCalled()
  })

  it("runs emotion analysis in the background and renders the results", async () => {
    vi.mocked(getGeminiApiKey).mockResolvedValue("test-api-key")

    const analysis = createMockSemanticAnalysis({ overallEmotion: "happy" })

    let resolveFetch: ((value: Response) => void) | undefined
    const fetchDeferred = new Promise<Response>((resolve) => {
      resolveFetch = resolve
    })

    vi.mocked(globalThis.fetch).mockReturnValue(fetchDeferred)

    mockRecordingData = {
      ...baseRecordingData,
      state: "complete",
      duration: 8,
      audioData: new Float32Array([0.1, 0.2]),
      features: createMockFeatures(),
      processingResult: { metadata: { speechDuration: 4.2 } },
    }

    render(<VoiceNoteContent />)

    await waitFor(() => {
      expect(addRecording).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(screen.getByText("Analyzing emotions with Gemini...")).toBeInTheDocument()
    })

    resolveFetch?.(
      new Response(JSON.stringify(analysis), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )

    await waitFor(() => {
      expect(updateRecording).toHaveBeenCalledWith("test-uuid", { semanticAnalysis: analysis })
    })

    expect(screen.getByTestId("emotion-timeline")).toHaveTextContent("happy")
  })

  it("handles emotion analysis failures without throwing", async () => {
    vi.mocked(getGeminiApiKey).mockResolvedValue("test-api-key")

    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "bad request" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    )

    mockRecordingData = {
      ...baseRecordingData,
      state: "complete",
      duration: 8,
      audioData: new Float32Array([0.1, 0.2]),
      features: createMockFeatures(),
      processingResult: { metadata: { speechDuration: 4.2 } },
    }

    render(<VoiceNoteContent />)

    await waitFor(() => {
      expect(addRecording).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled()
    })

    expect(screen.queryByTestId("emotion-timeline")).not.toBeInTheDocument()
  })
})
