/**
 * PCM Audio Conversion Utilities
 *
 * Converts between Float32Array (Web Audio API format) and Int16 PCM
 * (Gemini Live API format) for audio streaming.
 *
 * Gemini Live API requirements:
 * - Input: PCM 16-bit, 16kHz mono
 * - Output: PCM 16-bit, 24kHz mono
 *
 * Source: Context7 - /websites/ai_google_dev_gemini-api docs - "Audio streaming format"
 * https://ai.google.dev/gemini-api/docs/live
 */

/**
 * Convert Float32Array (-1.0 to 1.0) to Int16 PCM array
 * Used for sending audio to Gemini Live API
 *
 * @param float32Data - Audio samples in Float32 format (-1.0 to 1.0)
 * @returns Int16Array with PCM samples
 */
export function float32ToInt16(float32Data: Float32Array): Int16Array {
  const int16Data = new Int16Array(float32Data.length)

  for (let i = 0; i < float32Data.length; i++) {
    // Clamp to [-1, 1] range
    const sample = Math.max(-1, Math.min(1, float32Data[i]))
    // Convert to Int16 range [-32768, 32767]
    int16Data[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
  }

  return int16Data
}

/**
 * Convert Int16 PCM array to Float32Array (-1.0 to 1.0)
 * Used for playing audio received from Gemini Live API
 *
 * @param int16Data - Audio samples in Int16 PCM format
 * @returns Float32Array with normalized samples (-1.0 to 1.0)
 */
export function int16ToFloat32(int16Data: Int16Array): Float32Array {
  const float32Data = new Float32Array(int16Data.length)

  for (let i = 0; i < int16Data.length; i++) {
    // Convert from Int16 range to [-1, 1] range
    float32Data[i] = int16Data[i] / (int16Data[i] < 0 ? 0x8000 : 0x7fff)
  }

  return float32Data
}

/**
 * Convert Int16 PCM ArrayBuffer to base64 string
 * Used for sending audio data over WebSocket to Gemini
 *
 * @param int16Data - Int16Array of PCM samples
 * @returns Base64 encoded string
 */
export function int16ToBase64(int16Data: Int16Array): string {
  const uint8Array = new Uint8Array(int16Data.buffer)
  let binary = ""

  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i])
  }

  return btoa(binary)
}

// Maximum base64 string length to prevent denial of service (1MB of audio)
const MAX_BASE64_LENGTH = 1024 * 1024 * 1.37 // ~1MB encoded

// Base64 validation regex (standard alphabet + padding)
const BASE64_REGEX = /^[A-Za-z0-9+/]*={0,2}$/

/**
 * Validate and decode base64 string
 * Throws descriptive errors on invalid input
 */
function validateAndDecodeBase64(base64: string): string {
  // Check for empty or invalid input
  if (!base64 || typeof base64 !== "string") {
    throw new Error("Invalid base64: input is empty or not a string")
  }

  // Check length to prevent DoS
  if (base64.length > MAX_BASE64_LENGTH) {
    throw new Error(`Invalid base64: input too large (max ${MAX_BASE64_LENGTH} chars)`)
  }

  // Check for valid base64 characters
  if (!BASE64_REGEX.test(base64)) {
    throw new Error("Invalid base64: contains invalid characters")
  }

  // Attempt decode
  try {
    return atob(base64)
  } catch (error) {
    throw new Error(`Invalid base64: ${error instanceof Error ? error.message : "decode failed"}`)
  }
}

/**
 * Convert base64 string to Int16 PCM array
 * Used for receiving audio data from Gemini
 *
 * @param base64 - Base64 encoded PCM audio
 * @returns Int16Array of PCM samples
 * @throws Error if base64 is invalid or too large
 */
export function base64ToInt16(base64: string): Int16Array {
  const binary = validateAndDecodeBase64(base64)

  // Ensure even length for Int16 alignment
  if (binary.length % 2 !== 0) {
    console.warn("[PCM] Base64 decoded to odd byte count, truncating last byte")
  }

  const alignedLength = Math.floor(binary.length / 2) * 2
  const uint8Array = new Uint8Array(alignedLength)

  for (let i = 0; i < alignedLength; i++) {
    uint8Array[i] = binary.charCodeAt(i)
  }

  return new Int16Array(uint8Array.buffer)
}

/**
 * Convert Float32Array to base64 PCM string (convenience function)
 * Combines float32ToInt16 and int16ToBase64
 *
 * @param float32Data - Audio samples in Float32 format
 * @returns Base64 encoded PCM string ready for Gemini
 */
export function float32ToBase64Pcm(float32Data: Float32Array): string {
  const int16Data = float32ToInt16(float32Data)
  return int16ToBase64(int16Data)
}

/**
 * Convert base64 PCM string to Float32Array (convenience function)
 * Combines base64ToInt16 and int16ToFloat32
 *
 * @param base64 - Base64 encoded PCM audio from Gemini
 * @returns Float32Array ready for Web Audio API playback
 */
export function base64PcmToFloat32(base64: string): Float32Array {
  const int16Data = base64ToInt16(base64)
  return int16ToFloat32(int16Data)
}

/**
 * Resample audio from one sample rate to another using linear interpolation
 * Used to convert between 16kHz (input) and 24kHz (output) for Gemini
 *
 * @param audioData - Input audio samples
 * @param fromSampleRate - Source sample rate (e.g., 24000)
 * @param toSampleRate - Target sample rate (e.g., 16000)
 * @returns Resampled audio data
 */
export function resampleAudio(
  audioData: Float32Array,
  fromSampleRate: number,
  toSampleRate: number
): Float32Array {
  if (fromSampleRate === toSampleRate) {
    return audioData
  }

  const ratio = fromSampleRate / toSampleRate
  const newLength = Math.round(audioData.length / ratio)
  const result = new Float32Array(newLength)

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio
    const srcIndexFloor = Math.floor(srcIndex)
    const srcIndexCeil = Math.min(srcIndexFloor + 1, audioData.length - 1)
    const fraction = srcIndex - srcIndexFloor

    // Linear interpolation
    result[i] = audioData[srcIndexFloor] * (1 - fraction) + audioData[srcIndexCeil] * fraction
  }

  return result
}

/**
 * Calculate RMS (Root Mean Square) energy of audio data
 * Useful for detecting speech activity and audio levels
 *
 * @param audioData - Audio samples
 * @returns RMS value (0 to 1 range for normalized audio)
 */
export function calculateRMS(audioData: Float32Array): number {
  if (audioData.length === 0) return 0

  let sum = 0
  for (let i = 0; i < audioData.length; i++) {
    sum += audioData[i] * audioData[i]
  }

  return Math.sqrt(sum / audioData.length)
}

/**
 * Encode Float32Array audio data as WAV file and return as base64
 * Used for sending audio to Gemini API for semantic analysis
 *
 * @param audioData - Audio samples in Float32 format (-1.0 to 1.0)
 * @param sampleRate - Sample rate of the audio (default: 16000)
 * @returns Base64 encoded WAV file
 */
export function float32ToWavBase64(audioData: Float32Array, sampleRate: number = 16000): string {
  // Convert Float32 to Int16
  const int16Data = float32ToInt16(audioData)

  // WAV file parameters
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = int16Data.length * 2 // 2 bytes per Int16 sample
  const fileSize = 36 + dataSize // 44 byte header - 8 bytes for RIFF header

  // Create WAV buffer (44 byte header + audio data)
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  // RIFF header
  writeString(view, 0, "RIFF")
  view.setUint32(4, fileSize, true) // File size - 8
  writeString(view, 8, "WAVE")

  // fmt chunk
  writeString(view, 12, "fmt ")
  view.setUint32(16, 16, true) // Chunk size (16 for PCM)
  view.setUint16(20, 1, true) // Audio format (1 = PCM)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)

  // data chunk
  writeString(view, 36, "data")
  view.setUint32(40, dataSize, true)

  // Write audio samples
  const int16View = new Int16Array(buffer, 44)
  int16View.set(int16Data)

  // Convert to base64
  const uint8Array = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i])
  }

  return btoa(binary)
}

/**
 * Helper to write ASCII string to DataView
 */
function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
