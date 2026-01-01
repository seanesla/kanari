"use client"

import { useCallback, useEffect, useRef } from "react"

const LERP_FACTOR = 0.08 // Lower = smoother/slower chase (0.05-0.15 range)
const STOP_THRESHOLD = 0.001 // Stop animating when close enough

interface Position {
  x: number
  y: number
}

interface EllipseSize {
  rx: number
  ry: number
}

export function useCursorGlow(options?: {
  clampToBorder?: boolean
  distanceIntensity?: boolean
}) {
  const clampToBorder = options?.clampToBorder ?? false
  const distanceIntensity = options?.distanceIntensity ?? false

  // Animation state refs (avoid re-renders)
  const targetPos = useRef<Position>({ x: 0.5, y: 0.5 }) // Normalized 0-1
  const currentPos = useRef<Position>({ x: 0.5, y: 0.5 })
  const targetSize = useRef<EllipseSize>({ rx: 260, ry: 260 })
  const currentSize = useRef<EllipseSize>({ rx: 260, ry: 260 })
  const targetIntensity = useRef(1)
  const currentIntensity = useRef(1)
  const elementRef = useRef<HTMLElement | null>(null)
  const rafId = useRef<number | null>(null)
  const isHovering = useRef(false)

  const animate = useCallback(() => {
    if (!elementRef.current) {
      rafId.current = null
      return
    }

    // Lerp position toward target
    currentPos.current.x +=
      (targetPos.current.x - currentPos.current.x) * LERP_FACTOR
    currentPos.current.y +=
      (targetPos.current.y - currentPos.current.y) * LERP_FACTOR

    // Lerp ellipse size toward target
    currentSize.current.rx +=
      (targetSize.current.rx - currentSize.current.rx) * LERP_FACTOR
    currentSize.current.ry +=
      (targetSize.current.ry - currentSize.current.ry) * LERP_FACTOR

    // Lerp intensity toward target
    currentIntensity.current +=
      (targetIntensity.current - currentIntensity.current) * LERP_FACTOR

    // Convert normalized position to pixels and update CSS vars
    const rect = elementRef.current.getBoundingClientRect()
    const x = currentPos.current.x * rect.width
    const y = currentPos.current.y * rect.height

    elementRef.current.style.setProperty("--glow-x", `${x}px`)
    elementRef.current.style.setProperty("--glow-y", `${y}px`)
    elementRef.current.style.setProperty(
      "--glow-rx",
      `${Math.round(currentSize.current.rx)}px`
    )
    elementRef.current.style.setProperty(
      "--glow-ry",
      `${Math.round(currentSize.current.ry)}px`
    )
    elementRef.current.style.setProperty(
      "--glow-intensity",
      `${currentIntensity.current.toFixed(3)}`
    )

    // Check if we should continue animating
    const dx = Math.abs(targetPos.current.x - currentPos.current.x)
    const dy = Math.abs(targetPos.current.y - currentPos.current.y)
    const drx = Math.abs(targetSize.current.rx - currentSize.current.rx)
    const dry = Math.abs(targetSize.current.ry - currentSize.current.ry)
    const di = Math.abs(targetIntensity.current - currentIntensity.current)

    const stillAnimating =
      dx > STOP_THRESHOLD ||
      dy > STOP_THRESHOLD ||
      drx > 1 ||
      dry > 1 ||
      di > STOP_THRESHOLD

    if (isHovering.current || stillAnimating) {
      rafId.current = requestAnimationFrame(animate)
    } else {
      rafId.current = null
    }
  }, [])

  const handleMove = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const target = event.currentTarget as HTMLElement
      elementRef.current = target
      isHovering.current = true

      const rect = target.getBoundingClientRect()

      // Calculate normalized position (0-1)
      let normX = (event.clientX - rect.left) / rect.width
      let normY = (event.clientY - rect.top) / rect.height

      // Default ellipse size
      let rx = 260
      let ry = 260

      if (clampToBorder) {
        const x = event.clientX - rect.left
        const y = event.clientY - rect.top
        const leftDist = x
        const rightDist = rect.width - x
        const topDist = y
        const bottomDist = rect.height - y

        const minHorizontalDist = Math.min(leftDist, rightDist)
        const minVerticalDist = Math.min(topDist, bottomDist)

        // Blend factor: 0 = vertical edge, 1 = horizontal edge
        const edgeBlend = minHorizontalDist / (minHorizontalDist + minVerticalDist)

        // Determine nearest edge and clamp only one axis while tracking the other
        if (minHorizontalDist < minVerticalDist) {
          // Near vertical edge: clamp X, track Y smoothly
          normX = leftDist < rightDist ? 0 : 1
          // normY stays as cursor position
        } else {
          // Near horizontal edge: clamp Y, track X smoothly
          normY = topDist < bottomDist ? 0 : 1
          // normX stays as cursor position
        }

        // Smooth ellipse size blend based on edge proximity
        const verticalRx = Math.max(140, Math.round(rect.width * 0.28))
        const verticalRy = Math.max(320, Math.round(rect.height * 0.55))
        const horizontalRx = Math.max(320, Math.round(rect.width * 0.55))
        const horizontalRy = Math.max(140, Math.round(rect.height * 0.28))

        rx = verticalRx + (horizontalRx - verticalRx) * edgeBlend
        ry = verticalRy + (horizontalRy - verticalRy) * edgeBlend

        // Calculate intensity based on distance from nearest edge (if enabled)
        if (distanceIntensity) {
          const minEdgeDist = Math.min(minHorizontalDist, minVerticalDist)
          const maxDist = Math.min(rect.width, rect.height) / 2
          const intensity = 1 - minEdgeDist / maxDist
          targetIntensity.current = Math.max(0, Math.min(1, intensity))
        }
      }

      // Set target positions (animation loop will lerp toward these)
      targetPos.current = { x: normX, y: normY }
      targetSize.current = { rx, ry }

      // Start animation loop if not already running
      if (!rafId.current) {
        rafId.current = requestAnimationFrame(animate)
      }
    },
    [clampToBorder, distanceIntensity, animate]
  )

  const handleLeave = useCallback(() => {
    isHovering.current = false
    // Don't reset position - let CSS opacity transition handle the fade out
    // The glow stays where it is and fades via group-hover:opacity-100 → opacity-0
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current)
        rafId.current = null
      }
    }
  }, [])

  return {
    onMouseMove: handleMove,
    onMouseLeave: handleLeave,
    style: {
      "--glow-x": "50%",
      "--glow-y": "50%",
      "--glow-rx": "260px",
      "--glow-ry": "260px",
      "--glow-intensity": "1",
    } as React.CSSProperties,
  }
}
