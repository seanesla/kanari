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

  // Keep this hook here so the splash reflects current theme state.
  useSceneMode()

  useEffect(() => {
    // Total duration: quick fade in + short hold + fade out.
    const fadeOutTimer = setTimeout(() => {
      setIsVisible(false)
    }, 1800)

    const completeTimer = setTimeout(() => {
      onComplete()
    }, 2200)

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
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <div className="text-center space-y-6">
            {/* Animated logo/brand mark */}
            <motion.div
              className="relative mx-auto"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.12, duration: 0.55, ease: "easeOut" }}
            >
              {/* Brand text */}
              <motion.h1
                className="text-6xl md:text-8xl font-serif tracking-tight"
                initial={{ y: 12, opacity: 0, filter: "blur(10px)" }}
                animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                transition={{ delay: 0.18, duration: 0.75, ease: "easeOut" }}
              >
                <span className="text-accent">k</span>anari
              </motion.h1>
            </motion.div>


          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
