"use client"

import { useEffect, useState, useCallback } from "react"
import { motion } from "framer-motion"
import { useSceneMode } from "@/lib/scene-context"
import { findDemoElement, getElementRect, debounce } from "@/lib/demo/demo-utils"

interface DemoSpotlightProps {
  targetId: string | null
}

interface SpotlightRect {
  x: number
  y: number
  width: number
  height: number
}

export function DemoSpotlight({ targetId }: DemoSpotlightProps) {
  const { accentColor } = useSceneMode()
  const [rect, setRect] = useState<SpotlightRect | null>(null)

  // Update spotlight position
  const updatePosition = useCallback(() => {
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
    setRect({
      x: domRect.left - 8,
      y: domRect.top - 8,
      width: domRect.width + 16,
      height: domRect.height + 16,
    })
  }, [targetId])

  // Update position on mount and when target changes
  useEffect(() => {
    updatePosition()

    // Debounced handlers for resize and scroll
    const debouncedUpdate = debounce(updatePosition, 100)

    window.addEventListener("resize", debouncedUpdate)
    window.addEventListener("scroll", debouncedUpdate, true)

    // Also listen for any layout changes
    const observer = new ResizeObserver(debouncedUpdate)
    if (targetId) {
      const element = findDemoElement(targetId)
      if (element) {
        observer.observe(element)
      }
    }

    return () => {
      window.removeEventListener("resize", debouncedUpdate)
      window.removeEventListener("scroll", debouncedUpdate, true)
      observer.disconnect()
    }
  }, [targetId, updatePosition])

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
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
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
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
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
          x: { type: "spring", stiffness: 300, damping: 30 },
          y: { type: "spring", stiffness: 300, damping: 30 },
          width: { type: "spring", stiffness: 300, damping: 30 },
          height: { type: "spring", stiffness: 300, damping: 30 },
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
