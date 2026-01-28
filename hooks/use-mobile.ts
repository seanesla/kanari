"use client"

import * as React from "react"
import { BREAKPOINTS } from "@/lib/constants"

export function useIsMobile() {
  const getSnapshot = React.useCallback(() => {
    if (typeof window === "undefined") return false
    return window.innerWidth < BREAKPOINTS.mobile
  }, [])

  const [isMobile, setIsMobile] = React.useState<boolean>(() => getSnapshot())

  React.useEffect(() => {
    const matchMedia = window.matchMedia?.bind(window)

    const onChange = () => setIsMobile(getSnapshot())

    // Some environments (jsdom, older browsers) may not implement matchMedia.
    if (!matchMedia) {
      window.addEventListener("resize", onChange)
      setIsMobile(getSnapshot())
      return () => window.removeEventListener("resize", onChange)
    }

    const mql = matchMedia(`(max-width: ${BREAKPOINTS.mobile - 1}px)`)
    const onMqlChange = () => setIsMobile(mql.matches || window.innerWidth < BREAKPOINTS.mobile)

    mql.addEventListener("change", onMqlChange)
    setIsMobile(mql.matches || window.innerWidth < BREAKPOINTS.mobile)

    // Fallback for browsers that don't reliably fire matchMedia events on rotate.
    window.addEventListener("resize", onMqlChange)

    return () => {
      mql.removeEventListener("change", onMqlChange)
      window.removeEventListener("resize", onMqlChange)
    }
  }, [getSnapshot])

  return isMobile
}
