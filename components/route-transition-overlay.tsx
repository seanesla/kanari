"use client"

import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion"
import { useRouteTransition } from "@/lib/route-transition-context"

export function RouteTransitionOverlay() {
  const { visible, enterMs, exitMs } = useRouteTransition()
  const reduceMotion = useReducedMotion()

  const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]
  const enterTransition = reduceMotion ? { duration: 0 } : { duration: enterMs / 1000, ease: EASE }
  const exitTransition = reduceMotion ? { duration: 0 } : { duration: exitMs / 1000, ease: EASE }

  const variants: Variants = {
    initial: { opacity: 0 },
    enter: { opacity: 1, transition: enterTransition },
    exit: { opacity: 0, transition: exitTransition },
  }

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          // Never block clicks: transitions should feel cosmetic, not modal.
          className="fixed inset-0 z-[10005] pointer-events-none"
          data-route-transition-overlay="true"
          aria-hidden="true"
          variants={variants}
          initial="initial"
          animate="enter"
          exit="exit"
        >
          {/*
            Important: avoid backdrop blur here.
            A long navigation would look like a "stuck blurry screen", which reads as a refresh.
          */}
          <div className="absolute inset-0 bg-background/92 pointer-events-none" />

          {/* Soft accent bloom (no 3D; no strobe) */}
          <motion.div
            className="pointer-events-none absolute inset-0"
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.99 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.01 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    duration: 0.9,
                    ease: [0.22, 1, 0.36, 1],
                  }
            }
          >
            <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-accent/14 blur-3xl pointer-events-none" />
            <div className="absolute top-[30vh] -left-40 h-[480px] w-[580px] rounded-full bg-foreground/6 blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-220px] right-[-180px] h-[560px] w-[760px] rounded-full bg-accent/12 blur-3xl pointer-events-none" />

            {!reduceMotion ? (
              <motion.div
                aria-hidden="true"
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0.0 }}
                animate={{ opacity: [0.0, 0.12, 0.06] }}
                exit={{ opacity: 0.0 }}
                transition={{ duration: 1.4, ease: "easeOut" }}
                style={{
                  background:
                    "radial-gradient(900px 520px at 50% 35%, oklch(from var(--accent) l c h / 0.14), transparent 62%)",
                }}
              />
            ) : null}
          </motion.div>

          <div className="absolute inset-0 bg-gradient-to-b from-background/35 via-transparent to-background/35 pointer-events-none" />
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
