"use client"

/**
 * Welcome Splash Overlay
 *
 * Full-screen overlay that plays on first load of onboarding.
 * Uses the same particle word-formation animation as the 3D onboarding scene,
 * even when the onboarding flow is in 2D mode (mobile/responsive).
 */

import { useEffect, useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import { Canvas } from "@react-three/fiber"
import { AdaptiveDpr } from "@react-three/drei"
import { useSceneMode } from "@/lib/scene-context"
import { getGraphicsProfile } from "@/lib/graphics/quality"
import { FrameLimiter } from "@/components/scene/frame-limiter"
import { WelcomeParticles } from "./welcome-particles"
import { SCENE_COLORS } from "@/lib/constants"

interface WelcomeSplashProps {
  /** Called when the splash animation completes */
  onComplete: () => void
}

export function WelcomeSplash({ onComplete }: WelcomeSplashProps) {
  const [isVisible, setIsVisible] = useState(true)

  // Keep this hook here so the splash reflects current theme state.
  const { accentColor, graphicsQuality } = useSceneMode()
  const reducedMotion = useReducedMotion()
  const profile = getGraphicsProfile(graphicsQuality, { prefersReducedMotion: Boolean(reducedMotion) })
  const powerPreference: WebGLPowerPreference =
    profile.quality === "high" ? "high-performance" : "low-power"

  const handleParticlesComplete = () => {
    setIsVisible(false)
  }

  useEffect(() => {
    // Safety net: never let onboarding get stuck if WebGL fails.
    const fallback = window.setTimeout(() => {
      setIsVisible(false)
    }, 6500)

    return () => {
      window.clearTimeout(fallback)
    }
  }, [])

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          <div className="absolute inset-0">
            <Canvas
              camera={{ position: [0, 0, 8.5], fov: 50, near: 0.1, far: 150 }}
              dpr={profile.dpr}
              gl={{ antialias: profile.antialias, alpha: true, powerPreference }}
              frameloop={profile.maxFps === null && profile.animate ? "always" : "demand"}
            >
              <AdaptiveDpr />
              {profile.maxFps !== null ? <FrameLimiter maxFps={profile.maxFps} /> : null}
              <color attach="background" args={[SCENE_COLORS.background]} />
              <WelcomeParticles
                accentColor={accentColor}
                onComplete={handleParticlesComplete}
              />
            </Canvas>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
