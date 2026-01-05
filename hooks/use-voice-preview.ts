"use client"

/**
 * useVoicePreview Hook
 *
 * Simple audio playback for voice preview samples.
 * Ensures only one voice plays at a time.
 * Uses HTMLAudioElement for straightforward MP3 playback.
 */

import { useState, useRef, useCallback, useEffect } from "react"
import type { GeminiVoice } from "@/lib/types"
import { getVoicePreviewUrl } from "@/lib/gemini/voices"

export type PreviewState = "idle" | "loading" | "playing" | "error"

export interface UseVoicePreviewReturn {
  /** Currently playing voice (null if none) */
  currentVoice: GeminiVoice | null
  /** State of playback for the current voice */
  state: PreviewState
  /** Play a voice preview (stops any current playback first) */
  play: (voice: GeminiVoice) => void
  /** Stop current playback */
  stop: () => void
  /** Error message if state is "error" */
  error: string | null
}

export function useVoicePreview(): UseVoicePreviewReturn {
  const [currentVoice, setCurrentVoice] = useState<GeminiVoice | null>(null)
  const [state, setState] = useState<PreviewState>("idle")
  const [error, setError] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setCurrentVoice(null)
    setState("idle")
    setError(null)
  }, [])

  const play = useCallback((voice: GeminiVoice) => {
    // Stop any current playback
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    setCurrentVoice(voice)
    setState("loading")
    setError(null)

    const url = getVoicePreviewUrl(voice)
    const audio = new Audio(url)
    audioRef.current = audio

    audio.oncanplaythrough = () => {
      setState("playing")
      audio.play().catch((err) => {
        setState("error")
        setError(err.message)
      })
    }

    audio.onended = () => {
      setCurrentVoice(null)
      setState("idle")
    }

    audio.onerror = () => {
      setState("error")
      setError("Voice sample not available")
    }

    // Start loading
    audio.load()
  }, [])

  return {
    currentVoice,
    state,
    play,
    stop,
    error,
  }
}
