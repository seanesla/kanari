"use client"

/**
 * Intro Step
 *
 * First step of onboarding - collects user's name and preferred accent color.
 * Replaces the old Welcome + Theme steps in a single combined step.
 */

import { useState } from "react"
import { motion } from "framer-motion"
import { User, Check, Sparkles } from "@/lib/icons"
import { HexColorPicker, HexColorInput } from "react-colorful"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useSceneMode } from "@/lib/scene-context"
import { updateCSSVariables } from "@/lib/color-utils"
import { cn } from "@/lib/utils"
import type { UserSettings } from "@/lib/types"

interface StepIntroProps {
  initialSettings: Partial<UserSettings>
  onNext: (settings: Partial<UserSettings>) => Promise<void>
}

// Curated preset colors with names
const presetColors = [
  { name: "Amber", hex: "#d4a574" },
  { name: "Rose", hex: "#e57373" },
  { name: "Coral", hex: "#ff7f50" },
  { name: "Violet", hex: "#9575cd" },
  { name: "Sky", hex: "#64b5f6" },
  { name: "Teal", hex: "#4db6ac" },
  { name: "Mint", hex: "#81c784" },
  { name: "Gold", hex: "#ffd54f" },
]

export function StepIntro({ initialSettings, onNext }: StepIntroProps) {
  const { accentColor, setAccentColor } = useSceneMode()
  const [userName, setUserName] = useState(initialSettings?.userName || "")
  const [selectedColor, setSelectedColor] = useState(initialSettings?.accentColor || accentColor)
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleColorSelect = (hex: string) => {
    setSelectedColor(hex)
    updateCSSVariables(hex)
    setShowCustomPicker(false)
  }

  const handleCustomColorChange = (hex: string) => {
    setSelectedColor(hex)
    updateCSSVariables(hex)
  }

  const handleNext = async () => {
    setIsSubmitting(true)
    // Persist accent color to context (which saves to IndexedDB)
    setAccentColor(selectedColor)
    // Pass settings to parent to save
    await onNext({
      userName: userName.trim() || undefined,
      accentColor: selectedColor,
    })
    setIsSubmitting(false)
  }

  const isPresetSelected = presetColors.some(
    (c) => c.hex.toLowerCase() === selectedColor.toLowerCase()
  )

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
          <User className="h-8 w-8 text-accent" />
        </motion.div>
        <motion.h1
          className="text-3xl md:text-4xl font-serif"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Welcome to <span className="text-accent">kanari</span>
        </motion.h1>
        <motion.p
          className="text-muted-foreground max-w-md mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Let&apos;s personalize your experience. What should we call you?
        </motion.p>
      </div>

      {/* Name input */}
      <motion.div
        className="space-y-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Label htmlFor="userName" className="text-sm text-muted-foreground">
          Your name (optional)
        </Label>
        <Input
          id="userName"
          type="text"
          placeholder="Enter your name..."
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          className="h-12 text-lg"
          maxLength={50}
        />
      </motion.div>

      {/* Color section header */}
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <p className="text-muted-foreground">Choose your accent color</p>
      </motion.div>

      {/* Color swatches grid */}
      <motion.div
        className="grid grid-cols-4 gap-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        {presetColors.map((color, i) => (
          <motion.button
            key={color.hex}
            onClick={() => handleColorSelect(color.hex)}
            className={cn(
              "relative aspect-square rounded-xl transition-all duration-300",
              "border-2 hover:scale-105",
              selectedColor.toLowerCase() === color.hex.toLowerCase()
                ? "border-white shadow-lg"
                : "border-transparent hover:border-white/30"
            )}
            style={{
              backgroundColor: color.hex,
              boxShadow:
                selectedColor.toLowerCase() === color.hex.toLowerCase()
                  ? `0 0 20px ${color.hex}60, 0 0 40px ${color.hex}30`
                  : undefined,
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 + i * 0.05, type: "spring", stiffness: 300, damping: 20 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
          >
            {selectedColor.toLowerCase() === color.hex.toLowerCase() && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
              >
                <Check className="h-6 w-6 text-white drop-shadow-lg" />
              </motion.div>
            )}
            <span className="sr-only">{color.name}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* Custom color option */}
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <button
          onClick={() => setShowCustomPicker(!showCustomPicker)}
          className={cn(
            "w-full p-4 rounded-xl border transition-all duration-300",
            "flex items-center justify-between",
            showCustomPicker || !isPresetSelected
              ? "border-accent/50 bg-accent/5"
              : "border-border/50 hover:border-border hover:bg-card/50"
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg border border-white/20"
              style={{ backgroundColor: selectedColor }}
            />
            <div className="text-left">
              <p className="text-sm font-medium">Custom Color</p>
              <p className="text-xs text-muted-foreground font-mono">
                {selectedColor.toUpperCase()}
              </p>
            </div>
          </div>
          <Sparkles className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Expanded custom picker */}
        {showCustomPicker && (
          <motion.div
            className="p-4 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm space-y-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <HexColorPicker
              color={selectedColor}
              onChange={handleCustomColorChange}
              style={{ width: "100%" }}
            />
            <HexColorInput
              color={selectedColor}
              onChange={handleCustomColorChange}
              prefixed
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm font-mono focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </motion.div>
        )}
      </motion.div>

      {/* Actions */}
      <motion.div
        className="flex justify-center pt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <Button onClick={handleNext} size="lg" className="px-8" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Continue"}
        </Button>
      </motion.div>
    </div>
  )
}
