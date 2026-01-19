"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useSceneMode } from "@/lib/scene-context"
import {
  findDemoElement,
  getElementRect,
  calculateTooltipPosition,
  calculateOptimalPosition,
  getDemoSafeAreas,
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

const MOBILE_BREAKPOINT_PX = 640

function roundToDpr(value: number): number {
  if (typeof window === "undefined") return value
  const dpr = window.devicePixelRatio || 1
  return Math.round(value * dpr) / dpr
}

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
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false
    return window.innerWidth < MOBILE_BREAKPOINT_PX
  })

  const [safeAreas, setSafeAreas] = useState(() => getDemoSafeAreas())
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

  const updateIsMobile = useCallback(() => {
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT_PX)
  }, [])

  // Update tooltip position
  const updatePositionNow = useCallback((safeAreasOverride?: { top: number; bottom: number }) => {
    if (!targetId) return

    const element = findDemoElement(targetId)
    if (!element) return

    const targetRect = getElementRect(element)

    // Mobile: bottom sheet (no arrow, no target-relative positioning)
    if (window.innerWidth < MOBILE_BREAKPOINT_PX) {
      setActualPosition("bottom")
      setCoords({ x: 0, y: 0 })
      return
    }

    // Desktop: Calculate optimal position if not specified
    const optimalPos = preferredPosition || calculateOptimalPosition(targetRect, TOOLTIP_WIDTH, TOOLTIP_MIN_HEIGHT)
    setActualPosition(optimalPos)

    const { x, y } = calculateTooltipPosition(targetRect, optimalPos, TOOLTIP_WIDTH, TOOLTIP_MIN_HEIGHT)

    const activeSafeAreas = safeAreasOverride || safeAreas

    // Clamp within safe areas
    const viewportPaddingX = activeSafeAreas.top
    const viewportPaddingTop = activeSafeAreas.top
    const viewportPaddingBottom = activeSafeAreas.bottom

    const clampedX = Math.max(
      viewportPaddingX,
      Math.min(x, window.innerWidth - TOOLTIP_WIDTH - viewportPaddingX)
    )

    const clampedY = Math.max(
      viewportPaddingTop,
      Math.min(y, window.innerHeight - TOOLTIP_MIN_HEIGHT - viewportPaddingBottom)
    )

    setCoords({ x: roundToDpr(clampedX), y: roundToDpr(clampedY) })
  }, [targetId, preferredPosition, safeAreas])

  const scheduleUpdate = useCallback(() => {
    if (rafIdRef.current != null) return
    rafIdRef.current = requestFrame(() => {
      rafIdRef.current = null
      updateIsMobile()
      setSafeAreas((prev) => {
        const next = getDemoSafeAreas()
        if (prev.top === next.top && prev.bottom === next.bottom) {
          updatePositionNow(prev)
          return prev
        }
        updatePositionNow(next)
        return next
      })
    })
  }, [requestFrame, updateIsMobile, updatePositionNow])

  // Update position on mount and changes
  useEffect(() => {
    if (!isVisible) return

    // Let layout settle (route transitions / smooth scroll), then schedule a frame-based update.
    const timer = window.setTimeout(scheduleUpdate, 250)
    return () => window.clearTimeout(timer)
  }, [isVisible, targetId, scheduleUpdate])

  // Listen for resize/scroll
  useEffect(() => {
    if (!isVisible) return

    scheduleUpdate()

    window.addEventListener("resize", scheduleUpdate)
    window.addEventListener("scroll", scheduleUpdate, true)

    return () => {
      window.removeEventListener("resize", scheduleUpdate)
      window.removeEventListener("scroll", scheduleUpdate, true)
      if (rafIdRef.current != null) {
        cancelFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [isVisible, scheduleUpdate])

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
          className={
            isMobile
              ? "fixed inset-x-0 bottom-0 z-[10000] pointer-events-auto"
              : "fixed left-0 top-0 z-[10000] pointer-events-auto"
          }
          data-testid="demo-tooltip"
          style={
            isMobile
              ? {
                  paddingLeft: safeAreas.top,
                  paddingRight: safeAreas.top,
                  paddingBottom: safeAreas.bottom,
                  willChange: "transform, opacity",
                }
              : {
                  width: TOOLTIP_WIDTH,
                  willChange: "transform, opacity",
                }
          }
          initial={
            isMobile
              ? { opacity: 0, y: 20 }
              : {
                  opacity: 0,
                  scale: 0.98,
                  y: actualPosition === "top" ? 10 : actualPosition === "bottom" ? -10 : 0,
                  x: actualPosition === "left" ? 10 : actualPosition === "right" ? -10 : 0,
                }
          }
          animate={
            isMobile
              ? { opacity: 1, y: 0 }
              : {
                  opacity: 1,
                  scale: 1,
                  x: coords.x,
                  y: coords.y,
                }
          }
          exit={isMobile ? { opacity: 0, y: 20 } : { opacity: 0, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 260, damping: 34, mass: 0.9 }}
        >
          {/* Glass panel container */}
          <div
            className={
              isMobile
                ? "relative bg-foreground/5 backdrop-blur-xl rounded-t-2xl p-5 shadow-2xl"
                : "relative bg-foreground/5 backdrop-blur-xl rounded-xl p-5 shadow-2xl"
            }
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
            {!isMobile && <div style={getArrowStyles()} />}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
