"use client"

/**
 * Audio Pipeline Module
 *
 * Complete audio processing pipeline for voice biomarker extraction:
 * 1. Recording - Web Audio API wrapper (recorder.ts)
 * 2. VAD - Voice Activity Detection (vad.ts)
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

// VAD
export {
  VoiceActivityDetector,
  SimpleVAD,
  segmentSpeech,
  type VADOptions,
  type SpeechSegment,
} from "./vad"

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
