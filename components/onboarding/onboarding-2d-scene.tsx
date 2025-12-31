"use client"

/**
 * Onboarding 2D Scene
 *
 * Mobile-friendly onboarding flow that renders the current step as a normal
 * 2D panel with smooth Framer Motion transitions.
 */

import React from "react"
import { AnimatePresence, motion } from "framer-motion"

interface Onboarding2DSceneProps {
  currentStep: number
  children: React.ReactNode
}

export function Onboarding2DScene({ currentStep, children }: Onboarding2DSceneProps) {
  const steps = React.Children.toArray(children)
  const step = steps[currentStep] ?? null

  return (
    <div className="relative min-h-svh">
      <div
        className="relative z-10 mx-auto w-full max-w-lg px-4"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 5.5rem)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 3.5rem)",
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div className="rounded-2xl border border-border/50 bg-card/25 backdrop-blur-md p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
              {step}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

