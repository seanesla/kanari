"use client"

/**
 * Hero Color Picker
 *
 * Wraps content (like the kanari logo) with an interactive glass container
 * that reveals on hover and opens a color picker on click.
 */

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { HexColorPicker } from "react-colorful"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useSceneMode } from "@/lib/scene-context"
import { updateCSSVariables } from "@/lib/color-utils"

interface HeroColorPickerProps {
  children: React.ReactNode
}

export function HeroColorPicker({ children }: HeroColorPickerProps) {
  const { accentColor, setAccentColor } = useSceneMode()
  const [localColor, setLocalColor] = useState(accentColor)
  const [isHovered, setIsHovered] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [showHint, setShowHint] = useState(false)

  // Show hint after a delay on every page visit
  useEffect(() => {
    const showTimer = setTimeout(() => {
      setShowHint(true)
    }, 2000) // Show after 2s delay

    const hideTimer = setTimeout(() => {
      setShowHint(false)
    }, 6000) // Auto-hide after 6s total (4s visible)

    return () => {
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
    }
  }, [])

  // Sync with context changes
  useEffect(() => {
    setLocalColor(accentColor)
  }, [accentColor])

  const handleColorChange = (newColor: string) => {
    setLocalColor(newColor)
    updateCSSVariables(newColor)
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      // Persist to context/IndexedDB on close
      setAccentColor(localColor)
    }
    // Hide hint when user interacts
    if (open && showHint) {
      setShowHint(false)
    }
  }

  const handleHoverStart = () => {
    setIsHovered(true)
    // Hide hint on hover
    if (showHint) {
      setShowHint(false)
    }
  }

  return (
    <div className="relative inline-block">
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <motion.button
            className="relative rounded-2xl px-4 py-2 -mx-4 -my-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            onHoverStart={handleHoverStart}
            onHoverEnd={() => setIsHovered(false)}
            whileTap={{ scale: 0.98 }}
            animate={{
              backgroundColor: isHovered || isOpen ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0)",
              borderColor: isHovered || isOpen ? `${accentColor}30` : "rgba(255,255,255,0)",
              boxShadow: isHovered || isOpen
                ? `0 0 30px ${accentColor}20, inset 0 1px 0 0 rgba(255,255,255,0.05)`
                : "0 0 0px transparent",
            }}
            transition={{ duration: 0.3 }}
            style={{
              border: "1px solid transparent",
              backdropFilter: isHovered || isOpen ? "blur(12px)" : "blur(0px)",
              WebkitBackdropFilter: isHovered || isOpen ? "blur(12px)" : "blur(0px)",
            }}
            aria-label="Click to customize accent color"
          >
            {children}

            {/* Subtle shimmer effect on hover */}
            <AnimatePresence>
              {(isHovered || isOpen) && (
                <motion.div
                  className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(90deg, transparent 0%, ${accentColor}10 50%, transparent 100%)`,
                    }}
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </PopoverTrigger>

        <PopoverContent
          className="w-auto p-4 bg-background/95 backdrop-blur-xl border-border/50 rounded-xl"
          align="start"
          sideOffset={16}
        >
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="text-center">
              <p className="text-sm font-medium">Customize Theme</p>
              <p className="text-xs text-muted-foreground">Pick your accent color</p>
            </div>
            <HexColorPicker
              color={localColor}
              onChange={handleColorChange}
              style={{ width: 220 }}
            />
            <div className="flex items-center justify-center gap-3 pt-1">
              <div
                className="w-8 h-8 rounded-lg border border-border shadow-inner"
                style={{ backgroundColor: localColor }}
              />
              <span className="text-sm font-mono text-muted-foreground">
                {localColor.toUpperCase()}
              </span>
            </div>
          </motion.div>
        </PopoverContent>
      </Popover>

      {/* Discovery hint tooltip */}
      <AnimatePresence>
        {showHint && (
          <motion.div
            className="absolute left-1/2 -translate-x-1/2 top-full mt-3 pointer-events-none z-50"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <div className="relative">
              {/* Arrow */}
              <div
                className="absolute left-1/2 -translate-x-1/2 -top-1.5 w-3 h-3 rotate-45 bg-card border-l border-t border-border/50"
              />
              {/* Tooltip content */}
              <div className="bg-card/95 backdrop-blur-sm border border-border/50 rounded-lg px-3 py-2 shadow-lg">
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  <span className="text-accent">click</span> to customize colors
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
