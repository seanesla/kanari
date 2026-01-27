"use client"

import { useEffect, useRef, useState } from "react"
import { Canvas } from "@react-three/fiber"
import { useReducedMotion } from "framer-motion"
import { useSceneMode } from "@/lib/scene-context"
import { SCENE_COLORS } from "@/lib/constants"
import { CAMERA, FOG } from "./constants"
import { Scene } from "./scene-canvas"
import { LoadingOverlay } from "./loading-overlay"
import { SceneBackgroundFallback } from "./fallback"

// Inner component that uses the scene context
function SceneBackgroundInner() {
  const { mode, scrollProgressRef, isLoading, setIsLoading } = useSceneMode()
  const [canvasMounted, setCanvasMounted] = useState(true)
  const reducedMotion = useReducedMotion()
  const [isPageVisible, setIsPageVisible] = useState(() => {
    if (typeof document === "undefined") return true
    return document.visibilityState !== "hidden"
  })
  const loadingTimeoutRef = useRef<number | null>(null)

  const handleAnimationComplete = () => {
    // Small delay after animation completes for smooth transition
    if (loadingTimeoutRef.current !== null) {
      window.clearTimeout(loadingTimeoutRef.current)
    }
    loadingTimeoutRef.current = window.setTimeout(() => setIsLoading(false), 300)
  }

  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current !== null) {
        window.clearTimeout(loadingTimeoutRef.current)
        loadingTimeoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (typeof document === "undefined") return

    const onVisibilityChange = () => {
      setIsPageVisible(document.visibilityState !== "hidden")
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [])

  // Mount/unmount the heavy 3D canvas.
  // Keep it mounted during transitions so the fade-out still renders.
  // Unmount it once we are fully in dashboard mode to stop the R3F render loop.
  useEffect(() => {
    if (mode === "dashboard") {
      const timer = window.setTimeout(() => setCanvasMounted(false), 250)
      return () => window.clearTimeout(timer)
    }

    setCanvasMounted(true)
  }, [mode])

  // Disable body scroll during loading animation
  useEffect(() => {
    if (isLoading) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isLoading])

  useEffect(() => {
    // Only track scroll in landing mode and when not loading
    if (mode !== "landing" || isLoading || !isPageVisible) return

    let rafId: number | null = null
    let maxScroll = 0

    const computeMaxScroll = () => {
      maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
    }

    const update = () => {
      // On iOS, scroll events can be throttled heavily during momentum scrolling.
      // Sampling scroll position on rAF keeps the 3D scene parallax in sync.
      const progress = maxScroll > 0 ? Math.min(1, window.scrollY / maxScroll) : 0
      scrollProgressRef.current = progress
      rafId = window.requestAnimationFrame(update)
    }

    computeMaxScroll()
    update()

    window.addEventListener("resize", computeMaxScroll, { passive: true })

    return () => {
      window.removeEventListener("resize", computeMaxScroll)
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
      }
    }
  }, [mode, isLoading, isPageVisible, scrollProgressRef])

  return (
    <>
      <LoadingOverlay visible={isLoading} onAnimationComplete={handleAnimationComplete} />
      {canvasMounted ? (
        <div className="fixed inset-0 -z-10">
          <Canvas
            camera={{ position: [...CAMERA.initialPosition], fov: CAMERA.fov }}
            dpr={[1, 1.5]}
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
            frameloop={reducedMotion || !isPageVisible ? "demand" : "always"}
          >
            <color attach="background" args={[SCENE_COLORS.background]} />
            <fog attach="fog" args={[FOG.color, FOG.near, FOG.far]} />
            <Scene scrollProgressRef={scrollProgressRef} mode={mode} />
          </Canvas>
        </div>
      ) : null}
    </>
  )
}

// Wrapper that safely handles missing context (for backwards compatibility)
export default function SceneBackground() {
  try {
    return <SceneBackgroundInner />
  } catch {
    // Fallback if used outside provider (backwards compatible)
    return <SceneBackgroundFallback />
  }
}

// Re-export components for potential individual use
export { Scene } from "./scene-canvas"
export { KanariCore } from "./kanari-core"
export { SectionAccent } from "./section-accent"
export { AmbientParticles } from "./ambient-particles"
export { ScrollCamera } from "./scroll-camera"
export { LoadingOverlay } from "./loading-overlay"
export { SceneBackgroundFallback } from "./fallback"
