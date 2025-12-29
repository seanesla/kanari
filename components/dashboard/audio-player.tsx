"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Play, Pause, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface AudioPlayerProps {
  audioData: Float32Array | number[]
  sampleRate?: number
  duration: number
  onTimeUpdate?: (currentTime: number) => void
  onPlayStateChange?: (isPlaying: boolean) => void
  className?: string
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function AudioPlayer({
  audioData,
  sampleRate = 16000,
  duration,
  onTimeUpdate,
  onPlayStateChange,
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
  const animationFrameRef = useRef<number>()

  // Initialize audio context and buffer
  useEffect(() => {
    const initAudio = async () => {
      try {
        // Create audio context
        const ctx = new AudioContext({ sampleRate })
        audioContextRef.current = ctx

        // Convert number[] to Float32Array if needed
        const samples = audioData instanceof Float32Array
          ? audioData
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
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop()
        } catch {
          // Already stopped
        }
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [audioData, sampleRate])

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

  const play = useCallback(() => {
    if (!audioContextRef.current || !audioBufferRef.current || !isReady) return

    const ctx = audioContextRef.current

    // Resume context if suspended
    if (ctx.state === "suspended") {
      ctx.resume()
    }

    // Stop any existing source
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop()
      } catch {
        // Already stopped
      }
    }

    // Create new source node
    const source = ctx.createBufferSource()
    source.buffer = audioBufferRef.current
    source.connect(ctx.destination)

    // Handle playback end
    source.onended = () => {
      if (isPlaying) {
        setIsPlaying(false)
        onPlayStateChange?.(false)
        pauseOffsetRef.current = 0
        setCurrentTime(0)
        onTimeUpdate?.(0)
      }
    }

    sourceNodeRef.current = source
    startTimeRef.current = ctx.currentTime

    // Start from offset
    source.start(0, pauseOffsetRef.current)
    setIsPlaying(true)
    onPlayStateChange?.(true)
  }, [isReady, isPlaying, onPlayStateChange, onTimeUpdate])

  const pause = useCallback(() => {
    if (!audioContextRef.current || !sourceNodeRef.current) return

    // Save current position
    const elapsed = audioContextRef.current.currentTime - startTimeRef.current
    pauseOffsetRef.current = Math.min(pauseOffsetRef.current + elapsed, duration)

    // Stop source
    try {
      sourceNodeRef.current.stop()
    } catch {
      // Already stopped
    }

    setIsPlaying(false)
    onPlayStateChange?.(false)
  }, [duration, onPlayStateChange])

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
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop()
        } catch {
          // Already stopped
        }
      }
      play()
    }
  }, [duration, isPlaying, play, onTimeUpdate])

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const position = (e.clientX - rect.left) / rect.width
    seek(position)
  }, [seek])

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
        {formatTime(currentTime)}
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
        {formatTime(duration)}
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
