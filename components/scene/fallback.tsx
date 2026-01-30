"use client"

import { useRef, useEffect, useState } from "react"
import { Canvas } from "@react-three/fiber"
import { useReducedMotion } from "framer-motion"
import { CAMERA, FOG } from "./constants"
import { SCENE_COLORS } from "@/lib/constants"
import { Scene } from "./scene-canvas"
import { LoadingOverlay } from "./loading-overlay"
import { getGraphicsProfile } from "@/lib/graphics/quality"
import { FrameLimiter } from "./frame-limiter"

export function SceneBackgroundFallback() {
  const scrollProgressRef = useRef(0)
  const [loading, setLoading] = useState(true)
  const loadingTimeoutRef = useRef<number | null>(null)
  const reducedMotion = useReducedMotion()
  const profile = getGraphicsProfile("auto", { prefersReducedMotion: Boolean(reducedMotion) })

  const handleAnimationComplete = () => {
    if (loadingTimeoutRef.current !== null) {
      window.clearTimeout(loadingTimeoutRef.current)
    }
    loadingTimeoutRef.current = window.setTimeout(() => setLoading(false), 300)
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
    const handleScroll = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      const progress = Math.min(1, window.scrollY / maxScroll)
      scrollProgressRef.current = progress
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <>
      <LoadingOverlay visible={loading} onAnimationComplete={handleAnimationComplete} />
      <div className="fixed inset-0 -z-10">
        <Canvas
          camera={{ position: [...CAMERA.initialPosition], fov: CAMERA.fov }}
          dpr={profile.dpr}
          gl={{ antialias: profile.antialias, alpha: true }}
          frameloop={profile.maxFps === null && profile.animate ? "always" : "demand"}
        >
          {profile.maxFps !== null ? <FrameLimiter maxFps={profile.maxFps} /> : null}
          <color attach="background" args={[SCENE_COLORS.background]} />
          <fog attach="fog" args={[FOG.color, FOG.near, FOG.far]} />
          <Scene scrollProgressRef={scrollProgressRef} mode="landing" />
        </Canvas>
      </div>
    </>
  )
}
