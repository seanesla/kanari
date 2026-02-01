"use client"

import { useCallback, useEffect, useRef } from "react"
import type { Dispatch } from "react"
import { int16ToBase64 } from "@/lib/audio/pcm-converter"
import { KanariError } from "@/lib/errors"
import { logDebug, logWarn } from "@/lib/logger"
import type { CheckInState } from "@/lib/types"
import type { CheckInAction } from "./use-check-in-messages"

export interface UseCheckInAudioOptions {
  dispatch: Dispatch<CheckInAction>
  sendAudio: (base64Audio: string) => void
  /**
   * Used for barge-in: when the assistant is speaking, detect if the user starts talking.
   * If so, call `onUserBargeIn` to stop assistant playback and allow mic audio through.
   */
  getCheckInState?: () => CheckInState
  onUserBargeIn?: () => void
}

export interface UseCheckInAudioResult {
  initializeAudioCapture: () => Promise<void>
  cleanupAudioCapture: () => void
  toggleMute: () => void
  resetAudioChunks: () => void
  drainAudioChunks: () => Float32Array[]
  resetCleanupRequestedFlag: () => void
  /** Get all audio accumulated during the session (for playback/final analysis) */
  getSessionAudio: () => Float32Array | null
}

type ChunkBuffer = {
  chunks: Float32Array[]
  startIndex: number
}

function safeGetWindowContext(): {
  isSecureContext: boolean | undefined
  origin: string | undefined
  inIframe: boolean | undefined
} {
  if (typeof window === "undefined") {
    return { isSecureContext: undefined, origin: undefined, inIframe: undefined }
  }

  let inIframe: boolean | undefined
  try {
    // Accessing window.top can throw in some cross-origin iframe cases.
    inIframe = window.self !== window.top
  } catch {
    inIframe = true
  }

  return {
    isSecureContext: typeof window.isSecureContext === "boolean" ? window.isSecureContext : undefined,
    origin: typeof window.location?.origin === "string" ? window.location.origin : undefined,
    inIframe,
  }
}

function getMediaErrorName(error: unknown): string | undefined {
  if (error && typeof error === "object" && "name" in error && typeof (error as { name?: unknown }).name === "string") {
    const name = (error as { name: string }).name
    if (name && name !== "Error") return name
  }

  // Some tests (and some userland mocks) reject with Error("NotAllowedError").
  if (error instanceof Error && typeof error.message === "string" && error.message.endsWith("Error")) {
    return error.message
  }

  return undefined
}

function toAudioCaptureInitError(error: unknown): Error {
  const errorMessage = error instanceof Error ? error.message : "Unknown error"
  const errorName = getMediaErrorName(error)
  const ctx = safeGetWindowContext()

  // If we're not in a secure context, getUserMedia is blocked regardless of permissions.
  // This commonly happens on iOS/Android when loading the dev server from a LAN IP over http.
  if (ctx.isSecureContext === false) {
    return new KanariError(
      "Microphone access is blocked because this page is not running in a secure context. Use https (or http://localhost), then try again.",
      "MIC_INSECURE_CONTEXT",
      {
        origin: ctx.origin,
        isSecureContext: ctx.isSecureContext,
        inIframe: ctx.inIframe,
        errorName,
        errorMessage,
      }
    )
  }

  if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
    return new KanariError(
      "Microphone access was blocked. Allow microphone permissions for this site (browser lock icon → Site settings → Microphone), then try again.",
      "MIC_PERMISSION_DENIED",
      {
        origin: ctx.origin,
        isSecureContext: ctx.isSecureContext,
        inIframe: ctx.inIframe,
        errorName,
        errorMessage,
      }
    )
  }

  if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
    return new KanariError(
      "No microphone was found. Plug in a mic/headset (or enable one) and try again.",
      "MIC_NOT_FOUND",
      {
        origin: ctx.origin,
        isSecureContext: ctx.isSecureContext,
        inIframe: ctx.inIframe,
        errorName,
        errorMessage,
      }
    )
  }

  if (errorName === "NotReadableError" || errorName === "TrackStartError") {
    return new KanariError(
      "Your microphone is busy or unavailable (another tab/app may be using it). Close other apps using the mic and try again.",
      "MIC_NOT_READABLE",
      {
        origin: ctx.origin,
        isSecureContext: ctx.isSecureContext,
        inIframe: ctx.inIframe,
        errorName,
        errorMessage,
      }
    )
  }

  if (errorName === "SecurityError") {
    return new KanariError(
      "Microphone access was blocked by the browser security policy. Make sure the page is top-level (not embedded) and running on https, then try again.",
      "MIC_SECURITY_ERROR",
      {
        origin: ctx.origin,
        isSecureContext: ctx.isSecureContext,
        inIframe: ctx.inIframe,
        errorName,
        errorMessage,
      }
    )
  }

  if (errorName === "OverconstrainedError") {
    return new KanariError(
      "Your browser could not satisfy the requested microphone settings. Try a different input device and try again.",
      "MIC_OVERCONSTRAINED",
      {
        origin: ctx.origin,
        isSecureContext: ctx.isSecureContext,
        inIframe: ctx.inIframe,
        errorName,
        errorMessage,
      }
    )
  }

  return new KanariError(
    `Failed to initialize microphone audio capture: ${errorMessage}`,
    "MIC_INIT_FAILED",
    {
      origin: ctx.origin,
      isSecureContext: ctx.isSecureContext,
      inIframe: ctx.inIframe,
      errorName,
      errorMessage,
    }
  )
}

export function useCheckInAudio(options: UseCheckInAudioOptions): UseCheckInAudioResult {
  const { dispatch, sendAudio, getCheckInState, onUserBargeIn } = options

  // Audio capture refs
  const audioContextRef = useRef<AudioContext | null>(null)
  const captureWorkletRef = useRef<AudioWorkletNode | null>(null)
  const captureSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const captureScriptProcessorRef = useRef<ScriptProcessorNode | null>(null)
  const captureSilenceGainRef = useRef<GainNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  // Avoid O(n) Array.shift() when enforcing a max chunk count.
  // We keep a start index and periodically compact.
  const audioChunksRef = useRef<ChunkBuffer>({ chunks: [], startIndex: 0 })
  // Session-level audio buffer (accumulates ALL audio for playback/final analysis)
  const sessionAudioRef = useRef<Float32Array[]>([])

  // Flag to handle race condition: if cleanup is requested during async initialization,
  // the stream obtained from getUserMedia should be stopped immediately
  // See: docs/error-patterns/check-in-audio-cleanup-abort-flag.md
  const cleanupRequestedRef = useRef(false)

  // Counter to track current initialization. If multiple initializations overlap
  // (e.g., due to Fast Refresh), only the most recent one should proceed.
  // Older initializations will see a different ID and abort.
  const initializationIdRef = useRef(0)

  // Throttle ref for audio level dispatches (60ms interval)
  const lastAudioLevelDispatchRef = useRef<number>(0)
  const AUDIO_LEVEL_THROTTLE_MS = 60

  // ============================================
  // Local barge-in detection (simple energy VAD)
  // ============================================

  // When the assistant is speaking, we still capture mic audio but we normally
  // don't forward it to Gemini (half-duplex). To support "barge-in" (user starts
  // talking to interrupt), we detect loud mic input locally and trigger an interrupt.
  //
  // This is intentionally simple: if we see N consecutive chunks above a threshold,
  // treat it as the user starting to speak.
  const bargeInTriggeredRef = useRef(false)
  const bargeInConsecutiveRef = useRef(0)
  const BARGE_IN_LEVEL_THRESHOLD = 0.08 // 0-1 (matches UI scaling)
  const BARGE_IN_CONSECUTIVE_CHUNKS = 2 // ~256ms at 2048 samples / 16kHz

  // Max audio chunks to prevent memory leak (roughly 10 seconds at 100ms chunks)
  const MAX_AUDIO_CHUNKS = 1000

  const resetAudioChunks = useCallback(() => {
    audioChunksRef.current = { chunks: [], startIndex: 0 }
  }, [])

  const drainAudioChunks = useCallback(() => {
    const { chunks, startIndex } = audioChunksRef.current
    const drained = startIndex > 0 ? chunks.slice(startIndex) : chunks
    audioChunksRef.current = { chunks: [], startIndex: 0 }
    return drained
  }, [])

  const getSessionAudio = useCallback(() => {
    const chunks = sessionAudioRef.current
    if (chunks.length === 0) return null

    // Concatenate all chunks into a single Float32Array
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0)
    const audioData = new Float32Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      audioData.set(chunk, offset)
      offset += chunk.length
    }
    return audioData
  }, [])

  const resetCleanupRequestedFlag = useCallback(() => {
    cleanupRequestedRef.current = false
  }, [])

  const initializeAudioCapture = useCallback(async () => {
    // Capture the current initialization ID - if this changes during async operations,
    // it means a newer initialization has started and we should abort
    const currentInitId = ++initializationIdRef.current

    // Helper to check abort reason
    const getAbortReason = (): "cleanup" | "superseded" | null => {
      if (cleanupRequestedRef.current) return "cleanup"
      if (initializationIdRef.current !== currentInitId) return "superseded"
      return null
    }

    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new KanariError(
          "Microphone capture is not supported in this browser.",
          "MIC_UNSUPPORTED",
          safeGetWindowContext()
        )
      }

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      // Check if we should abort after getUserMedia resolved
      const abortReason = getAbortReason()
      if (abortReason) {
        logDebug("useCheckIn", `Initialization aborted after getUserMedia (${abortReason})`)
        stream.getTracks().forEach((track) => track.stop())
        // Use different error for superseded vs cleanup
        throw new Error(abortReason === "superseded" ? "SESSION_SUPERSEDED" : "INITIALIZATION_ABORTED")
      }

      mediaStreamRef.current = stream

      // Create audio context at 16kHz
      const audioContext = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioContext

      // Resume if suspended
      if (audioContext.state === "suspended") {
        await audioContext.resume()
      }

      // Check abort conditions after resume
      const abortAfterResume = getAbortReason()
      if (abortAfterResume) {
        logDebug("useCheckIn", `Initialization aborted after audioContext.resume (${abortAfterResume})`)
        stream.getTracks().forEach((track) => track.stop())
        mediaStreamRef.current = null
        // Check if context isn't already closed (e.g., by concurrent cleanup)
        // See: docs/error-patterns/audiocontext-double-close.md
        if (audioContext.state !== "closed") {
          audioContext.close()
        }
        audioContextRef.current = null
        throw new Error(abortAfterResume === "superseded" ? "SESSION_SUPERSEDED" : "INITIALIZATION_ABORTED")
      }

      // Also check if context was closed (e.g., by cleanup running during resume)
      if ((audioContext.state as string) === "closed") {
        logDebug("useCheckIn", "AudioContext closed during initialization; aborting")
        stream.getTracks().forEach((track) => track.stop())
        mediaStreamRef.current = null
        throw new Error("INITIALIZATION_ABORTED")
      }

      const source = audioContext.createMediaStreamSource(stream)
      captureSourceRef.current = source

      const workletSupported =
        typeof AudioWorkletNode !== "undefined" &&
        typeof (audioContext as unknown as { audioWorklet?: { addModule?: unknown } }).audioWorklet
          ?.addModule === "function"

      // AudioWorklet is missing on some Safari/iOS builds and in some contexts (e.g. non-secure origins).
      // Pattern doc: docs/error-patterns/safari-audioworklet-missing.md
      // Fall back to ScriptProcessorNode so check-ins still work.
      if (!workletSupported) {
        logWarn("useCheckIn", "AudioWorklet not supported; falling back to ScriptProcessorNode")
        if (typeof audioContext.createScriptProcessor !== "function") {
          throw new Error(
            "Audio capture not supported in this browser (missing AudioWorklet + ScriptProcessorNode)"
          )
        }

        const processor = audioContext.createScriptProcessor(2048, 1, 1)
        const silence = audioContext.createGain()
        silence.gain.value = 0

        captureScriptProcessorRef.current = processor
        captureSilenceGainRef.current = silence

        processor.onaudioprocess = (event) => {
          const input = event.inputBuffer.getChannelData(0)
          if (!input || input.length === 0) return

          let sumSquares = 0
          const float32Data = new Float32Array(input.length)
          const int16Data = new Int16Array(input.length)

          for (let i = 0; i < input.length; i++) {
            const sample = Math.max(-1, Math.min(1, input[i] ?? 0))
            float32Data[i] = sample
            sumSquares += sample * sample
            int16Data[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
          }

          const rms = Math.sqrt(sumSquares / Math.max(1, float32Data.length))
          const inputLevel = Math.min(rms * 5, 1)

          const state = getCheckInState?.()
          const assistantSpeaking = state === "assistant_speaking" || state === "ai_greeting"
          if (!assistantSpeaking) {
            bargeInTriggeredRef.current = false
            bargeInConsecutiveRef.current = 0
          } else if (onUserBargeIn && getCheckInState) {
            if (!bargeInTriggeredRef.current) {
              if (inputLevel >= BARGE_IN_LEVEL_THRESHOLD) {
                bargeInConsecutiveRef.current += 1
              } else {
                bargeInConsecutiveRef.current = 0
              }

              if (bargeInConsecutiveRef.current >= BARGE_IN_CONSECUTIVE_CHUNKS) {
                bargeInTriggeredRef.current = true
                bargeInConsecutiveRef.current = 0
                onUserBargeIn()
              }
            }
          }

          const base64Audio = int16ToBase64(int16Data)
          sendAudio(base64Audio)

          const chunkBuffer = audioChunksRef.current
          chunkBuffer.chunks.push(float32Data)
          if (chunkBuffer.chunks.length - chunkBuffer.startIndex > MAX_AUDIO_CHUNKS) {
            chunkBuffer.startIndex += 1

            if (
              chunkBuffer.startIndex > 128 &&
              chunkBuffer.startIndex * 2 > chunkBuffer.chunks.length
            ) {
              chunkBuffer.chunks = chunkBuffer.chunks.slice(chunkBuffer.startIndex)
              chunkBuffer.startIndex = 0
            }
          }

          sessionAudioRef.current.push(float32Data)

          const now = Date.now()
          if (now - lastAudioLevelDispatchRef.current >= AUDIO_LEVEL_THROTTLE_MS) {
            dispatch({ type: "SET_INPUT_LEVEL", level: inputLevel })
            lastAudioLevelDispatchRef.current = now
          }
        }

        source.connect(processor)
        processor.connect(silence)
        silence.connect(audioContext.destination)

        return
      }

      // Load capture worklet
      await audioContext.audioWorklet.addModule("/capture.worklet.js")

      // Check abort conditions after module loading
      const abortAfterModule = getAbortReason()
      if (abortAfterModule) {
        logDebug("useCheckIn", `Initialization aborted after addModule (${abortAfterModule})`)
        stream.getTracks().forEach((track) => track.stop())
        mediaStreamRef.current = null
        // Check if context isn't already closed (e.g., by concurrent cleanup)
        // See: docs/error-patterns/audiocontext-double-close.md
        if (audioContext.state !== "closed") {
          audioContext.close()
        }
        audioContextRef.current = null
        throw new Error(abortAfterModule === "superseded" ? "SESSION_SUPERSEDED" : "INITIALIZATION_ABORTED")
      }

      // Also check if context was closed during module loading
      if ((audioContext.state as string) === "closed") {
        logDebug("useCheckIn", "AudioContext closed during module loading; aborting")
        stream.getTracks().forEach((track) => track.stop())
        mediaStreamRef.current = null
        throw new Error("INITIALIZATION_ABORTED")
      }

      // Create worklet node
      const captureWorklet = new AudioWorkletNode(audioContext, "capture-processor")

      // Connect microphone to worklet
      source.connect(captureWorklet)

      // Handle audio chunks from worklet
      captureWorklet.port.onmessage = (event) => {
        if (event.data.type === "audio") {
          const pcmBuffer = event.data.pcm as ArrayBuffer
          const int16Data = new Int16Array(pcmBuffer)

          // Convert to Float32 for local analysis + storage, and compute RMS in the same pass.
          let sumSquares = 0
          const float32Data = new Float32Array(int16Data.length)
          for (let i = 0; i < int16Data.length; i++) {
            const v = int16Data[i] / (int16Data[i] < 0 ? 0x8000 : 0x7fff)
            float32Data[i] = v
            sumSquares += v * v
          }
          const rms = Math.sqrt(sumSquares / Math.max(1, float32Data.length))
          const inputLevel = Math.min(rms * 5, 1)

          // Barge-in: if the assistant is speaking and the user starts talking,
          // trigger an interrupt BEFORE we forward this chunk.
          const state = getCheckInState?.()
          const assistantSpeaking = state === "assistant_speaking" || state === "ai_greeting"
          if (!assistantSpeaking) {
            bargeInTriggeredRef.current = false
            bargeInConsecutiveRef.current = 0
          } else if (onUserBargeIn && getCheckInState) {
            if (!bargeInTriggeredRef.current) {
              if (inputLevel >= BARGE_IN_LEVEL_THRESHOLD) {
                bargeInConsecutiveRef.current += 1
              } else {
                bargeInConsecutiveRef.current = 0
              }

              if (bargeInConsecutiveRef.current >= BARGE_IN_CONSECUTIVE_CHUNKS) {
                bargeInTriggeredRef.current = true
                bargeInConsecutiveRef.current = 0
                onUserBargeIn()
              }
            }
          }

          // Convert to base64 and send to Gemini
          const base64Audio = int16ToBase64(int16Data)
          sendAudio(base64Audio)

          // Prevent unbounded growth if VAD fails to trigger an utterance drain.
          // Keep only the most recent MAX_AUDIO_CHUNKS, without O(n) shifts.
          const chunkBuffer = audioChunksRef.current
          chunkBuffer.chunks.push(float32Data)
          if (chunkBuffer.chunks.length - chunkBuffer.startIndex > MAX_AUDIO_CHUNKS) {
            chunkBuffer.startIndex += 1

            // Periodically compact to prevent the backing array from growing forever.
            // (Only happens in pathological cases where drainAudioChunks isn't called.)
            if (
              chunkBuffer.startIndex > 128 &&
              chunkBuffer.startIndex * 2 > chunkBuffer.chunks.length
            ) {
              chunkBuffer.chunks = chunkBuffer.chunks.slice(chunkBuffer.startIndex)
              chunkBuffer.startIndex = 0
            }
          }

          // Also store in session buffer (for playback and final analysis)
          sessionAudioRef.current.push(float32Data)

          // Calculate input level for visualization (throttled to reduce re-renders)
          const now = Date.now()
          if (now - lastAudioLevelDispatchRef.current >= AUDIO_LEVEL_THROTTLE_MS) {
            dispatch({ type: "SET_INPUT_LEVEL", level: inputLevel })
            lastAudioLevelDispatchRef.current = now
          }
        }
      }

      captureWorkletRef.current = captureWorklet
    } catch (error) {
      // Re-throw abort errors directly so startSession can handle them appropriately
      if (
        error instanceof Error &&
        (error.message === "INITIALIZATION_ABORTED" || error.message === "SESSION_SUPERSEDED")
      ) {
        throw error
      }

      // Preserve stable codes for known/user-facing errors.
      if (error instanceof KanariError) {
        throw error
      }

      // Pattern doc: docs/error-patterns/microphone-permission-notallowed.md
      throw toAudioCaptureInitError(error)
    }
  }, [dispatch, sendAudio])

  const cleanupAudioCapture = useCallback(() => {
    // Mark cleanup as requested - this handles the race condition where
    // getUserMedia might resolve AFTER cleanup is called
    cleanupRequestedRef.current = true

    // Stop microphone
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        track.stop()
        // Verify track is actually stopped
        if (track.readyState !== "ended") {
          console.warn("[useCheckIn] Track not stopped after .stop():", track.readyState)
        }
      })
      mediaStreamRef.current = null
    }

    // Clear message handler before disconnect (prevents memory leaks)
    if (captureWorkletRef.current) {
      captureWorkletRef.current.port.onmessage = null
      captureWorkletRef.current.disconnect()
      captureWorkletRef.current = null
    }

    if (captureScriptProcessorRef.current) {
      captureScriptProcessorRef.current.onaudioprocess = null
      captureScriptProcessorRef.current.disconnect()
      captureScriptProcessorRef.current = null
    }

    if (captureSilenceGainRef.current) {
      captureSilenceGainRef.current.disconnect()
      captureSilenceGainRef.current = null
    }

    if (captureSourceRef.current) {
      if (typeof (captureSourceRef.current as unknown as { disconnect?: unknown }).disconnect === "function") {
        captureSourceRef.current.disconnect()
      }
      captureSourceRef.current = null
    }

    // Close audio context if not already closed
    // See: docs/error-patterns/audiocontext-double-close.md
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close()
    }
    audioContextRef.current = null

    audioChunksRef.current = { chunks: [], startIndex: 0 }
    sessionAudioRef.current = []
  }, [])

  const toggleMute = useCallback(() => {
    if (!mediaStreamRef.current) {
      console.warn("[useCheckIn] Cannot toggle mute: no media stream")
      return
    }

    const audioTrack = mediaStreamRef.current.getAudioTracks()[0]
    if (!audioTrack) {
      console.warn("[useCheckIn] Cannot toggle mute: no audio track")
      return
    }

    // Toggle the track's enabled state
    audioTrack.enabled = !audioTrack.enabled
    dispatch({ type: "SET_MUTED", muted: !audioTrack.enabled })
  }, [dispatch])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudioCapture()
    }
  }, [cleanupAudioCapture])

  return {
    initializeAudioCapture,
    cleanupAudioCapture,
    toggleMute,
    resetAudioChunks,
    drainAudioChunks,
    resetCleanupRequestedFlag,
    getSessionAudio,
  }
}
