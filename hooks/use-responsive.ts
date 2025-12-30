"use client"

import { useCallback, useSyncExternalStore } from "react"

/**
 * Hook for responsive breakpoint detection
 *
 * Uses useSyncExternalStore to avoid SSR hydration mismatches.
 * Server always renders with isMobile=false, client hydrates correctly.
 *
 * @param breakpoint - Width in pixels below which is considered "mobile" (default: 1024)
 * @returns Object with isMobile boolean
 */
export function useResponsive(breakpoint: number = 1024) {
  const subscribe = useCallback(
    (callback: () => void) => {
      window.addEventListener("resize", callback)
      return () => window.removeEventListener("resize", callback)
    },
    []
  )

  const getSnapshot = useCallback(
    () => window.innerWidth < breakpoint,
    [breakpoint]
  )

  // Server snapshot: always return false (desktop-first)
  // This ensures consistent SSR output and prevents hydration mismatch
  const getServerSnapshot = useCallback(() => false, [])

  const isMobile = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  return { isMobile }
}
