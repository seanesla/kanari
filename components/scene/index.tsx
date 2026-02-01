"use client"

import { useEffect, useRef, useState } from "react"
import { Canvas } from "@react-three/fiber"
import { useReducedMotion } from "framer-motion"
import { useSceneMode } from "@/lib/scene-context"
import { SCENE_COLORS } from "@/lib/constants"
import { getGraphicsProfile } from "@/lib/graphics/quality"
import { R3FJankLogger } from "@/components/perf/r3f-jank-logger"
import { CAMERA, FOG } from "./constants"
import { Scene } from "./scene-canvas"
import { LoadingOverlay } from "./loading-overlay"
import { SceneBackgroundFallback } from "./fallback"

// Inner component that uses the scene context
function SceneBackgroundInner() {
  const { mode, scrollProgressRef, isLoading, setIsLoading, graphicsQuality } = useSceneMode()
  // Avoid mounting the heavy R3F scene while the startup logo animation is playing.
  // The logo overlay fully covers the screen anyway, and deferring the 3D mount
  // prevents main-thread + GPU work from causing visible stutter in the logo.
  //
  // Once the logo finishes, we *prewarm* the canvas behind the overlay before it fades
  // out. That hides any one-time WebGL init work and avoids a noticeable hitch.
  const [prewarmCanvas, setPrewarmCanvas] = useState(false)
  const [canvasMounted, setCanvasMounted] = useState(() => !isLoading && mode !== "dashboard")
  const reducedMotion = useReducedMotion()
  const profile = getGraphicsProfile(graphicsQuality, { prefersReducedMotion: Boolean(reducedMotion) })
  const powerPreference: WebGLPowerPreference =
    mode === "landing" ? "high-performance" : profile.quality === "high" ? "high-performance" : "low-power"
  const [isPageVisible, setIsPageVisible] = useState(() => {
    if (typeof document === "undefined") return true
    return document.visibilityState !== "hidden"
  })
  const loadingTimeoutRef = useRef<number | null>(null)

  const handleAnimationComplete = () => {
    // Mount the canvas *behind* the overlay immediately so WebGL setup doesn't
    // happen on the same frame the overlay starts fading out.
    setPrewarmCanvas(true)

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
  // - Never mount during the startup overlay (keeps the logo animation smooth)
  //   unless we're explicitly prewarming right after the logo completes.
  // - Keep it mounted during transitions so the fade-out still renders.
  // - Unmount it once we are fully in dashboard mode to stop the R3F render loop.
  useEffect(() => {
    if (mode === "dashboard") {
      const timer = window.setTimeout(() => setCanvasMounted(false), 250)
      return () => window.clearTimeout(timer)
    }

    if (isLoading && !prewarmCanvas) {
      setCanvasMounted(false)
      return
    }

    setCanvasMounted(true)
  }, [mode, isLoading, prewarmCanvas])

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
    let lastScrollY = -1
    let lastScrollEventAt = 0
    let lastScrollChangeAt = 0
    const IDLE_STOP_MS = 140

    const computeMaxScroll = () => {
      maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
    }

    const updateProgress = () => {
      const progress = maxScroll > 0 ? Math.min(1, window.scrollY / maxScroll) : 0
      scrollProgressRef.current = progress
    }

    const stopRaf = () => {
      if (rafId === null) return
      window.cancelAnimationFrame(rafId)
      rafId = null
    }

    const tick = () => {
      const y = window.scrollY
      const now = performance.now()

      if (y !== lastScrollY) {
        lastScrollY = y
        lastScrollChangeAt = now
        updateProgress()
      }

      // On iOS, scroll events can be throttled heavily during momentum scrolling.
      // Sampling scroll position on rAF keeps the 3D scene parallax in sync, but we
      // only keep the rAF loop alive while scroll is actually changing.
      if (now - lastScrollChangeAt > IDLE_STOP_MS && now - lastScrollEventAt > IDLE_STOP_MS) {
        stopRaf()
        return
      }

      rafId = window.requestAnimationFrame(tick)
    }

    const startRaf = () => {
      if (rafId !== null) return
      const now = performance.now()
      lastScrollEventAt = now
      lastScrollChangeAt = now
      lastScrollY = window.scrollY
      updateProgress()
      rafId = window.requestAnimationFrame(tick)
    }

    const onScroll = () => {
      lastScrollEventAt = performance.now()
      updateProgress()
      if (profile.animate) startRaf()
    }

    const onResize = () => {
      computeMaxScroll()
      updateProgress()
    }

    computeMaxScroll()
    updateProgress()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onResize, { passive: true })

    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onResize)
      stopRaf()
    }
  }, [mode, isLoading, isPageVisible, profile.animate, scrollProgressRef])

  return (
    <>
      <LoadingOverlay visible={isLoading} onAnimationComplete={handleAnimationComplete} />
      {canvasMounted ? (
        <div className="fixed inset-0 -z-10" style={{ background: SCENE_COLORS.background }}>
          <Canvas
            camera={{ position: [...CAMERA.initialPosition], fov: CAMERA.fov }}
            dpr={profile.dpr}
            gl={{
              antialias: profile.antialias,
              alpha: false,
              powerPreference,
            }}
            frameloop={isPageVisible && profile.animate && !isLoading ? "always" : "demand"}
            onCreated={({ gl }) => {
              gl.setClearColor(SCENE_COLORS.background, 1)
              gl.clear(true, true, true)
            }}
          >
            <R3FJankLogger />
            <color attach="background" args={[SCENE_COLORS.background]} />
            <fog attach="fog" args={[FOG.color, FOG.near, FOG.far]} />
            <Scene scrollProgressRef={scrollProgressRef} mode={mode} />
          </Canvas>
        </div>
      ) : (
        <div className="fixed inset-0 -z-10" style={{ background: SCENE_COLORS.background }} />
      )}
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
