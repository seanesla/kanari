"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { ChevronLeft, ChevronRight, Pause, Play, X } from "@/lib/icons"
import { useSceneMode } from "@/lib/scene-context"
import { useDemo } from "./demo-provider"

const AUTO_ADVANCE_MS = 6500

export function DemoControls() {
  const { accentColor } = useSceneMode()
  const {
    isActive,
    currentStepIndex,
    totalSteps,
    isNavigating,
    nextStep,
    previousStep,
    stopDemo,
  } = useDemo()
  const [isAutoPlay, setIsAutoPlay] = useState(true)

  const isComplete = currentStepIndex >= totalSteps
  const isFirstStep = currentStepIndex <= 0

  useEffect(() => {
    if (!isActive) return
    if (!isAutoPlay) return
    if (isNavigating) return
    if (isComplete) return

    const timerId = window.setTimeout(() => nextStep(), AUTO_ADVANCE_MS)
    return () => window.clearTimeout(timerId)
  }, [isActive, isAutoPlay, currentStepIndex, isComplete, isNavigating, nextStep])

  if (!isActive) return null
  if (isComplete) return null

  return (
    <motion.div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10001] pointer-events-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
    >
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-full bg-background/80 backdrop-blur-xl border border-foreground/10"
        style={{
          boxShadow: `0 4px 30px rgba(0, 0, 0, 0.2)`,
        }}
      >
        {/* Step counter */}
        <span className="text-sm text-muted-foreground min-w-[60px]">
          {currentStepIndex + 1} / {totalSteps}
        </span>

        {/* Autoplay toggle */}
        <button
          onClick={() => setIsAutoPlay((v) => !v)}
          className="p-2 rounded-full hover:bg-foreground/10 transition-colors"
          title={isAutoPlay ? "Pause autoplay" : "Resume autoplay"}
        >
          {isAutoPlay ? <Pause className="h-4 w-4 text-muted-foreground" /> : <Play className="h-4 w-4 text-muted-foreground" />}
        </button>

        {/* Back button */}
        <button
          onClick={previousStep}
          disabled={isNavigating || isFirstStep}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-full border border-foreground/15 hover:bg-foreground/5 transition-all disabled:opacity-50"
          title="Previous step"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Next button */}
        <button
          onClick={nextStep}
          disabled={isNavigating}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full transition-all disabled:opacity-50"
          style={{
            backgroundColor: accentColor,
            color: "black",
          }}
        >
          {isNavigating ? "Loading..." : "Next"}
          {!isNavigating && <ChevronRight className="h-4 w-4" />}
        </button>

        {/* Exit button */}
        <button
          onClick={stopDemo}
          className="p-2 rounded-full hover:bg-foreground/10 transition-colors"
          title="Exit demo"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </motion.div>
  )
}
