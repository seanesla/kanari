"use client"

import { useCallback, useSyncExternalStore } from "react"
import { BREAKPOINTS } from "@/lib/constants"

function getIsCoarsePointer() {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches
}

function getViewportAspectRatio() {
  if (typeof window === "undefined") return 1
  const height = window.innerHeight || 1
  return window.innerWidth / height
}

function computePrefer2D() {
  if (typeof window === "undefined") return true

  const isNarrow = window.innerWidth < BREAKPOINTS.tablet
  const isPortraitish = getViewportAspectRatio() < 4 / 3
  const isTouch = getIsCoarsePointer()

  return Boolean(isNarrow || isPortraitish || isTouch)
}

/**
 * Prefer 2D onboarding on:
 * - narrow viewports (<= tablet width)
 * - portrait-ish aspect ratios
 * - coarse pointers (touch devices)
 *
 * This avoids fragile CSS3D hit-testing on mobile browsers and keeps onboarding usable.
 */
export function usePrefer2DOnboarding() {
  const subscribe = useCallback((callback: () => void) => {
    const onChange = () => callback()

    const matchMedia = window.matchMedia?.bind(window)
    const mqls = matchMedia
      ? [
          matchMedia(`(max-width: ${BREAKPOINTS.tablet - 1}px)`),
          matchMedia("(max-aspect-ratio: 4/3)"),
          matchMedia("(pointer: coarse)"),
        ]
      : []

    for (const mql of mqls) mql.addEventListener("change", onChange)
    window.addEventListener("resize", onChange)

    return () => {
      for (const mql of mqls) mql.removeEventListener("change", onChange)
      window.removeEventListener("resize", onChange)
    }
  }, [])

  const getSnapshot = useCallback(() => computePrefer2D(), [])
  const getServerSnapshot = useCallback(() => true, [])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
