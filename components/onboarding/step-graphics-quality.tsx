"use client"

/**
 * Graphics Quality Step
 *
 * Lets the user pick a performance preset before heavy 3D scenes.
 */

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Gauge } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useSceneMode } from "@/lib/scene-context"
import { GRAPHICS_PRESET_OPTIONS } from "@/lib/graphics/quality"
import { cn } from "@/lib/utils"
import type { GraphicsQuality, UserSettings } from "@/lib/types"

interface StepGraphicsQualityProps {
  initialSettings: Partial<UserSettings>
  onNext: (updates: Partial<UserSettings>) => Promise<void>
  onBack: () => void
}

export function StepGraphicsQuality({
  initialSettings,
  onNext,
  onBack,
}: StepGraphicsQualityProps) {
  const { previewGraphicsQuality } = useSceneMode()
  const initialQuality = (initialSettings.graphicsQuality ?? "auto") as GraphicsQuality
  const [selectedQuality, setSelectedQuality] = useState<GraphicsQuality>(initialQuality)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    previewGraphicsQuality(selectedQuality)
  }, [previewGraphicsQuality, selectedQuality])

  const handleNext = async () => {
    setIsSubmitting(true)
    try {
      await onNext({ graphicsQuality: selectedQuality })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <motion.div
          className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-accent/10 mx-auto"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Gauge className="h-8 w-8 text-accent" />
        </motion.div>
        <motion.h1
          className="text-3xl md:text-4xl font-serif"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Graphics quality
        </motion.h1>
        <motion.p
          className="text-muted-foreground max-w-md mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Choose how intense the fog and background effects should be. You can change this later in Settings.
        </motion.p>
      </div>

      {/* Options */}
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <RadioGroup
          value={selectedQuality}
          onValueChange={(value) => setSelectedQuality(value as GraphicsQuality)}
          className="gap-3"
        >
          {GRAPHICS_PRESET_OPTIONS.map((option) => (
            <label
              key={option.value}
              htmlFor={`graphics-quality-${option.value}`}
              className={cn(
                "flex items-start gap-3 rounded-xl border border-border/50 bg-card/20 px-4 py-3 transition-colors",
                selectedQuality === option.value
                  ? "border-accent/40 bg-card/30"
                  : "hover:border-accent/20"
              )}
            >
              <RadioGroupItem
                value={option.value}
                id={`graphics-quality-${option.value}`}
                className="mt-1"
              />
              <div className="space-y-1">
                <p className="font-medium text-sm">{option.label}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
            </label>
          ))}
        </RadioGroup>
      </motion.div>

      {/* Actions */}
      <motion.div
        className="flex justify-between pt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button onClick={handleNext} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Continue"}
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}
