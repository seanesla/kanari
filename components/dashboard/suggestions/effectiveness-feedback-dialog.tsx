"use client"

/**
 * Effectiveness Feedback Dialog
 *
 * Shown after a user marks a suggestion as complete.
 * Collects feedback on whether the suggestion was helpful.
 *
 * Features:
 * - Simple rating selection (very helpful, somewhat helpful, not helpful)
 * - Optional skip option for users who don't want to provide feedback
 * - Clean, non-intrusive design
 * - Stores feedback in the suggestion record
 *
 * Usage:
 * ```tsx
 * <EffectivenessFeedbackDialog
 *   suggestion={completedSuggestion}
 *   open={showFeedback}
 *   onOpenChange={setShowFeedback}
 *   onSubmit={(feedback) => updateSuggestion(suggestion.id, { effectiveness: feedback })}
 * />
 * ```
 */

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ThumbsUp, ThumbsDown, Minus, X, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { Suggestion, EffectivenessFeedback, EffectivenessRating } from "@/lib/types"

// ============================================
// Rating Configuration
// ============================================

/**
 * Configuration for each rating option
 * Includes icon, label, description, and styling
 */
const RATING_CONFIG: Record<
  Exclude<EffectivenessRating, "skipped">,
  {
    icon: typeof ThumbsUp
    label: string
    description: string
    color: string
    bgColor: string
    borderColor: string
  }
> = {
  very_helpful: {
    icon: ThumbsUp,
    label: "Very Helpful",
    description: "This really made a difference",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
  },
  somewhat_helpful: {
    icon: Minus,
    label: "Somewhat Helpful",
    description: "It helped a little bit",
    color: "text-accent",
    bgColor: "bg-accent/10",
    borderColor: "border-accent/30",
  },
  not_helpful: {
    icon: ThumbsDown,
    label: "Not Helpful",
    description: "This didn't help much",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    borderColor: "border-muted-foreground/30",
  },
}

// ============================================
// Component Props
// ============================================

interface EffectivenessFeedbackDialogProps {
  /** The suggestion that was just completed */
  suggestion: Suggestion | null
  /** Whether the dialog is open */
  open: boolean
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void
  /** Callback when feedback is submitted */
  onSubmit: (feedback: EffectivenessFeedback) => void
  /** Optional callback when user skips feedback */
  onSkip?: () => void
}

// ============================================
// Main Component
// ============================================

export function EffectivenessFeedbackDialog({
  suggestion,
  open,
  onOpenChange,
  onSubmit,
  onSkip,
}: EffectivenessFeedbackDialogProps) {
  // Track the selected rating before submission
  const [selectedRating, setSelectedRating] = useState<EffectivenessRating | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Don't render if no suggestion
  if (!suggestion) return null

  /**
   * Handle rating selection
   * Immediately submits feedback when a rating is clicked
   */
  const handleRatingClick = async (rating: EffectivenessRating) => {
    setSelectedRating(rating)
    setIsSubmitting(true)

    // Create feedback object
    const feedback: EffectivenessFeedback = {
      rating,
      ratedAt: new Date().toISOString(),
    }

    // Small delay for visual feedback before closing
    await new Promise((resolve) => setTimeout(resolve, 300))

    onSubmit(feedback)
    setIsSubmitting(false)
    setSelectedRating(null)
    onOpenChange(false)
  }

  /**
   * Handle skip action
   * Marks feedback as skipped and closes dialog
   */
  const handleSkip = () => {
    const feedback: EffectivenessFeedback = {
      rating: "skipped",
      ratedAt: new Date().toISOString(),
    }
    onSubmit(feedback)
    onSkip?.()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/70 bg-card/95 backdrop-blur-xl max-w-sm">
        <DialogHeader className="text-center">
          {/* Success indicator */}
          <motion.div
            className="mx-auto mb-4 h-12 w-12 rounded-full bg-success/10 flex items-center justify-center"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Sparkles className="h-6 w-6 text-success" />
          </motion.div>

          <DialogTitle className="text-lg">Nice work!</DialogTitle>

          <DialogDescription className="text-sm text-muted-foreground mt-2">
            Did this suggestion help you feel better?
          </DialogDescription>
        </DialogHeader>

        {/* Rating buttons */}
        <div className="space-y-2 py-4">
          {(Object.keys(RATING_CONFIG) as Array<Exclude<EffectivenessRating, "skipped">>).map(
            (rating) => {
              const config = RATING_CONFIG[rating]
              const Icon = config.icon
              const isSelected = selectedRating === rating

              return (
                <motion.button
                  key={rating}
                  onClick={() => handleRatingClick(rating)}
                  disabled={isSubmitting}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all",
                    "hover:border-opacity-60 focus:outline-none focus:ring-2 focus:ring-accent/50",
                    isSelected
                      ? cn(config.bgColor, config.borderColor)
                      : "border-border/50 hover:border-border"
                  )}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div
                    className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                      config.bgColor
                    )}
                  >
                    <Icon className={cn("h-4 w-4", config.color)} />
                  </div>
                  <div className="text-left">
                    <p className={cn("font-medium text-sm", config.color)}>
                      {config.label}
                    </p>
                    <p className="text-xs text-muted-foreground">{config.description}</p>
                  </div>

                  {/* Selection indicator */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        className="ml-auto"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                      >
                        <div className={cn("h-5 w-5 rounded-full", config.bgColor)}>
                          <Sparkles className={cn("h-5 w-5", config.color)} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              )
            }
          )}
        </div>

        {/* Skip button */}
        <div className="flex justify-center pb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            disabled={isSubmitting}
            className="text-muted-foreground text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Skip for now
          </Button>
        </div>

        {/* Privacy note */}
        <p className="text-xs text-muted-foreground/70 text-center">
          Your feedback helps us improve suggestions
        </p>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Effectiveness stats summary component
 * Shows aggregated feedback stats for a category or overall
 */
export function EffectivenessStats({
  stats,
  className,
}: {
  stats: {
    veryHelpful: number
    somewhatHelpful: number
    notHelpful: number
    total: number
  }
  className?: string
}) {
  if (stats.total === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        No feedback collected yet
      </p>
    )
  }

  const helpfulPercentage = Math.round(
    ((stats.veryHelpful + stats.somewhatHelpful * 0.5) / stats.total) * 100
  )

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center gap-1">
        <ThumbsUp className="h-3 w-3 text-green-500" />
        <span className="text-xs text-green-500">{stats.veryHelpful}</span>
      </div>
      <div className="flex items-center gap-1">
        <Minus className="h-3 w-3 text-accent" />
        <span className="text-xs text-accent">{stats.somewhatHelpful}</span>
      </div>
      <div className="flex items-center gap-1">
        <ThumbsDown className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{stats.notHelpful}</span>
      </div>
      <span className="text-xs text-muted-foreground ml-2">
        ({helpfulPercentage}% helpful)
      </span>
    </div>
  )
}

// Export types for use in other components
export type { EffectivenessFeedbackDialogProps }
