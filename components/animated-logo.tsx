"use client"

import { motion, useAnimation } from "framer-motion"
import { useEffect, useId, useMemo } from "react"
import { LOGO_PATH } from "./logo"
import { useSceneMode } from "@/lib/scene-context"
import { generateLightVariant, generateDarkVariant } from "@/lib/color-utils"

interface AnimatedLogoProps {
  onComplete?: () => void
  size?: number
}

export function AnimatedLogo({ onComplete, size = 120 }: AnimatedLogoProps) {
  const controls = useAnimation()
  const { accentColor } = useSceneMode()
  const gradientId = useId()

  const gradientColors = useMemo(() => ({
    light: generateLightVariant(accentColor),
    base: accentColor,
    dark: generateDarkVariant(accentColor),
  }), [accentColor])

  useEffect(() => {
    const sequence = async () => {
      // Phase 1: Draw stroke (1.5s)
      await controls.start("drawing")
      // Phase 2: Fill in smoothly (1s)
      await controls.start("filling")
      // Phase 3: Fade out stroke (0.4s)
      await controls.start("complete")
      onComplete?.()
    }
    sequence()
  }, [controls, onComplete])

  return (
    <div className="relative" style={{ width: size, height: size * 1.1 }}>
      <svg viewBox="0 0 185 203" className="w-full h-full">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradientColors.light} />
            <stop offset="50%" stopColor={gradientColors.base} />
            <stop offset="100%" stopColor={gradientColors.dark} />
          </linearGradient>
        </defs>

        <g transform="translate(-9.9154, -51.1603)">
          {/* Fill layer - fades in after stroke completes */}
          <motion.path
            d={LOGO_PATH}
            fill={`url(#${gradientId})`}
            initial={{ fillOpacity: 0 }}
            animate={controls}
            variants={{
              drawing: { fillOpacity: 0 },
              filling: {
                fillOpacity: 1,
                transition: { duration: 1, ease: "easeOut" },
              },
              complete: { fillOpacity: 1 },
            }}
          />

          {/* Stroke layer - draws then fades out */}
          <motion.path
            d={LOGO_PATH}
            fill="transparent"
            stroke={gradientColors.base}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={controls}
            variants={{
              drawing: {
                pathLength: 1,
                opacity: 1,
                transition: {
                  pathLength: { duration: 1.5, ease: "easeInOut" },
                  opacity: { duration: 0.3 },
                },
              },
              filling: {
                opacity: 1,
                transition: { duration: 0.5 },
              },
              complete: {
                opacity: 0,
                transition: { duration: 0.4, ease: "easeOut" },
              },
            }}
          />
        </g>
      </svg>
    </div>
  )
}
