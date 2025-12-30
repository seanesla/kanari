"use client"

/**
 * Theme Selection Step
 *
 * Allows users to choose their accent color during onboarding.
 * Features preset colors and a custom color picker.
 */

import { useState } from "react"
import { motion } from "framer-motion"
import { Palette, Check, Sparkles } from "lucide-react"
import { HexColorPicker, HexColorInput } from "react-colorful"
import { Button } from "@/components/ui/button"
import { useSceneMode } from "@/lib/scene-context"
import { updateCSSVariables } from "@/lib/color-utils"
import { cn } from "@/lib/utils"

interface StepThemeProps {
  onNext: () => void
  onBack: () => void
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

export function StepTheme({ onNext, onBack }: StepThemeProps) {
  const { accentColor, setAccentColor } = useSceneMode()
  const [selectedColor, setSelectedColor] = useState(accentColor)
  const [showCustomPicker, setShowCustomPicker] = useState(false)

  const handleColorSelect = (hex: string) => {
    setSelectedColor(hex)
    updateCSSVariables(hex)
    setShowCustomPicker(false)
  }

  const handleCustomColorChange = (hex: string) => {
    setSelectedColor(hex)
    updateCSSVariables(hex)
  }

  const handleNext = () => {
    setAccentColor(selectedColor)
    onNext()
  }

  const isPresetSelected = presetColors.some((c) => c.hex.toLowerCase() === selectedColor.toLowerCase())

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
          <Palette className="h-8 w-8 text-accent" />
        </motion.div>
        <motion.h1
          className="text-3xl md:text-4xl font-serif"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Choose Your <span className="text-accent">Theme</span>
        </motion.h1>
        <motion.p
          className="text-muted-foreground max-w-md mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Pick an accent color that resonates with you. This color will personalize your kanari experience.
        </motion.p>
      </div>

      {/* Color swatches grid */}
      <motion.div
        className="grid grid-cols-4 gap-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
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
            transition={{ delay: 0.3 + i * 0.05, type: "spring", stiffness: 300, damping: 20 }}
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
        transition={{ delay: 0.5 }}
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
              <p className="text-xs text-muted-foreground font-mono">{selectedColor.toUpperCase()}</p>
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

      {/* Preview text */}
      <motion.div
        className="text-center p-6 rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <p className="text-sm text-muted-foreground mb-2">Preview</p>
        <p className="text-2xl font-serif">
          Your <span className="text-accent">kanari</span> awaits
        </p>
      </motion.div>

      {/* Actions */}
      <motion.div
        className="flex justify-between pt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleNext}>Continue</Button>
      </motion.div>
    </div>
  )
}
