/**
 * Vitest Setup File
 *
 * Mocks browser-specific modules for testing in Node.js environment
 */

import "@testing-library/jest-dom/vitest"
import { vi } from "vitest"

// Minimal Notifications API mock for jsdom tests.
if (typeof window !== "undefined" && !("Notification" in window)) {
  class MockNotification {
    static permission: NotificationPermission = "granted"

    static requestPermission = vi.fn(async () => MockNotification.permission)

    title: string
    options?: NotificationOptions

    constructor(title: string, options?: NotificationOptions) {
      this.title = title
      this.options = options
    }

    close() {}
  }

  Object.defineProperty(window, "Notification", {
    value: MockNotification,
    configurable: true,
    writable: true,
  })
  Object.defineProperty(globalThis, "Notification", {
    value: MockNotification,
    configurable: true,
    writable: true,
  })
}

// Mock next-view-transitions Link for tests (avoids Next runtime resolution issues)
vi.mock("next-view-transitions", async () => {
  const React = await import("react")
  return {
    Link: ({
      href,
      children,
      ...props
    }: {
      href: string
      children: React.ReactNode
      [key: string]: unknown
    }) =>
      React.createElement(
        "a",
        {
          href,
          ...props,
        },
        children
      ),
  }
})

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
  buildCheckInSystemInstruction: vi.fn(() => "Check-in system instruction"),
  // Used by the server-side Live session manager.
  GEMINI_TOOLS: [],
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
// Note: To test the actual implementation, use vi.unmock("@/lib/audio/pcm-converter")
// in your test file (see lib/audio/__tests__/pcm-converter.test.ts for example)
vi.mock("@/lib/audio/pcm-converter", () => ({
  int16ToBase64: vi.fn((_data) => "base64audiodata=="),
  base64ToInt16: vi.fn(() => new Int16Array(1024)),
  float32ToInt16: vi.fn(() => new Int16Array(1024)),
  int16ToFloat32: vi.fn(() => new Float32Array(1024)),
  float32ToBase64Pcm: vi.fn(() => "base64pcmdata=="),
  float32ToWavBase64: vi.fn(() => "UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGFOYQAAADg="),
  calculateRMS: vi.fn(() => 0.5),
  resampleAudio: vi.fn((data) => data),
  base64PcmToFloat32: vi.fn(() => new Float32Array(1024)),
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
  useAudioPlayback: vi.fn(() => [
    {
      state: "ready",
      isReady: true,
      isPlaying: false,
      audioLevel: 0,
      queuedChunks: 0,
      bufferedSamples: 0,
      error: null,
    },
    {
      initialize: vi.fn(async () => {}),
      queueAudio: vi.fn(),
      clearQueue: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      cleanup: vi.fn(),
    },
  ]),
}))
