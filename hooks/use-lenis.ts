"use client"

import Lenis from "lenis"
import { useEffect, useRef } from "react"
import { useSceneMode } from "@/lib/scene-context"
import { useIsMobile } from "@/hooks/use-mobile"

export function useLenis() {
  const { mode } = useSceneMode()
  const isMobile = useIsMobile()
  const lenisRef = useRef<Lenis | null>(null)
  const rafIdRef = useRef<number | null>(null)

  useEffect(() => {
    // Only enable Lenis smooth scroll on landing page
    if (mode !== "landing" || isMobile) {
      // Clean up if mode changed away from landing
      if (lenisRef.current) {
        lenisRef.current.destroy()
        lenisRef.current = null
      }
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      return
    }

    // Already running
    if (lenisRef.current) return

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      smoothWheel: true,
    })
    lenisRef.current = lenis

    let cancelled = false

    const stopLoop = () => {
      if (rafIdRef.current === null) return
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }

    const startLoop = () => {
      if (rafIdRef.current !== null) return
      const raf = (time: number) => {
        if (cancelled) return
        lenis.raf(time)
        rafIdRef.current = requestAnimationFrame(raf)
      }
      rafIdRef.current = requestAnimationFrame(raf)
    }

    const onVisibilityChange = () => {
      if (typeof document === "undefined") return
      if (document.visibilityState === "hidden") {
        stopLoop()
        return
      }
      startLoop()
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange)
    }
    onVisibilityChange()

    return () => {
      cancelled = true
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange)
      }

      stopLoop()
      lenis.destroy()
      lenisRef.current = null
    }
  }, [mode, isMobile])
}
