"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ArrowRight, X, Sparkles } from "@/lib/icons"
import { useGuidance } from "./guidance-provider"

/**
 * Non-blocking floating popup that displays the active guidance step.
 *
 * Anchored to the bottom-right corner of the viewport so the user can
 * still interact with the rest of the app while reading.
 */
export function GuidancePopup() {
  const {
    activeGuide,
    currentStep,
    currentStepIndex,
    totalSteps,
    next,
    prev,
    skip,
  } = useGuidance()

  if (!activeGuide || !currentStep) return null

  const isFirst = currentStepIndex === 0
  const isLast = currentStepIndex === totalSteps - 1

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentStep.id}
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="fixed bottom-6 right-6 z-[100] w-[340px] max-w-[calc(100vw-3rem)]"
      >
        <div
          className="relative rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl
            shadow-[0_8px_40px_-12px_rgba(0,0,0,0.7),0_1px_0_rgba(255,255,255,0.04)_inset]
            ring-1 ring-white/5 overflow-hidden"
        >
          {/* Accent top bar */}
          <div className="h-1 bg-accent/60" />

          <div className="p-4">
            {/* Header row */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent shrink-0" />
                <h3 className="text-sm font-semibold font-serif text-foreground leading-tight">
                  {currentStep.title}
                </h3>
              </div>
              <button
                onClick={skip}
                aria-label="Skip guide"
                className="p-1 -m-1 rounded-md text-muted-foreground hover:text-foreground
                  hover:bg-muted/30 transition-colors shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Body */}
            <p className="text-sm text-muted-foreground font-sans leading-relaxed mb-4">
              {currentStep.message}
            </p>

            {/* Footer: step indicator + nav buttons */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground/70 font-mono">
                {currentStepIndex + 1}/{totalSteps}
              </span>

              <div className="flex items-center gap-2">
                {!isFirst && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={prev}
                    aria-label="Previous step"
                    className="h-7 px-2"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="default"
                  size="sm"
                  onClick={next}
                  className="h-7 px-3"
                >
                  {isLast ? "Done" : "Next"}
                  {!isLast && <ArrowRight className="h-3.5 w-3.5 ml-1" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
