"use client"

/**
 * Audio Pipeline Module
 *
 * Complete audio processing pipeline for voice biomarker extraction:
 * 1. Recording - Web Audio API wrapper (recorder.ts)
 * 2. VAD - Voice Activity Detection (vad.ts) - LAZY LOADED to avoid SSR issues
 * 3. Feature Extraction - Acoustic features via Meyda (feature-extractor.ts)
 * 4. Processing - Main orchestrator (processor.ts)
 */

// Recorder
export {
  AudioRecorder,
  isRecordingSupported,
  requestMicrophonePermission,
  type RecorderState,
  type RecorderOptions,
} from "./recorder"

// VAD - Re-export types only, classes are lazy loaded
// Import VAD classes dynamically via: import("@/lib/audio/vad")
export type { VADOptions, SpeechSegment } from "./vad"

// Feature Extractor
export {
  FeatureExtractor,
  extractFeatures,
  type FeatureExtractionOptions,
} from "./feature-extractor"

// Processor
export {
  AudioProcessor,
  processAudio,
  validateAudioData,
  type ProcessorOptions,
  type ProcessingResult,
} from "./processor"

// PCM Converter
export {
  float32ToWavBase64,
  float32ToInt16,
  int16ToFloat32,
  float32ToBase64Pcm,
  calculateRMS,
} from "./pcm-converter"

/**
 * Lazy load VAD module to avoid SSR issues with onnxruntime-web
 * Usage: const { VoiceActivityDetector, segmentSpeech } = await loadVAD()
 */
export async function loadVAD() {
  return import("./vad")
}
