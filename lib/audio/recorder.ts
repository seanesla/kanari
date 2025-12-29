"use client"

export type RecorderState = "idle" | "requesting" | "recording" | "stopping" | "error"

export interface RecorderOptions {
  sampleRate?: number
  channelCount?: number
  onDataAvailable?: (data: Float32Array) => void
  onError?: (error: Error) => void
}

const DEFAULT_SAMPLE_RATE = 16000 // 16kHz for VAD compatibility
const DEFAULT_CHANNEL_COUNT = 1 // Mono

/**
 * AudioRecorder - Web Audio API wrapper for capturing microphone audio
 */
export class AudioRecorder {
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private processorNode: ScriptProcessorNode | null = null
  private audioChunks: Float32Array[] = []

  private state: RecorderState = "idle"
  private options: Required<RecorderOptions>
  private startTime: number = 0

  constructor(options: RecorderOptions = {}) {
    this.options = {
      sampleRate: options.sampleRate ?? DEFAULT_SAMPLE_RATE,
      channelCount: options.channelCount ?? DEFAULT_CHANNEL_COUNT,
      onDataAvailable: options.onDataAvailable ?? (() => {}),
      onError: options.onError ?? (() => {}),
    }
  }

  get currentState(): RecorderState {
    return this.state
  }

  get duration(): number {
    if (this.state !== "recording") return 0
    return (Date.now() - this.startTime) / 1000
  }

  async start(): Promise<void> {
    if (this.state !== "idle") {
      throw new Error(`Cannot start recording in state: ${this.state}`)
    }

    this.state = "requesting"

    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.options.sampleRate,
          channelCount: this.options.channelCount,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      // Create audio context
      this.audioContext = new AudioContext({
        sampleRate: this.options.sampleRate,
      })

      // Create source from stream
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream)

      // Create script processor for capturing audio data
      // Using 4096 buffer size for balance between latency and performance
      const bufferSize = 4096
      this.processorNode = this.audioContext.createScriptProcessor(
        bufferSize,
        this.options.channelCount,
        this.options.channelCount
      )

      // Process audio data
      this.processorNode.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0)
        const chunk = new Float32Array(inputData)
        this.audioChunks.push(chunk)
        this.options.onDataAvailable(chunk)
      }

      // Connect nodes
      this.sourceNode.connect(this.processorNode)
      this.processorNode.connect(this.audioContext.destination)

      this.state = "recording"
      this.startTime = Date.now()
      this.audioChunks = []
    } catch (error) {
      this.state = "error"
      const err = error instanceof Error ? error : new Error("Failed to start recording")
      this.options.onError(err)
      throw err
    }
  }

  async stop(): Promise<Float32Array> {
    if (this.state !== "recording") {
      throw new Error(`Cannot stop recording in state: ${this.state}`)
    }

    this.state = "stopping"

    try {
      // Disconnect and clean up
      if (this.processorNode) {
        this.processorNode.disconnect()
        this.processorNode = null
      }

      if (this.sourceNode) {
        this.sourceNode.disconnect()
        this.sourceNode = null
      }

      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((track) => track.stop())
        this.mediaStream = null
      }

      if (this.audioContext) {
        await this.audioContext.close()
        this.audioContext = null
      }

      // Concatenate all chunks into single buffer
      const totalLength = this.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0)
      const result = new Float32Array(totalLength)

      let offset = 0
      for (const chunk of this.audioChunks) {
        result.set(chunk, offset)
        offset += chunk.length
      }

      this.audioChunks = []
      this.state = "idle"

      return result
    } catch (error) {
      this.state = "error"
      const err = error instanceof Error ? error : new Error("Failed to stop recording")
      this.options.onError(err)
      throw err
    }
  }

  cancel(): void {
    // Stop all tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop())
      this.mediaStream = null
    }

    // Disconnect nodes
    if (this.processorNode) {
      this.processorNode.disconnect()
      this.processorNode = null
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect()
      this.sourceNode = null
    }

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close().catch(() => {})
      this.audioContext = null
    }

    this.audioChunks = []
    this.state = "idle"
  }
}

/**
 * Check if the browser supports audio recording
 */
export function isRecordingSupported(): boolean {
  return !!(
    typeof navigator !== "undefined" &&
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    typeof AudioContext !== "undefined"
  )
}

/**
 * Request microphone permission and return status
 */
export async function requestMicrophonePermission(): Promise<PermissionState> {
  try {
    // Try the Permissions API first
    if (navigator.permissions) {
      const result = await navigator.permissions.query({ name: "microphone" as PermissionName })
      return result.state
    }

    // Fall back to trying to get user media
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((track) => track.stop())
    return "granted"
  } catch {
    return "denied"
  }
}
