"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { motion } from "framer-motion"
import { useSceneMode } from "@/lib/scene-context"
import { findDemoElement, getElementRect } from "@/lib/demo/demo-utils"

interface DemoSpotlightProps {
  targetId: string | null
}

interface SpotlightRect {
  x: number
  y: number
  width: number
  height: number
}

function roundToDpr(value: number): number {
  if (typeof window === "undefined") return value
  const dpr = window.devicePixelRatio || 1
  return Math.round(value * dpr) / dpr
}

function roundRectToDpr(rect: SpotlightRect): SpotlightRect {
  return {
    x: roundToDpr(rect.x),
    y: roundToDpr(rect.y),
    width: roundToDpr(rect.width),
    height: roundToDpr(rect.height),
  }
}

export function DemoSpotlight({ targetId }: DemoSpotlightProps) {
  const { accentColor } = useSceneMode()
  const [rect, setRect] = useState<SpotlightRect | null>(null)

  const rafIdRef = useRef<number | null>(null)

  const requestFrame = useCallback((cb: FrameRequestCallback) => {
    if (typeof window.requestAnimationFrame === "function") {
      return window.requestAnimationFrame(cb)
    }

    return window.setTimeout(() => cb(Date.now()), 16)
  }, [])

  const cancelFrame = useCallback((id: number) => {
    if (typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(id)
      return
    }

    window.clearTimeout(id)
  }, [])

  const updatePositionNow = useCallback(() => {
    if (!targetId) {
      setRect(null)
      return
    }

    const element = findDemoElement(targetId)
    if (!element) {
      setRect(null)
      return
    }

    const domRect = getElementRect(element)
    const next = roundRectToDpr({
      x: domRect.left - 8,
      y: domRect.top - 8,
      width: domRect.width + 16,
      height: domRect.height + 16,
    })

    setRect(next)
  }, [targetId])

  const scheduleUpdate = useCallback(() => {
    if (rafIdRef.current != null) return
    rafIdRef.current = requestFrame(() => {
      rafIdRef.current = null
      updatePositionNow()
    })
  }, [requestFrame, updatePositionNow])

  // Update position on mount and when target changes
  useEffect(() => {
    scheduleUpdate()

    window.addEventListener("resize", scheduleUpdate)
    window.addEventListener("scroll", scheduleUpdate, true)

    // Also listen for any layout changes
    const observer = new ResizeObserver(scheduleUpdate)
    if (targetId) {
      const element = findDemoElement(targetId)
      if (element) {
        observer.observe(element)
      }
    }

    return () => {
      window.removeEventListener("resize", scheduleUpdate)
      window.removeEventListener("scroll", scheduleUpdate, true)
      observer.disconnect()
      if (rafIdRef.current != null) {
        cancelFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [targetId, cancelFrame, scheduleUpdate])

  if (!rect) return null

  return (
    <>
      {/* Darkened overlay with cutout */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-none z-[9998]"
        style={{ willChange: "transform" }}
      >
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <motion.rect
              initial={{
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                opacity: 0,
              }}
              animate={{
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                opacity: 1,
              }}
               transition={{ type: "spring", stiffness: 220, damping: 35, mass: 0.9 }}

              rx="12"
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.75)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Glow effect around spotlight */}
      <motion.div
        // Anchor to (0,0) so `x`/`y` positioning maps to viewport coordinates.
        // See: docs/error-patterns/fixed-overlay-transform-without-inset.md
        className="fixed left-0 top-0 pointer-events-none z-[9999]"
        data-testid="demo-spotlight-glow"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          opacity: 1,
          scale: 1,
        }}
         transition={{ type: "spring", stiffness: 220, damping: 35, mass: 0.9 }}

        style={{
          borderRadius: "12px",
          boxShadow: `
            0 0 0 2px ${accentColor},
            0 0 20px ${accentColor}60,
            0 0 40px ${accentColor}30,
            inset 0 0 20px ${accentColor}10
          `,
          willChange: "transform, opacity",
        }}
      />

      {/* Subtle pulse animation */}
      <motion.div
        className="fixed left-0 top-0 pointer-events-none z-[9997]"
        data-testid="demo-spotlight-pulse"
        initial={{ opacity: 0 }}
        animate={{
          x: rect.x - 4,
          y: rect.y - 4,
          width: rect.width + 8,
          height: rect.height + 8,
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
           x: { type: "spring", stiffness: 200, damping: 40, mass: 1 },
           y: { type: "spring", stiffness: 200, damping: 40, mass: 1 },
           width: { type: "spring", stiffness: 200, damping: 40, mass: 1 },
           height: { type: "spring", stiffness: 200, damping: 40, mass: 1 },

          opacity: { duration: 2, repeat: Infinity, ease: "easeInOut" },
        }}
        style={{
          borderRadius: "16px",
          border: `1px solid ${accentColor}40`,
          willChange: "transform, opacity",
        }}
      />
    </>
  )
}
