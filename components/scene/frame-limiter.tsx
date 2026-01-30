"use client"

import { useEffect } from "react"
import { useThree } from "@react-three/fiber"

interface FrameLimiterProps {
  maxFps: number | null
  enabled?: boolean
}

export function FrameLimiter({ maxFps, enabled = true }: FrameLimiterProps) {
  const invalidate = useThree((state) => state.invalidate)

  useEffect(() => {
    if (!enabled) return

    invalidate()

    if (maxFps === null || maxFps <= 0) return

    const interval = window.setInterval(() => {
      invalidate()
    }, 1000 / maxFps)

    return () => window.clearInterval(interval)
  }, [enabled, invalidate, maxFps])

  return null
}
