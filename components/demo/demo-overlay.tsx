"use client"

import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useRef, useState, useCallback } from "react"
import { useDemo } from "./demo-provider"
import { DemoSpotlight } from "./demo-spotlight"
import { DemoTooltip } from "./demo-tooltip"
import { DemoControls } from "./demo-controls"
import { DemoProgress } from "./demo-progress"
import { useSceneMode } from "@/lib/scene-context"
import { useDemoPosition } from "@/hooks/use-demo-position"
import { CheckCircle2, RotateCcw, ArrowRight } from "@/lib/icons"

export function DemoOverlay() {
  const {
    isActive,
    currentStepIndex,
    totalSteps,
    highlightedElement,
    isNavigating,
    isTransitioning,
    getCurrentStep,
    stopDemo,
    goToStep,
    nextStep,
    previousStep,
  } = useDemo()
  const { accentColor } = useSceneMode()

  const currentStep = getCurrentStep()
  const isComplete = currentStepIndex >= totalSteps
  const [isExiting, setIsExiting] = useState(false)
  const exitTimeoutRef = useRef<number | null>(null)
  const demoPosition = useDemoPosition({
    targetId: highlightedElement,
    enabled: isActive,
  })

  useEffect(() => {
    return () => {
      if (exitTimeoutRef.current !== null) {
        window.clearTimeout(exitTimeoutRef.current)
        exitTimeoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!isActive) return

    const shouldIgnoreKeyEvent = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName.toLowerCase()
      return (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        tag === "button" ||
        tag === "a" ||
        target.isContentEditable
      )
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreKeyEvent(event.target)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === "Escape") {
        event.preventDefault()
        stopDemo()
        return
      }

      if (isNavigating || isTransitioning || isComplete || isExiting) return
      if (event.key === "ArrowRight" || event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        nextStep()
        return
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault()
        previousStep()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isActive, isComplete, isNavigating, isTransitioning, isExiting, nextStep, previousStep, stopDemo])

  const handleExitToOverview = useCallback(() => {
    if (isExiting) return
    setIsExiting(true)

    if (exitTimeoutRef.current !== null) {
      window.clearTimeout(exitTimeoutRef.current)
    }
    exitTimeoutRef.current = window.setTimeout(() => {
      exitTimeoutRef.current = null
      stopDemo("/overview")
    }, 280)
  }, [isExiting, stopDemo])

  if (!isActive) return null

  return (
    <>
      <DemoProgress />

      {/*
        Interaction shield:
        - Blocks all pointer/touch interactions with the underlying app (including the navbar)
        - Does NOT visually dim (the spotlight SVG handles dimming + cutout)
        - Sits below spotlight/tooltip/controls via z-index
      */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[9996] pointer-events-auto touch-none overscroll-none"
      />


      {/* Loading overlay during page transitions */}
      <AnimatePresence>
        {isNavigating && (
          <motion.div
            className="fixed inset-0 z-[10003] flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="flex flex-col items-center gap-4"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {/* Simple loading spinner */}
              <motion.div
                className="w-8 h-8 border-2 rounded-full"
                style={{ borderColor: `${accentColor}30`, borderTopColor: accentColor }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spotlight on target element */}
      <AnimatePresence mode="wait">
        {!isComplete && !isNavigating && highlightedElement && (
          <DemoSpotlight
            rect={demoPosition.targetRect}
            isScrolling={demoPosition.isScrolling}
          />
        )}
      </AnimatePresence>

      {/* Tooltip with content */}
      {!isNavigating && !isTransitioning && (
        <DemoTooltip
          targetRect={demoPosition.targetRect}
          safeAreas={demoPosition.safeAreas}
          viewport={demoPosition.viewport}
          content={currentStep?.content || ""}
          title={currentStep?.title}
          position={currentStep?.position}
          isVisible={!isComplete && !!currentStep && !!demoPosition.targetRect}
        />
      )}

      {/* Navigation controls */}
      <DemoControls />

      {/* Completion overlay */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            className="fixed inset-0 z-[10002] flex items-center justify-center bg-background/90 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: isExiting ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
          >
            <motion.div
              className="max-w-sm mx-4 p-8 rounded-2xl bg-card/50 backdrop-blur-xl text-center border border-foreground/10"
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: isExiting ? 0.97 : 1, y: isExiting ? 6 : 0 }}
              transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
            >
              {/* Success icon */}
              <motion.div
                className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${accentColor}20` }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.2 }}
              >
                <CheckCircle2 className="w-6 h-6" style={{ color: accentColor }} />
              </motion.div>

              <h2 className="text-xl font-semibold mb-2">That's Kanari!</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Ready to try it yourself?
              </p>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => goToStep(0)}
                  disabled={isExiting}
                  className="flex items-center gap-2 px-4 py-2 text-sm border border-foreground/20 rounded-full hover:bg-foreground/5 transition-colors disabled:opacity-60"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restart
                </button>
                <button
                  onClick={handleExitToOverview}
                  disabled={isExiting}
                  className="flex items-center gap-2 px-4 py-2 text-sm rounded-full transition-colors disabled:opacity-80"
                  style={{ backgroundColor: accentColor, color: "black" }}
                >
                  Go to Overview
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
