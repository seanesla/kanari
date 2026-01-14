"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Play, Pause, RotateCcw } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { formatDuration } from "@/lib/date-utils"
import { logUnexpectedError } from "@/lib/logger"

export interface AudioPlayerProps {
  audioData: Float32Array | number[]
  sampleRate?: number
  duration: number
  onTimeUpdate?: (currentTime: number) => void
  onPlayStateChange?: (isPlaying: boolean) => void
  /** External seek position (0-1 normalized). When set, audio seeks to this position. */
  seekPosition?: number
  className?: string
}

export function AudioPlayer({
  audioData,
  sampleRate = 16000,
  duration,
  onTimeUpdate,
  onPlayStateChange,
  seekPosition,
  className,
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [isReady, setIsReady] = useState(false)

  const audioContextRef = useRef<AudioContext | null>(null)
  const audioBufferRef = useRef<AudioBuffer | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)
  const startTimeRef = useRef<number>(0)
  const pauseOffsetRef = useRef<number>(0)
  const animationFrameRef = useRef<number>(0)
  const isPlayingRef = useRef(false) // Track isPlaying for closures

  // Keep ref in sync with state for closures
  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  const stopCurrentSource = useCallback(() => {
    const source = sourceNodeRef.current
    if (!source) return

    // Prevent `onended` from resetting state for manual stops (pause/seek/restart).
    // Pattern doc: docs/error-patterns/audio-player-seek-resets-onended.md
    source.onended = null

    try {
      source.stop()
    } catch (error) {
      logUnexpectedError("AudioPlayer", "Unexpected error stopping source:", error)
    } finally {
      sourceNodeRef.current = null
    }
  }, [])

  // Initialize audio context and buffer
  useEffect(() => {
    const initAudio = async () => {
      try {
        // Create audio context
        const ctx = new AudioContext({ sampleRate })
        audioContextRef.current = ctx

        // Create Float32Array with our own ArrayBuffer (required by copyToChannel)
        // Note: buffer.slice() is more efficient than Array.from() intermediate copy
        // Type assertion needed because slice() of ArrayBufferLike returns ArrayBuffer | SharedArrayBuffer
        // but we know ArrayBuffer.slice() always returns ArrayBuffer
        const samples = audioData instanceof Float32Array
          ? new Float32Array(audioData.buffer.slice(
              audioData.byteOffset,
              audioData.byteOffset + audioData.byteLength
            ) as ArrayBuffer)
          : new Float32Array(audioData)

        // Create audio buffer
        const buffer = ctx.createBuffer(1, samples.length, sampleRate)
        buffer.copyToChannel(samples, 0)
        audioBufferRef.current = buffer

        setIsReady(true)
      } catch (error) {
        console.error("Failed to initialize audio:", error)
      }
    }

    initAudio()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      stopCurrentSource()
      // Close audio context if not already closed
      // See: docs/error-patterns/audiocontext-double-close.md
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close()
      }
    }
  }, [audioData, sampleRate, stopCurrentSource])

  // Update time display during playback
  const updateTime = useCallback(() => {
    if (!audioContextRef.current || !isPlaying) return

    const elapsed = audioContextRef.current.currentTime - startTimeRef.current
    const newTime = Math.min(pauseOffsetRef.current + elapsed, duration)
    setCurrentTime(newTime)
    onTimeUpdate?.(newTime)

    if (newTime >= duration) {
      // Playback ended
      setIsPlaying(false)
      onPlayStateChange?.(false)
      pauseOffsetRef.current = 0
      setCurrentTime(0)
      onTimeUpdate?.(0)
    } else {
      animationFrameRef.current = requestAnimationFrame(updateTime)
    }
  }, [isPlaying, duration, onTimeUpdate, onPlayStateChange])

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateTime)
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isPlaying, updateTime])

  const play = useCallback(async () => {
    if (!audioContextRef.current || !audioBufferRef.current || !isReady) return

    const ctx = audioContextRef.current

    // Resume context if suspended (must await for audio to work)
    if (ctx.state === "suspended") {
      await ctx.resume()
    }

    stopCurrentSource()

    // Create new source node
    const source = ctx.createBufferSource()
    source.buffer = audioBufferRef.current
    source.connect(ctx.destination)

    // Handle playback end (use ref to avoid stale closure)
    source.onended = () => {
      if (sourceNodeRef.current !== source) return
      sourceNodeRef.current = null

      if (isPlayingRef.current) {
        setIsPlaying(false)
        onPlayStateChange?.(false)
        pauseOffsetRef.current = 0
        setCurrentTime(0)
        onTimeUpdate?.(0)
      }
    }

    sourceNodeRef.current = source
    startTimeRef.current = ctx.currentTime

    // Start from offset with defensive bounds check
    const offset = Math.max(0, Math.min(pauseOffsetRef.current, duration))
    source.start(0, offset)
    setIsPlaying(true)
    onPlayStateChange?.(true)
  }, [isReady, duration, onPlayStateChange, onTimeUpdate, stopCurrentSource])

  const pause = useCallback(() => {
    if (!audioContextRef.current || !sourceNodeRef.current) return

    // Save current position with bounds checking
    const elapsed = audioContextRef.current.currentTime - startTimeRef.current
    pauseOffsetRef.current = Math.max(0, Math.min(pauseOffsetRef.current + elapsed, duration))

    stopCurrentSource()

    setIsPlaying(false)
    onPlayStateChange?.(false)
  }, [duration, onPlayStateChange, stopCurrentSource])

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause()
    } else {
      play()
    }
  }, [isPlaying, play, pause])

  const reset = useCallback(() => {
    if (isPlaying) {
      pause()
    }
    pauseOffsetRef.current = 0
    setCurrentTime(0)
    onTimeUpdate?.(0)
  }, [isPlaying, pause, onTimeUpdate])

  const seek = useCallback((position: number) => {
    const newTime = Math.max(0, Math.min(position * duration, duration))
    pauseOffsetRef.current = newTime
    setCurrentTime(newTime)
    onTimeUpdate?.(newTime)

    // If playing, restart from new position
    if (isPlaying) {
      stopCurrentSource()
      void play()
    }
  }, [duration, isPlaying, onTimeUpdate, play, stopCurrentSource])

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const position = (e.clientX - rect.left) / rect.width
    seek(position)
  }, [seek])

  // Handle external seek position changes
  const lastSeekPositionRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (seekPosition !== undefined && seekPosition !== lastSeekPositionRef.current) {
      lastSeekPositionRef.current = seekPosition
      seek(seekPosition)
    }
  }, [seekPosition, seek])

  const progress = duration > 0 ? currentTime / duration : 0

  return (
    <div className={cn("flex items-center gap-4", className)}>
      {/* Play/Pause button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 rounded-full bg-accent/10 hover:bg-accent/20"
        onClick={togglePlayPause}
        disabled={!isReady}
      >
        {isPlaying ? (
          <Pause className="h-5 w-5 text-accent" />
        ) : (
          <Play className="h-5 w-5 text-accent ml-0.5" />
        )}
      </Button>

      {/* Time display */}
      <span className="text-sm tabular-nums text-muted-foreground min-w-[4rem]">
        {formatDuration(currentTime)}
      </span>

      {/* Progress bar */}
      <div
        className="flex-1 h-2 bg-muted/30 rounded-full cursor-pointer relative overflow-hidden"
        onClick={handleProgressClick}
      >
        <div
          className="absolute inset-y-0 left-0 bg-accent rounded-full transition-all duration-75"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Duration */}
      <span className="text-sm tabular-nums text-muted-foreground min-w-[4rem]">
        {formatDuration(duration)}
      </span>

      {/* Reset button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={reset}
        disabled={currentTime === 0}
      >
        <RotateCcw className="h-4 w-4 text-muted-foreground" />
      </Button>
    </div>
  )
}
