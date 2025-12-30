/**
 * Vitest Setup File
 *
 * Mocks browser-specific modules for testing in Node.js environment
 */

import { vi } from "vitest"

// Mock Web Audio API modules
vi.mock("@ricky0123/vad-web", () => ({
  MicVAD: vi.fn(),
  utils: {
    audioBufferToFloat32: vi.fn(),
  },
}))

// Mock audio processor
vi.mock("@/lib/audio/processor", () => ({
  processAudio: vi.fn(() => ({
    mfcc: [1, 2, 3],
    spectralCentroid: 500,
    zcr: 0.1,
    energy: 0.5,
    pitch: 200,
  })),
}))

// Mock mismatch detector
vi.mock("@/lib/gemini/mismatch-detector", () => ({
  detectMismatch: vi.fn(() => ({
    detected: false,
    confidence: 0.2,
  })),
  shouldRunMismatchDetection: vi.fn(() => true),
  featuresToPatterns: vi.fn(() => ({
    speechRate: 150,
    pauseRatio: 0.2,
  })),
}))

// Mock live prompts
vi.mock("@/lib/gemini/live-prompts", () => ({
  generateMismatchContext: vi.fn(() => "Mismatch context"),
  generateVoicePatternContext: vi.fn(() => "Voice pattern context"),
  generatePostRecordingContext: vi.fn(() => "Post-recording context"),
}))

// Mock ML inference
vi.mock("@/lib/ml/inference", () => ({
  analyzeVoiceMetrics: vi.fn(() => ({
    meanPitch: 200,
    pitchVariation: 50,
    energyMean: 0.5,
    energyVariation: 0.1,
    speechRate: 150,
    pauseRatio: 0.2,
  })),
}))

// Mock PCM converter
vi.mock("@/lib/audio/pcm-converter", () => ({
  int16ToBase64: vi.fn((data) => "base64audiodata=="),
  base64ToInt16: vi.fn(() => new Int16Array(1024)),
}))

// Mock use-gemini-live hook
vi.mock("@/hooks/use-gemini-live", () => ({
  useGeminiLive: vi.fn(() => [
    {
      state: "idle",
      isReady: false,
      isModelSpeaking: false,
      isUserSpeaking: false,
      userTranscript: "",
      modelTranscript: "",
      error: null,
    },
    {
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendAudio: vi.fn(),
      sendText: vi.fn(),
      injectContext: vi.fn(),
      endAudioStream: vi.fn(),
    },
  ]),
}))

// Mock use-audio-playback hook
vi.mock("@/hooks/use-audio-playback", () => ({
  useAudioPlayback: vi.fn(() => ({
    isPlaying: false,
    volume: 1.0,
    audioLevel: 0,
    enqueueAudio: vi.fn(),
    stop: vi.fn(),
    setVolume: vi.fn(),
  })),
}))
