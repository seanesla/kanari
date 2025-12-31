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
      // Phase 1: Draw stroke (1.05s - 30% faster)
      await controls.start("drawing")
      // Phase 2: Fill in smoothly (0.7s - 30% faster)
      await controls.start("filling")
      // Phase 3: Complete (0.28s - 30% faster)
      await controls.start("complete")
      onComplete?.()
    }
    sequence()
  }, [controls, onComplete])

  // Aspect ratio: 152.65:173.92 (height is 1.139x width, similar to old 1.1)
  return (
    <div className="relative" style={{ width: size, height: size * 1.139 }}>
      <svg viewBox="0 0 152.65443 173.92413" className="w-full h-full" overflow="visible">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradientColors.light} />
            <stop offset="50%" stopColor={gradientColors.base} />
            <stop offset="100%" stopColor={gradientColors.dark} />
          </linearGradient>
        </defs>

        <g transform="translate(-35.38, -61.87)">
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
                  transition: { duration: 0.7, ease: "easeOut" },
                },
                complete: { fillOpacity: 1 },
              }}
            />
          ))}

          {/* Stroke layers - draw then disappear */}
          {LOGO_PATHS.map((path, index) => (
            <motion.path
              key={`stroke-${index}`}
              d={path}
              fill="transparent"
              stroke={gradientColors.base}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={controls}
              variants={{
                drawing: {
                  pathLength: 1,
                  opacity: 1,
                  transition: {
                    pathLength: { duration: 1.05, ease: "easeInOut" },
                    opacity: { duration: 0.2 },
                  },
                },
                filling: {
                  opacity: 0,
                  transition: { duration: 0.1 },
                },
                complete: { opacity: 0 },
              }}
            />
          ))}
        </g>
      </svg>
    </div>
  )
}
