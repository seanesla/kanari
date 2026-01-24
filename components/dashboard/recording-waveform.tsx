"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { useSceneMode } from "@/lib/scene-context"

export interface RecordingWaveformProps {
  /**
   * Audio level (0-1) for real-time visualization
   */
  audioLevel?: number

  /**
   * Audio data for static waveform visualization
   */
  audioData?: Float32Array

  /**
   * Width of the waveform canvas
   */
  width?: number

  /**
   * Height of the waveform canvas
   */
  height?: number

  /**
   * Waveform color
   */
  color?: string

  /**
   * Background color
   */
  backgroundColor?: string

  /**
   * Whether to show real-time bars or static waveform
   */
  mode?: "realtime" | "static"

  /**
   * Playhead position (0-1 normalized) for static mode
   */
  playheadPosition?: number

  /**
   * Callback when user clicks to seek (position 0-1)
   */
  onSeek?: (position: number) => void

  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * RecordingWaveform - Real-time audio visualization component
 *
 * Modes:
 * - realtime: Animated bars showing current audio level
 * - static: Waveform visualization of recorded audio
 */
export function RecordingWaveform({
  audioLevel = 0,
  audioData,
  width = 400,
  height = 100,
  color: colorProp,
  backgroundColor = "transparent",
  mode = "realtime",
  playheadPosition,
  onSeek,
  className,
}: RecordingWaveformProps) {
  const { accentColor } = useSceneMode()
  const color = colorProp || accentColor // Use accent color from context if not provided
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const barsRef = useRef<number[]>([])
  const barStartIndexRef = useRef(0)
  const animationFrameRef = useRef<number>(0)
  const waveformDataRef = useRef<number[]>([])
  const audioLevelRef = useRef(audioLevel)

  useEffect(() => {
    audioLevelRef.current = audioLevel
  }, [audioLevel])

  // Initialize bars for real-time mode
  useEffect(() => {
    if (mode === "realtime") {
      // Create initial bars array (60 bars for smooth animation)
      barsRef.current = Array(60).fill(0)
      barStartIndexRef.current = 0
    }
  }, [mode])

  // Draw real-time visualization
  useEffect(() => {
    if (mode !== "realtime" || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const draw = () => {
      // Clear canvas
      ctx.fillStyle = backgroundColor
      ctx.fillRect(0, 0, width, height)

      const bars = barsRef.current
      if (bars.length > 0) {
        // Ring-buffer update (drops oldest, appends newest) without O(n) shift()
        const writeIndex = barStartIndexRef.current
        bars[writeIndex] = audioLevelRef.current
        barStartIndexRef.current = (writeIndex + 1) % bars.length
      }

      // Draw bars
      const barsLength = barsRef.current.length
      if (barsLength === 0) {
        animationFrameRef.current = requestAnimationFrame(draw)
        return
      }

      const barWidth = width / barsLength
      const barSpacing = 2

      const startIndex = barStartIndexRef.current

      for (let index = 0; index < barsLength; index += 1) {
        const level = bars[(startIndex + index) % barsLength] ?? 0
        const barHeight = level * height * 0.8 // Max 80% of canvas height
        const x = index * barWidth
        const y = (height - barHeight) / 2

        // Create gradient for bar
        const gradient = ctx.createLinearGradient(x, y, x, y + barHeight)
        gradient.addColorStop(0, color)
        gradient.addColorStop(1, `${color}80`) // 50% opacity

        ctx.fillStyle = gradient
        ctx.fillRect(x, y, barWidth - barSpacing, barHeight)
      }

      animationFrameRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [mode, width, height, color, backgroundColor])

  // Draw static waveform
  useEffect(() => {
    if (mode !== "static" || !audioData || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, width, height)

    // Downsample audio data to fit canvas width
    const samplesPerPixel = Math.max(1, Math.floor(audioData.length / width))
    const waveformData: number[] = []

    for (let i = 0; i < width; i++) {
      const start = i * samplesPerPixel
      const end = Math.min(audioData.length, start + samplesPerPixel)

      // Calculate RMS for this slice
      let sum = 0
      let count = 0
      for (let j = start; j < end; j++) {
        const sample = audioData[j] ?? 0
        sum += sample * sample
        count += 1
      }

      const rms = count > 0 ? Math.sqrt(sum / count) : 0
      waveformData.push(rms)
    }

    // Normalize waveform data
    const maxRms = Math.max(...waveformData)
    const normalizedData = waveformData.map((rms) =>
      maxRms > 0 ? rms / maxRms : 0
    )

    // Draw waveform
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    ctx.beginPath()

    for (let i = 0; i < normalizedData.length; i++) {
      const amplitude = normalizedData[i] * (height / 2) * 0.8
      const x = i
      const y = height / 2

      // Draw line from center
      if (i === 0) {
        ctx.moveTo(x, y - amplitude)
      } else {
        ctx.lineTo(x, y - amplitude)
      }
    }

    ctx.stroke()

    // Draw mirror (bottom half)
    ctx.beginPath()

    for (let i = 0; i < normalizedData.length; i++) {
      const amplitude = normalizedData[i] * (height / 2) * 0.8
      const x = i
      const y = height / 2

      if (i === 0) {
        ctx.moveTo(x, y + amplitude)
      } else {
        ctx.lineTo(x, y + amplitude)
      }
    }

    ctx.stroke()

    // Fill area under waveform with gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, `${color}40`)
    gradient.addColorStop(0.5, `${color}10`)
    gradient.addColorStop(1, `${color}40`)

    ctx.fillStyle = gradient

    ctx.beginPath()
    ctx.moveTo(0, height / 2)

    for (let i = 0; i < normalizedData.length; i++) {
      const amplitude = normalizedData[i] * (height / 2) * 0.8
      const x = i
      const y = height / 2

      ctx.lineTo(x, y - amplitude)
    }

    for (let i = normalizedData.length - 1; i >= 0; i--) {
      const amplitude = normalizedData[i] * (height / 2) * 0.8
      const x = i
      const y = height / 2

      ctx.lineTo(x, y + amplitude)
    }

    ctx.closePath()
    ctx.fill()

    // Store normalized data for playhead redraw
    waveformDataRef.current = normalizedData
  }, [mode, audioData, width, height, color, backgroundColor])

  // Draw playhead overlay
  useEffect(() => {
    if (mode !== "static" || playheadPosition === undefined || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Redraw waveform first (to clear previous playhead)
    const normalizedData = waveformDataRef.current
    if (normalizedData.length === 0) return

    // Clear canvas properly (clearRect needed for transparent backgrounds)
    ctx.clearRect(0, 0, width, height)
    if (backgroundColor !== "transparent") {
      ctx.fillStyle = backgroundColor
      ctx.fillRect(0, 0, width, height)
    }

    // Redraw waveform
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    ctx.beginPath()
    for (let i = 0; i < normalizedData.length; i++) {
      const amplitude = normalizedData[i] * (height / 2) * 0.8
      const x = i
      const y = height / 2
      if (i === 0) {
        ctx.moveTo(x, y - amplitude)
      } else {
        ctx.lineTo(x, y - amplitude)
      }
    }
    ctx.stroke()

    ctx.beginPath()
    for (let i = 0; i < normalizedData.length; i++) {
      const amplitude = normalizedData[i] * (height / 2) * 0.8
      const x = i
      const y = height / 2
      if (i === 0) {
        ctx.moveTo(x, y + amplitude)
      } else {
        ctx.lineTo(x, y + amplitude)
      }
    }
    ctx.stroke()

    const gradient = ctx.createLinearGradient(0, 0, 0, height)
    gradient.addColorStop(0, `${color}40`)
    gradient.addColorStop(0.5, `${color}10`)
    gradient.addColorStop(1, `${color}40`)
    ctx.fillStyle = gradient

    ctx.beginPath()
    ctx.moveTo(0, height / 2)
    for (let i = 0; i < normalizedData.length; i++) {
      const amplitude = normalizedData[i] * (height / 2) * 0.8
      ctx.lineTo(i, height / 2 - amplitude)
    }
    for (let i = normalizedData.length - 1; i >= 0; i--) {
      const amplitude = normalizedData[i] * (height / 2) * 0.8
      ctx.lineTo(i, height / 2 + amplitude)
    }
    ctx.closePath()
    ctx.fill()

    // Draw playhead line
    const playheadX = Math.round(playheadPosition * width)
    ctx.strokeStyle = "#ef4444" // Red color for playhead
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(playheadX, 0)
    ctx.lineTo(playheadX, height)
    ctx.stroke()

    // Draw playhead circle at top
    ctx.fillStyle = "#ef4444"
    ctx.beginPath()
    ctx.arc(playheadX, 4, 4, 0, Math.PI * 2)
    ctx.fill()
  }, [mode, playheadPosition, width, height, color, backgroundColor])

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== "static" || !onSeek) return
    const rect = e.currentTarget.getBoundingClientRect()
    const position = (e.clientX - rect.left) / rect.width
    onSeek(Math.max(0, Math.min(1, position)))
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={cn("rounded-lg", onSeek && mode === "static" ? "cursor-pointer" : "", className)}
      style={{ backgroundColor }}
      onClick={handleClick}
    />
  )
}

/**
 * Simple audio level meter (bars visualization)
 */
export function AudioLevelMeter({
  level = 0,
  barCount = 20,
  className,
}: {
  level?: number
  barCount?: number
  className?: string
}) {
  const activeBars = Math.round(level * barCount)

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {Array.from({ length: barCount }).map((_, i) => {
        const isActive = i < activeBars
        const isHigh = i >= barCount * 0.8

        return (
          <div
            key={i}
            className={cn(
              "h-8 w-1 rounded-full transition-all duration-75",
              isActive
                ? isHigh
                  ? "bg-destructive"
                  : "bg-accent"
                : "bg-muted/30"
            )}
            style={{
              height: `${20 + (i / barCount) * 20}px`, // Gradient height
            }}
          />
        )
      })}
    </div>
  )
}

/**
 * Circular audio level indicator
 */
export function AudioLevelCircle({
  level = 0,
  size = 100,
  className,
}: {
  level?: number
  size?: number
  className?: string
}) {
  const radius = size / 2
  const strokeWidth = 8
  const normalizedRadius = radius - strokeWidth / 2
  const circumference = normalizedRadius * 2 * Math.PI
  const strokeDashoffset = circumference - level * circumference

  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      <svg height={size} width={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          stroke="currentColor"
          className="text-muted/20"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        {/* Level circle */}
        <circle
          stroke="currentColor"
          className={cn(
            "transition-all duration-75",
            level > 0.8 ? "text-destructive" : "text-accent"
          )}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-medium">
          {Math.round(level * 100)}%
        </span>
      </div>
    </div>
  )
}
