"use client"

/**
 * Welcome Splash Overlay
 *
 * Full-screen overlay that plays on first load of onboarding.
 * Timing: ~1s fade in, ~3s hold, ~1s fade out.
 * Not a step - it overlays the onboarding page initially before step 1 appears.
 */

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useSceneMode } from "@/lib/scene-context"

interface WelcomeSplashProps {
  /** Called when the splash animation completes */
  onComplete: () => void
}

export function WelcomeSplash({ onComplete }: WelcomeSplashProps) {
  const [isVisible, setIsVisible] = useState(true)
  const { accentColor } = useSceneMode()

  useEffect(() => {
    // Total duration: 1s fade in + 3s hold + 1s fade out = 5s
    // We start fading out after 4s (1s in + 3s hold)
    const fadeOutTimer = setTimeout(() => {
      setIsVisible(false)
    }, 4000)

    // Complete callback after full animation (5s total)
    const completeTimer = setTimeout(() => {
      onComplete()
    }, 5000)

    return () => {
      clearTimeout(fadeOutTimer)
      clearTimeout(completeTimer)
    }
  }, [onComplete])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1, ease: "easeInOut" }}
        >
          <div className="text-center space-y-6">
            {/* Animated logo/brand mark */}
            <motion.div
              className="relative mx-auto"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
            >
              {/* Glowing accent circle */}
              <motion.div
                className="absolute inset-0 rounded-full blur-3xl opacity-30"
                style={{ backgroundColor: accentColor }}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.5, 0.3],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
              {/* Brand text */}
              <motion.h1
                className="text-6xl md:text-8xl font-serif tracking-tight"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
              >
                <span className="text-accent">k</span>anari
              </motion.h1>
            </motion.div>

            {/* Tagline */}
            <motion.p
              className="text-lg md:text-xl text-muted-foreground max-w-md mx-auto"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.8, ease: "easeOut" }}
            >
              Your voice knows when you&apos;re heading toward burnout.
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
