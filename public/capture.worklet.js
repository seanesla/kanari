/**
 * AudioWorklet processor for capturing microphone audio
 * and streaming PCM data to Gemini Live API
 *
 * IMPORTANT: This worklet expects to run at 16kHz sample rate.
 * The AudioContext MUST be created with { sampleRate: 16000 }.
 * If the browser doesn't support 16kHz natively, resampling
 * should be handled at the main thread level.
 *
 * Captures mono audio, converts Float32 to Int16 PCM,
 * and sends chunks to main thread for WebSocket transmission.
 */
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()

    // Buffer configuration
    // ~256ms of audio at 16kHz - good balance of latency and efficiency
    this.bufferSize = 4096
    this.buffer = new Float32Array(this.bufferSize)
    this.bufferIndex = 0

    // State
    this.isCapturing = true

    // Handle messages from main thread
    this.port.onmessage = (event) => {
      if (event.data === "stop") {
        this.isCapturing = false
        // Flush any remaining buffer
        if (this.bufferIndex > 0) {
          this.sendBuffer(this.bufferIndex)
        }
        // Clear buffer reference to allow GC
        this.buffer = null
        this.port.close()
      } else if (event.data === "start") {
        this.isCapturing = true
        this.bufferIndex = 0
        // Ensure buffer exists
        if (!this.buffer) {
          this.buffer = new Float32Array(this.bufferSize)
        }
      }
    }
  }

  /**
   * Convert Float32 audio to Int16 PCM and send to main thread
   * @param {number} length - Number of samples to send
   */
  sendBuffer(length) {
    // Create Int16 PCM from Float32 samples
    const pcm = new Int16Array(length)

    for (let i = 0; i < length; i++) {
      // Clamp sample to [-1, 1]
      const sample = Math.max(-1, Math.min(1, this.buffer[i]))
      // Convert to Int16 range
      pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    }

    // Transfer buffer to main thread (transfers ownership for efficiency)
    this.port.postMessage(
      {
        type: "audio",
        pcm: pcm.buffer,
        sampleCount: length,
      },
      [pcm.buffer]
    )
  }

  /**
   * Process incoming audio samples
   * @param {Float32Array[][]} inputs - Input audio channels
   * @returns {boolean} - Return true to keep processor alive
   */
  process(inputs) {
    // Validate inputs array
    if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
      return this.isCapturing
    }

    // Get first input, first channel (mono)
    const input = inputs[0]
    if (!input || !input[0] || !this.isCapturing || !this.buffer) {
      return this.isCapturing
    }

    const samples = input[0]

    // Validate samples
    if (!samples || samples.length === 0) {
      return this.isCapturing
    }

    // Add samples to buffer
    for (let i = 0; i < samples.length && this.isCapturing; i++) {
      this.buffer[this.bufferIndex++] = samples[i]

      // When buffer is full, send it
      if (this.bufferIndex >= this.bufferSize) {
        this.sendBuffer(this.bufferSize)
        // Reset index - REUSE buffer instead of reallocating
        // This avoids GC pressure in the real-time audio thread
        this.bufferIndex = 0
      }
    }

    // Keep processor alive while capturing
    return this.isCapturing
  }
}

registerProcessor("capture-processor", CaptureProcessor)
