"use client"

import { useCallback } from "react"

export function useCursorGlow(options?: { clampToBorder?: boolean }) {
  const clampToBorder = options?.clampToBorder ?? false

  const handleMove = useCallback((event: React.MouseEvent<HTMLElement>) => {
    const target = event.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    let x = event.clientX - rect.left
    let y = event.clientY - rect.top

    if (clampToBorder) {
      const leftDist = x
      const rightDist = rect.width - x
      const topDist = y
      const bottomDist = rect.height - y

      const minDist = Math.min(leftDist, rightDist, topDist, bottomDist)
      if (minDist === leftDist) x = 0
      else if (minDist === rightDist) x = rect.width
      else if (minDist === topDist) y = 0
      else y = rect.height
    }

    target.style.setProperty("--glow-x", `${x}px`)
    target.style.setProperty("--glow-y", `${y}px`)
  }, [clampToBorder])

  const handleLeave = useCallback((event: React.MouseEvent<HTMLElement>) => {
    const target = event.currentTarget as HTMLElement
    target.style.setProperty("--glow-x", "50%")
    target.style.setProperty("--glow-y", "50%")
  }, [])

  return {
    onMouseMove: handleMove,
    onMouseLeave: handleLeave,
    style: {
      "--glow-x": "50%",
      "--glow-y": "50%",
    } as React.CSSProperties,
  }
}
