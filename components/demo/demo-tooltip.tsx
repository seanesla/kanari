"use client"

import { useEffect, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useSceneMode } from "@/lib/scene-context"
import {
  findDemoElement,
  getElementRect,
  calculateTooltipPosition,
  calculateOptimalPosition,
  debounce,
} from "@/lib/demo/demo-utils"
import type { TooltipPosition } from "./steps/types"

interface DemoTooltipProps {
  targetId: string | null
  content: string
  title?: string
  position?: TooltipPosition
  isVisible: boolean
}

const TOOLTIP_WIDTH = 340
const TOOLTIP_MIN_HEIGHT = 100

export function DemoTooltip({
  targetId,
  content,
  title,
  position: preferredPosition,
  isVisible,
}: DemoTooltipProps) {
  const { accentColor } = useSceneMode()
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const [actualPosition, setActualPosition] = useState<TooltipPosition>("bottom")

  // Update tooltip position
  const updatePosition = useCallback(() => {
    if (!targetId) return

    const element = findDemoElement(targetId)
    if (!element) return

    const targetRect = getElementRect(element)

    // Calculate optimal position if not specified
    const optimalPos = preferredPosition || calculateOptimalPosition(targetRect, TOOLTIP_WIDTH, TOOLTIP_MIN_HEIGHT)
    setActualPosition(optimalPos)

    // Calculate coordinates
    const { x, y } = calculateTooltipPosition(targetRect, optimalPos, TOOLTIP_WIDTH, TOOLTIP_MIN_HEIGHT)
    setCoords({ x, y })
  }, [targetId, preferredPosition])

  // Update position on mount and changes
  useEffect(() => {
    if (isVisible && targetId) {
      // Small delay to let scroll complete
      const timer = setTimeout(updatePosition, 350)
      return () => clearTimeout(timer)
    }
  }, [isVisible, targetId, updatePosition])

  // Listen for resize/scroll
  useEffect(() => {
    if (!isVisible) return

    const debouncedUpdate = debounce(updatePosition, 100)

    window.addEventListener("resize", debouncedUpdate)
    window.addEventListener("scroll", debouncedUpdate, true)

    return () => {
      window.removeEventListener("resize", debouncedUpdate)
      window.removeEventListener("scroll", debouncedUpdate, true)
    }
  }, [isVisible, updatePosition])

  // Arrow styles based on position
  const getArrowStyles = () => {
    const base = {
      position: "absolute" as const,
      width: 0,
      height: 0,
      borderStyle: "solid" as const,
    }

    switch (actualPosition) {
      case "top":
        return {
          ...base,
          bottom: -8,
          left: "50%",
          transform: "translateX(-50%)",
          borderWidth: "8px 8px 0 8px",
          borderColor: `${accentColor}30 transparent transparent transparent`,
        }
      case "bottom":
        return {
          ...base,
          top: -8,
          left: "50%",
          transform: "translateX(-50%)",
          borderWidth: "0 8px 8px 8px",
          borderColor: `transparent transparent ${accentColor}30 transparent`,
        }
      case "left":
        return {
          ...base,
          right: -8,
          top: "50%",
          transform: "translateY(-50%)",
          borderWidth: "8px 0 8px 8px",
          borderColor: `transparent transparent transparent ${accentColor}30`,
        }
      case "right":
        return {
          ...base,
          left: -8,
          top: "50%",
          transform: "translateY(-50%)",
          borderWidth: "8px 8px 8px 0",
          borderColor: `transparent ${accentColor}30 transparent transparent`,
        }
    }
  }

  return (
    <AnimatePresence mode="wait">
      {isVisible && targetId && (
        <motion.div
          key={`tooltip-${targetId}`}
          // Anchor to (0,0) so framer-motion `x`/`y` maps to viewport coordinates.
          // See: docs/error-patterns/fixed-overlay-transform-without-inset.md
          className="fixed left-0 top-0 z-[10000] pointer-events-auto"
          data-testid="demo-tooltip"
          style={{
            width: TOOLTIP_WIDTH,
            willChange: "transform, opacity",
          }}
          initial={{ opacity: 0, scale: 0.95, y: actualPosition === "top" ? 10 : actualPosition === "bottom" ? -10 : 0, x: actualPosition === "left" ? 10 : actualPosition === "right" ? -10 : 0 }}
          animate={{
            opacity: 1,
            scale: 1,
            x: coords.x,
            y: coords.y,
          }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          {/* Glass panel container */}
          <div
            className="relative bg-foreground/5 backdrop-blur-xl rounded-xl p-5 shadow-2xl"
            style={{
              border: `1px solid ${accentColor}30`,
              boxShadow: `
                0 4px 30px rgba(0, 0, 0, 0.3),
                0 0 20px ${accentColor}15,
                inset 0 1px 0 rgba(255, 255, 255, 0.05)
              `,
            }}
          >
            {/* Title */}
            {title && (
              <h3
                className="text-sm font-semibold mb-2"
                style={{ color: accentColor }}
              >
                {title}
              </h3>
            )}

            {/* Content */}
            <p className="text-sm text-foreground/90 leading-relaxed">
              {content}
            </p>

            {/* Arrow */}
            <div style={getArrowStyles()} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
