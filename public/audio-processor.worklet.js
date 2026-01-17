/**
 * AudioWorklet processor for capturing microphone audio
 * Replaces deprecated ScriptProcessorNode
 */
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.isRecording = true

    // Handle messages from main thread
    this.port.onmessage = (event) => {
      if (event.data === "stop") {
        this.isRecording = false
      }
    }
  }

  process(inputs, _outputs, _parameters) {
    const input = inputs[0]

    // Check if we have input data
    if (input && input[0] && input[0].length > 0) {
      // Clone the data before posting (AudioWorklet uses shared buffers)
      const chunk = new Float32Array(input[0])
      this.port.postMessage(chunk)
    }

    // Return true to keep processor alive, false when done recording
    return this.isRecording
  }
}

registerProcessor("audio-processor", AudioProcessor)
