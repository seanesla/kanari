/**
 * AudioWorklet processor for playing back audio from Gemini Live API
 *
 * Receives PCM Int16 audio at 24kHz, converts to Float32,
 * and outputs through Web Audio API.
 *
 * Features:
 * - Buffered playback for smooth audio
 * - Queue management with size limits to prevent memory bloat
 * - Backpressure signaling when queue is full
 * - Handles barge-in (clearing queue when user interrupts)
 */
class PlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super()

    // Audio queue - stores Float32 chunks waiting to be played
    this.queue = []

    // Queue size limits to prevent unbounded memory growth
    // At 24kHz, each chunk is ~1024 samples = ~43ms
    // 150 chunks = ~6.4 seconds of buffer
    this.maxQueueLength = 150
    this.droppedChunks = 0

    // Track sample count incrementally to avoid O(n) calculation
    this.cachedBufferedSamples = 0

    // Current buffer being played
    this.currentBuffer = null
    this.currentIndex = 0

    // State
    this.isPlaying = true

    // Handle messages from main thread
    this.port.onmessage = (event) => {
      // Validate input
      if (!event.data || typeof event.data.type !== "string") {
        return
      }

      if (event.data.type === "audio") {
        // Validate ArrayBuffer
        if (!(event.data.pcm instanceof ArrayBuffer)) {
          console.error("[PlaybackWorklet] Invalid audio buffer")
          return
        }

        // Check queue size limit
        if (this.queue.length >= this.maxQueueLength) {
          // Reject new chunk to maintain playback continuity (don't skip forward)
          this.droppedChunks++

          // Notify main thread of backpressure
          this.port.postMessage({
            type: "queueFull",
            dropped: this.droppedChunks,
            queueLength: this.queue.length,
          })

          return // Don't add to queue - reject to prevent skipping
        }

        // Received audio data - convert Int16 to Float32 and queue
        const int16 = new Int16Array(event.data.pcm)
        if (int16.length === 0) {
          return
        }

        const float32 = this.int16ToFloat32(int16)
        this.queue.push(float32)
        this.cachedBufferedSamples += float32.length

        // Notify main thread of queue status
        this.port.postMessage({
          type: "queueStatus",
          queueLength: this.queue.length,
          bufferedSamples: this.cachedBufferedSamples,
        })
      } else if (event.data.type === "clear") {
        // Clear queue (for barge-in)
        this.queue = []
        this.currentBuffer = null
        this.currentIndex = 0
        this.cachedBufferedSamples = 0

        this.port.postMessage({
          type: "cleared",
        })
      } else if (event.data.type === "stop") {
        this.isPlaying = false
      } else if (event.data.type === "start") {
        this.isPlaying = true
      }
    }
  }

  /**
   * Convert Int16 PCM to Float32 for Web Audio API
   * @param {Int16Array} int16Data - PCM audio samples
   * @returns {Float32Array} - Normalized audio samples
   */
  int16ToFloat32(int16Data) {
    const float32Data = new Float32Array(int16Data.length)

    for (let i = 0; i < int16Data.length; i++) {
      // Convert Int16 range to [-1, 1] range
      float32Data[i] = int16Data[i] / (int16Data[i] < 0 ? 0x8000 : 0x7fff)
    }

    return float32Data
  }

  /**
   * Get total number of samples buffered (in queue + current buffer)
   * Uses cached value for O(1) performance
   * @returns {number} - Total buffered samples
   */
  getBufferedSampleCount() {
    // Use cached count for queue samples
    let count = this.cachedBufferedSamples

    // Add remaining samples in current buffer (not included in cache)
    if (this.currentBuffer) {
      count += this.currentBuffer.length - this.currentIndex
    }

    return count
  }

  /**
   * Process - output audio to speakers
   * @param {Float32Array[][]} inputs - Not used for playback
   * @param {Float32Array[][]} outputs - Output channels to fill
   * @returns {boolean} - Return true to keep processor alive
   */
  process(inputs, outputs) {
    const output = outputs[0]
    if (!output || !output[0] || !this.isPlaying) {
      return true
    }

    const channel = output[0]
    let written = 0
    let notifiedEmpty = false

    // Fill output buffer from queue
    while (written < channel.length) {
      // Get next buffer if current is exhausted
      if (!this.currentBuffer || this.currentIndex >= this.currentBuffer.length) {
        const nextBuffer = this.queue.shift()

        // Update cached count when we take from queue
        if (nextBuffer) {
          this.cachedBufferedSamples -= nextBuffer.length
        }

        this.currentBuffer = nextBuffer
        this.currentIndex = 0

        if (!this.currentBuffer) {
          // No more audio - fill rest with silence
          channel.fill(0, written)

          // Notify main thread that playback buffer is empty
          if (!notifiedEmpty) {
            notifiedEmpty = true
            this.port.postMessage({
              type: "bufferEmpty",
            })
          }
          break
        }
      }

      // Calculate how many samples to copy
      const remaining = this.currentBuffer.length - this.currentIndex
      const toWrite = Math.min(remaining, channel.length - written)

      // Copy samples to output
      for (let i = 0; i < toWrite; i++) {
        channel[written + i] = this.currentBuffer[this.currentIndex + i]
      }

      this.currentIndex += toWrite
      written += toWrite
    }

    // Keep processor alive
    return true
  }
}

registerProcessor("playback-processor", PlaybackProcessor)
