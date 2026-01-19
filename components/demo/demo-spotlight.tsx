"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import { useSceneMode } from "@/lib/scene-context"

interface DemoSpotlightProps {
  rect: DOMRect | null
  isScrolling: boolean
}

const TRACKING_EASE = [0.22, 0.61, 0.36, 1] as const
const TRACKING_DURATION = 0.22
const PULSE_DURATION = 2.2

function roundToDpr(value: number): number {
  if (typeof window === "undefined") return value
  const dpr = window.devicePixelRatio || 1
  return Math.round(value * dpr) / dpr
}

function roundRectToDpr(rect: DOMRect): DOMRect {
  return new DOMRect(
    roundToDpr(rect.x),
    roundToDpr(rect.y),
    roundToDpr(rect.width),
    roundToDpr(rect.height)
  )
}

export function DemoSpotlight({ rect, isScrolling }: DemoSpotlightProps) {
  const { accentColor } = useSceneMode()

  const paddedRect = useMemo(() => {
    if (!rect) return null
    return roundRectToDpr(new DOMRect(rect.x - 8, rect.y - 8, rect.width + 16, rect.height + 16))
  }, [rect])

  if (!paddedRect) return null

  const trackingTransition = {
    duration: isScrolling ? 0 : TRACKING_DURATION,
    ease: TRACKING_EASE,
  }

  return (
    <>
      <motion.div
        className="fixed left-0 top-0 pointer-events-none z-[9998]"
        data-testid="demo-spotlight-overlay"
        style={{
          borderRadius: "12px",
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.75)",
          willChange: "transform, width, height",
        }}
        initial={{
          opacity: 0,
          x: paddedRect.x,
          y: paddedRect.y,
          width: paddedRect.width,
          height: paddedRect.height,
        }}
        animate={{
          x: paddedRect.x,
          y: paddedRect.y,
          width: paddedRect.width,
          height: paddedRect.height,
          opacity: 1,
        }}
        transition={{
          x: trackingTransition,
          y: trackingTransition,
          width: trackingTransition,
          height: trackingTransition,
          opacity: { duration: 0.2 },
        }}
      />

      <motion.div
        className="fixed left-0 top-0 pointer-events-none z-[9999]"
        data-testid="demo-spotlight-glow"
        style={{
          borderRadius: "12px",
          boxShadow: `
            0 0 0 2px ${accentColor},
            0 0 20px ${accentColor}60,
            0 0 40px ${accentColor}30,
            inset 0 0 20px ${accentColor}10
          `,
          willChange: "transform, width, height",
        }}
        initial={{
          opacity: 0,
          x: paddedRect.x,
          y: paddedRect.y,
          width: paddedRect.width,
          height: paddedRect.height,
        }}
        animate={{
          x: paddedRect.x,
          y: paddedRect.y,
          width: paddedRect.width,
          height: paddedRect.height,
          opacity: isScrolling ? 0.8 : 1,
        }}
        transition={{
          x: trackingTransition,
          y: trackingTransition,
          width: trackingTransition,
          height: trackingTransition,
          opacity: { duration: 0.2 },
        }}
      />

      <motion.div
        className="fixed left-0 top-0 pointer-events-none z-[9997]"
        data-testid="demo-spotlight-pulse"
        style={{
          borderRadius: "16px",
          border: `1px solid ${accentColor}40`,
          willChange: "transform, width, height",
        }}
        initial={{
          opacity: 0,
          x: paddedRect.x - 4,
          y: paddedRect.y - 4,
          width: paddedRect.width + 8,
          height: paddedRect.height + 8,
        }}
        animate={{
          x: paddedRect.x - 4,
          y: paddedRect.y - 4,
          width: paddedRect.width + 8,
          height: paddedRect.height + 8,
          opacity: [0.25, 0.5, 0.25],
        }}
        transition={{
          x: trackingTransition,
          y: trackingTransition,
          width: trackingTransition,
          height: trackingTransition,
          opacity: { duration: PULSE_DURATION, repeat: Infinity, ease: "easeInOut" },
        }}
      />
    </>
  )
}
