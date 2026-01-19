"use client"

import { useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useSceneMode } from "@/lib/scene-context"
import {
  calculateTooltipPosition,
  calculateOptimalPosition,
} from "@/lib/demo/demo-utils"
import type { TooltipPosition } from "./steps/types"

interface DemoTooltipProps {
  targetRect: DOMRect | null
  content: string
  title?: string
  position?: TooltipPosition
  isVisible: boolean
  safeAreas: { top: number; bottom: number }
  viewport: { width: number; height: number }
}

const TOOLTIP_WIDTH = 340
const TOOLTIP_MIN_HEIGHT = 100

const MOBILE_BREAKPOINT_PX = 640
const TRACKING_EASE = [0.22, 0.61, 0.36, 1] as const
const TRACKING_DURATION = 0.22

function roundToDpr(value: number): number {
  if (typeof window === "undefined") return value
  const dpr = window.devicePixelRatio || 1
  return Math.round(value * dpr) / dpr
}

export function DemoTooltip({
  targetRect,
  content,
  title,
  position: preferredPosition,
  isVisible,
  safeAreas,
  viewport,
}: DemoTooltipProps) {
  const { accentColor } = useSceneMode()
  const isMobile = viewport.width > 0 && viewport.width < MOBILE_BREAKPOINT_PX

  const { coords, actualPosition } = useMemo(() => {
    if (!targetRect || isMobile) {
      return {
        coords: { x: 0, y: 0 },
        actualPosition: "bottom" as TooltipPosition,
      }
    }

    const optimalPos = preferredPosition || calculateOptimalPosition(targetRect, TOOLTIP_WIDTH, TOOLTIP_MIN_HEIGHT)
    const { x, y } = calculateTooltipPosition(targetRect, optimalPos, TOOLTIP_WIDTH, TOOLTIP_MIN_HEIGHT)

    const horizontalPadding = 16
    const verticalPadding = 12
    const safeTop = safeAreas.top + verticalPadding
    const safeBottom = safeAreas.bottom + verticalPadding

    const clampedX = Math.max(
      horizontalPadding,
      Math.min(x, viewport.width - TOOLTIP_WIDTH - horizontalPadding)
    )

    const clampedY = Math.max(
      safeTop,
      Math.min(y, viewport.height - TOOLTIP_MIN_HEIGHT - safeBottom)
    )

    return {
      coords: { x: roundToDpr(clampedX), y: roundToDpr(clampedY) },
      actualPosition: optimalPos,
    }
  }, [targetRect, isMobile, preferredPosition, safeAreas, viewport])

  const shouldRender = isVisible && !!targetRect

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
      {shouldRender && (
        <motion.div
          className={
            isMobile
              ? "fixed inset-x-0 bottom-0 z-[10000] pointer-events-auto"
              : "fixed left-0 top-0 z-[10000] pointer-events-auto"
          }
          data-testid="demo-tooltip"
          style={
            isMobile
              ? {
                  paddingLeft: 16,
                  paddingRight: 16,
                  paddingBottom: safeAreas.bottom + 12,
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
                  scale: 0.99,
                  y: actualPosition === "top" ? 8 : actualPosition === "bottom" ? -8 : 0,
                  x: actualPosition === "left" ? 8 : actualPosition === "right" ? -8 : 0,
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
          exit={isMobile ? { opacity: 0, y: 20 } : { opacity: 0, scale: 0.99 }}
          transition={{ duration: TRACKING_DURATION, ease: TRACKING_EASE }}
        >
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
            {title && (
              <h3 className="text-sm font-semibold mb-2" style={{ color: accentColor }}>
                {title}
              </h3>
            )}

            <p className="text-sm text-foreground/90 leading-relaxed">
              {content}
            </p>

            {!isMobile && <div style={getArrowStyles()} />}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
