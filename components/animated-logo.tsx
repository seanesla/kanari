"use client"

import { motion, useAnimation } from "framer-motion"
import { useEffect, useId, useMemo } from "react"
import { LOGO_PATHS } from "./logo"
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

  // New aspect ratio: 210:297 (height is 1.414x width)
  return (
    <div className="relative" style={{ width: size, height: size * 1.414 }}>
      <svg viewBox="0 0 210 297" className="w-full h-full">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradientColors.light} />
            <stop offset="50%" stopColor={gradientColors.base} />
            <stop offset="100%" stopColor={gradientColors.dark} />
          </linearGradient>
        </defs>

        <g transform="translate(-6.3331403, 2.3106634)">
          {/* Fill layers - fade in after stroke completes */}
          {LOGO_PATHS.map((path, index) => (
            <motion.path
              key={`fill-${index}`}
              d={path}
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
          ))}

          {/* Stroke layers - draw then fade out */}
          {LOGO_PATHS.map((path, index) => (
            <motion.path
              key={`stroke-${index}`}
              d={path}
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
          ))}
        </g>
      </svg>
    </div>
  )
}
