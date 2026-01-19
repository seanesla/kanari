"use client"

import { motion } from "framer-motion"
import { useSceneMode } from "@/lib/scene-context"
import { useDemo } from "./demo-provider"

export function DemoProgress() {
  const { accentColor } = useSceneMode()
  const { isActive, currentStepIndex, totalSteps } = useDemo()

  if (!isActive) return null

  const progress = ((currentStepIndex + 1) / totalSteps) * 100
  const isComplete = currentStepIndex >= totalSteps

  if (isComplete) return null

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-[10001] pointer-events-none"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      {/* Progress bar */}
      <div className="h-1 bg-foreground/10 relative overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0"
          style={{ backgroundColor: accentColor }}
          initial={{ width: "0%" }}
          animate={{ width: `${progress}%` }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
        />
      </div>
    </motion.div>
  )
}
