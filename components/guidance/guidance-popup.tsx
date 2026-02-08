"use client"

import { useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ArrowRight, X, Sparkles } from "@/lib/icons"
import { useSceneMode } from "@/lib/scene-context"
import { DemoSpotlight } from "@/components/demo/demo-spotlight"
import { useDemoPosition } from "@/hooks/use-demo-position"
import {
  calculateTooltipPosition,
  calculateOptimalPosition,
} from "@/lib/demo/demo-utils"
import { useGuidance } from "./guidance-provider"

/**
 * Guidance UI for first-time and demo guides.
 *
 * - first-time: non-blocking bottom-right helper card
 * - demo: anchored spotlight card with stricter, on-rails controls
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
    canAdvance,
  } = useGuidance()
  const { accentColor } = useSceneMode()

  if (!activeGuide || !currentStep) return null

  const isFirst = currentStepIndex === 0
  const isLast = currentStepIndex === totalSteps - 1
  const isDemoGuide = activeGuide === "demo"
  const targetId = isDemoGuide ? currentStep.target ?? null : null
  const demoPosition = useDemoPosition({ targetId, enabled: isDemoGuide })

  const TOOLTIP_WIDTH = 340
  const TOOLTIP_MIN_HEIGHT = 180
  const MOBILE_BREAKPOINT_PX = 640
  const isMobile = demoPosition.viewport.width > 0 && demoPosition.viewport.width < MOBILE_BREAKPOINT_PX

  const coords = useMemo(() => {
    const fallbackX = Math.max(16, demoPosition.viewport.width - TOOLTIP_WIDTH - 16)
    const fallbackY = Math.max(demoPosition.safeAreas.top + 12, 16)

    if (!demoPosition.targetRect || isMobile) {
      return { x: fallbackX, y: fallbackY }
    }

    const preferredPos = calculateOptimalPosition(
      demoPosition.targetRect,
      TOOLTIP_WIDTH,
      TOOLTIP_MIN_HEIGHT
    )
    const { x, y } = calculateTooltipPosition(
      demoPosition.targetRect,
      preferredPos,
      TOOLTIP_WIDTH,
      TOOLTIP_MIN_HEIGHT
    )

    const safeTop = demoPosition.safeAreas.top + 12
    const safeBottom = demoPosition.safeAreas.bottom + 12

    return {
      x: Math.max(16, Math.min(x, demoPosition.viewport.width - TOOLTIP_WIDTH - 16)),
      y: Math.max(safeTop, Math.min(y, demoPosition.viewport.height - TOOLTIP_MIN_HEIGHT - safeBottom)),
    }
  }, [demoPosition.safeAreas.bottom, demoPosition.safeAreas.top, demoPosition.targetRect, demoPosition.viewport.height, demoPosition.viewport.width, isMobile])

  if (isDemoGuide) {
    const hasTarget = !!demoPosition.targetRect

    return (
      <>
        {hasTarget ? (
          <DemoSpotlight rect={demoPosition.targetRect} isScrolling={demoPosition.isScrolling} />
        ) : (
          <div className="fixed inset-0 z-[9998] pointer-events-none bg-black/70" />
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep.id}
            data-guidance-demo-popup
            initial={
              isMobile
                ? { opacity: 0, y: 20 }
                : { opacity: 0, scale: 0.98, x: coords.x, y: coords.y + 10 }
            }
            animate={
              isMobile
                ? { opacity: 1, y: 0 }
                : { opacity: 1, scale: 1, x: coords.x, y: coords.y }
            }
            exit={isMobile ? { opacity: 0, y: 16 } : { opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
            className={
              isMobile
                ? "fixed inset-x-0 bottom-0 z-[10002] px-4"
                : "fixed left-0 top-0 z-[10002]"
            }
            style={
              isMobile
                ? { paddingBottom: demoPosition.safeAreas.bottom + 12 }
                : { width: TOOLTIP_WIDTH }
            }
          >
            <div
              className={
                isMobile
                  ? "rounded-t-2xl border bg-card/95 backdrop-blur-xl p-5 shadow-2xl"
                  : "rounded-xl border bg-card/95 backdrop-blur-xl p-5 shadow-2xl"
              }
              style={{ borderColor: `${accentColor}40` }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles className="h-4 w-4 shrink-0" style={{ color: accentColor }} />
                  <h3 className="text-sm font-semibold font-serif leading-tight truncate">
                    {currentStep.title}
                  </h3>
                </div>
                <button
                  onClick={skip}
                  aria-label="Skip step"
                  className="p-1 -m-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed mb-4">{currentStep.message}</p>

              {!canAdvance && (
                <p className="text-xs mb-4" style={{ color: accentColor }}>
                  Complete the highlighted action to continue.
                </p>
              )}

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground/70 font-mono">
                  {currentStepIndex + 1}/{totalSteps}
                </span>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={prev}
                    disabled={isFirst}
                    aria-label="Previous step"
                    className="h-7 px-2"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={skip}
                    className="h-7 px-3"
                  >
                    Skip
                  </Button>

                  <Button
                    variant="default"
                    size="sm"
                    onClick={next}
                    disabled={!canAdvance}
                    className="h-7 px-3"
                  >
                    {isLast ? "Done" : "Next"}
                    {!isLast && <ArrowRight className="h-3.5 w-3.5 ml-1" />}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </>
    )
  }

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
