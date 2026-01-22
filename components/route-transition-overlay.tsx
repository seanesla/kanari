"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"

const TRANSITION_MS = 650

export function RouteTransitionOverlay() {
  const pathname = usePathname()
  const lastPathnameRef = useRef<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [visible, setVisible] = useState(false)

  useLayoutEffect(() => {
    if (lastPathnameRef.current === null) {
      lastPathnameRef.current = pathname
      return
    }

    if (lastPathnameRef.current === pathname) return
    lastPathnameRef.current = pathname

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
          transition={{ duration: 0.12, ease: "easeOut" }}
        >
          <div className="absolute inset-0 bg-background/70 backdrop-blur-md" />

          <motion.div
            className="absolute -inset-[25%] bg-gradient-to-r from-transparent via-accent/20 to-transparent blur-3xl"
            initial={{ x: "-55%", rotate: -12 }}
            animate={{ x: "55%", rotate: -12 }}
            transition={{ duration: TRANSITION_MS / 1000, ease: [0.22, 1, 0.36, 1] }}
          />

          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background/40" />
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
