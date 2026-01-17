"use client"

import { useCallback, useEffect, useRef } from "react"
import type { Dispatch } from "react"
import { int16ToBase64 } from "@/lib/audio/pcm-converter"
import { logDebug } from "@/lib/logger"
import type { CheckInAction } from "./use-check-in-messages"

export interface UseCheckInAudioOptions {
  dispatch: Dispatch<CheckInAction>
  sendAudio: (base64Audio: string) => void
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

export function useCheckInAudio(options: UseCheckInAudioOptions): UseCheckInAudioResult {
  const { dispatch, sendAudio } = options

  // Audio capture refs
  const audioContextRef = useRef<AudioContext | null>(null)
  const captureWorkletRef = useRef<AudioWorkletNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Float32Array[]>([])
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

  // Max audio chunks to prevent memory leak (roughly 10 seconds at 100ms chunks)
  const MAX_AUDIO_CHUNKS = 1000

  const resetAudioChunks = useCallback(() => {
    audioChunksRef.current = []
  }, [])

  const drainAudioChunks = useCallback(() => {
    const chunks = audioChunksRef.current
    audioChunksRef.current = []
    return chunks
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
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
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
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(captureWorklet)

      // Handle audio chunks from worklet
      captureWorklet.port.onmessage = (event) => {
        if (event.data.type === "audio") {
          const pcmBuffer = event.data.pcm as ArrayBuffer
          const int16Data = new Int16Array(pcmBuffer)

          // Convert to base64 and send to Gemini
          const base64Audio = int16ToBase64(int16Data)
          sendAudio(base64Audio)

          // Also store for mismatch detection and session-level analysis
          const float32Data = new Float32Array(int16Data.length)
          for (let i = 0; i < int16Data.length; i++) {
            float32Data[i] = int16Data[i] / (int16Data[i] < 0 ? 0x8000 : 0x7fff)
          }
          // Prevent memory leak by dropping oldest chunks if at limit
          if (audioChunksRef.current.length >= MAX_AUDIO_CHUNKS) {
            audioChunksRef.current.shift()
          }
          audioChunksRef.current.push(float32Data)
          // Also store in session buffer (for playback and final analysis)
          sessionAudioRef.current.push(float32Data)

          // Calculate input level for visualization (throttled to reduce re-renders)
          const now = Date.now()
          if (now - lastAudioLevelDispatchRef.current >= AUDIO_LEVEL_THROTTLE_MS) {
            let sum = 0
            for (let i = 0; i < float32Data.length; i++) {
              sum += float32Data[i] * float32Data[i]
            }
            const rms = Math.sqrt(sum / float32Data.length)
            dispatch({ type: "SET_INPUT_LEVEL", level: Math.min(rms * 5, 1) })
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
      throw new Error(
        `Failed to initialize audio capture: ${error instanceof Error ? error.message : "Unknown error"}`
      )
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

    // Close audio context if not already closed
    // See: docs/error-patterns/audiocontext-double-close.md
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close()
    }
    audioContextRef.current = null

    audioChunksRef.current = []
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
