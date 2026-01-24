"use client"

import { useEffect, useRef, useState } from "react"
import { Canvas } from "@react-three/fiber"
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
    if (mode !== "landing" || isLoading) return

    const handleScroll = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      const progress = maxScroll > 0 ? Math.min(1, window.scrollY / maxScroll) : 0
      scrollProgressRef.current = progress
    }

    // Immediately calculate scroll position when entering landing mode
    handleScroll()

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [mode, isLoading, scrollProgressRef])

  return (
    <>
      <LoadingOverlay visible={isLoading} onAnimationComplete={handleAnimationComplete} />
      {canvasMounted ? (
        <div className="fixed inset-0 -z-10">
          <Canvas
            camera={{ position: [...CAMERA.initialPosition], fov: CAMERA.fov }}
            dpr={[1, 1.5]}
            gl={{ antialias: true, alpha: true }}
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
