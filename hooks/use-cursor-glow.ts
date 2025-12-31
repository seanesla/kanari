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

      // Make the glow ellipse "hug" the edge direction so it reads as a border glow,
      // not a circle stuck on the edge.
      if (x === 0 || x === rect.width) {
        // Vertical edge: narrow in X, long in Y
        const rx = Math.max(140, Math.round(rect.width * 0.28))
        const ry = Math.max(320, Math.round(rect.height * 0.55))
        target.style.setProperty("--glow-rx", `${rx}px`)
        target.style.setProperty("--glow-ry", `${ry}px`)
      } else {
        // Horizontal edge: long in X, narrow in Y
        const rx = Math.max(320, Math.round(rect.width * 0.55))
        const ry = Math.max(140, Math.round(rect.height * 0.28))
        target.style.setProperty("--glow-rx", `${rx}px`)
        target.style.setProperty("--glow-ry", `${ry}px`)
      }
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
      "--glow-rx": "260px",
      "--glow-ry": "260px",
    } as React.CSSProperties,
  }
}
