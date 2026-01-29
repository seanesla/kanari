"use client"

import { useCallback, useSyncExternalStore } from "react"
import { BREAKPOINTS } from "@/lib/constants"

export function useIsMobile() {
  // Error pattern doc: docs/error-patterns/undefined-hook-deps-getSnapshot.md
  const mediaQuery = `(max-width: ${BREAKPOINTS.mobile - 1}px)`

  const subscribe = useCallback((callback: () => void) => {
    const onChange = () => callback()

    const mql = window.matchMedia?.(mediaQuery)

    if (mql) {
      if ("addEventListener" in mql) mql.addEventListener("change", onChange)
      else (mql as unknown as { addListener: (cb: () => void) => void }).addListener(onChange)
    }

    // Fallback for browsers that don't reliably fire matchMedia events on rotate.
    window.addEventListener("resize", onChange)

    return () => {
      if (mql) {
        if ("removeEventListener" in mql) mql.removeEventListener("change", onChange)
        else (mql as unknown as { removeListener: (cb: () => void) => void }).removeListener(onChange)
      }
      window.removeEventListener("resize", onChange)
    }
  }, [mediaQuery])

  const getSnapshot = useCallback(() => window.innerWidth < BREAKPOINTS.mobile, [])
  const getServerSnapshot = useCallback(() => false, [])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
