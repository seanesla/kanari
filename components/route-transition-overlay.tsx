"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"

const TRANSITION_MS = 420

function getRouteGroup(pathname: string) {
  if (pathname.startsWith("/dashboard")) return "dashboard"
  if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) return "onboarding"
  return "landing"
}

export function RouteTransitionOverlay() {
  const pathname = usePathname()
  const lastPathnameRef = useRef<string | null>(null)
  const lastGroupRef = useRef<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [visible, setVisible] = useState(false)

  useLayoutEffect(() => {
    const nextGroup = getRouteGroup(pathname)

    if (lastPathnameRef.current === null) {
      lastPathnameRef.current = pathname
      lastGroupRef.current = nextGroup
      return
    }

    if (lastPathnameRef.current === pathname) return

    const lastGroup = lastGroupRef.current
    lastPathnameRef.current = pathname
    lastGroupRef.current = nextGroup

    // Avoid the "page refresh" feel when navigating inside the dashboard.
    // Keep the existing overlay behavior for other route changes.
    if (lastGroup === "dashboard" && nextGroup === "dashboard") return

    setVisible(true)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setVisible(false)
    }, TRANSITION_MS)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [pathname])

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="fixed inset-0 z-[10005] pointer-events-auto"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14, ease: "easeOut" }}
        >
          <div className="absolute inset-0 bg-background/70 backdrop-blur-md" />

          {/* Soft glass bloom (no sweeping/strobe) */}
          <motion.div
            className="pointer-events-none absolute inset-0"
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.015 }}
            transition={{ duration: TRANSITION_MS / 1000, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="absolute -top-32 left-1/2 h-[520px] w-[780px] -translate-x-1/2 rounded-full bg-accent/12 blur-3xl" />
            <div className="absolute top-[35vh] -left-32 h-[420px] w-[520px] rounded-full bg-foreground/5 blur-3xl" />
            <div className="absolute bottom-[-180px] right-[-140px] h-[520px] w-[680px] rounded-full bg-accent/10 blur-3xl" />
          </motion.div>

          <div className="absolute inset-0 bg-gradient-to-b from-background/35 via-transparent to-background/35" />
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
