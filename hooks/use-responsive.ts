"use client"

import { useState, useEffect } from "react"

/**
 * Hook for responsive breakpoint detection
 *
 * @param breakpoint - Width in pixels below which is considered "mobile" (default: 1024)
 * @returns Object with isMobile boolean
 */
export function useResponsive(breakpoint: number = 1024) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < breakpoint)

    // Check on mount
    checkMobile()

    // Listen for resize events
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [breakpoint])

  return { isMobile }
}
