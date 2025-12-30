"use client"

/**
 * Achievement Toast / Celebration Component
 *
 * A celebratory modal that appears when a user earns a new achievement.
 * Features confetti animation, sound effects (optional), and smooth transitions.
 *
 * Usage:
 * ```tsx
 * <AchievementToast
 *   achievement={newAchievement}
 *   open={showCelebration}
 *   onOpenChange={setShowCelebration}
 *   onDismiss={() => markAsSeen(newAchievement.id)}
 * />
 * ```
 */

import { useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Trophy, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { AchievementBadge, RARITY_CONFIG } from "./achievement-badge"
import type { StoredAchievement } from "@/lib/achievements"

// ============================================
// Confetti Particle Component
// ============================================

interface ConfettiParticleProps {
  index: number
  color: string
}

function ConfettiParticle({ index, color }: ConfettiParticleProps) {
  const randomX = Math.random() * 200 - 100 // -100 to 100
  const randomDelay = Math.random() * 0.5
  const randomDuration = 1.5 + Math.random() * 1
  const randomRotation = Math.random() * 720 - 360

  return (
    <motion.div
      className="absolute w-3 h-3 rounded-sm"
      style={{ backgroundColor: color }}
      initial={{
        x: 0,
        y: 0,
        scale: 0,
        rotate: 0,
        opacity: 1,
      }}
      animate={{
        x: randomX,
        y: [0, -50, 150],
        scale: [0, 1, 0.5],
        rotate: randomRotation,
        opacity: [1, 1, 0],
      }}
      transition={{
        duration: randomDuration,
        delay: randomDelay,
        ease: "easeOut",
      }}
    />
  )
}

// ============================================
// Confetti Explosion Component
// ============================================

const CONFETTI_COLORS = [
  "#FFD700", // Gold
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#A855F7", // Purple
  "#F97316", // Orange
  "#22C55E", // Green
]

function ConfettiExplosion() {
  const particles = Array.from({ length: 30 }, (_, i) => i)

  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
      {particles.map((i) => (
        <ConfettiParticle
          key={i}
          index={i}
          color={CONFETTI_COLORS[i % CONFETTI_COLORS.length]}
        />
      ))}
    </div>
  )
}

// ============================================
// Component Props
// ============================================

interface AchievementToastProps {
  /** The achievement to celebrate */
  achievement: StoredAchievement | null
  /** Whether the toast is visible */
  open: boolean
  /** Callback when visibility changes */
  onOpenChange: (open: boolean) => void
  /** Callback when user dismisses (to mark as seen) */
  onDismiss?: () => void
  /** Auto-dismiss after this many milliseconds (0 = no auto-dismiss) */
  autoDismissMs?: number
}

// ============================================
// Main Component
// ============================================

export function AchievementToast({
  achievement,
  open,
  onOpenChange,
  onDismiss,
  autoDismissMs = 5000,
}: AchievementToastProps) {
  // Auto-dismiss after timeout
  useEffect(() => {
    if (!open || autoDismissMs === 0) return

    const timer = setTimeout(() => {
      handleDismiss()
    }, autoDismissMs)

    return () => clearTimeout(timer)
  }, [open, autoDismissMs])

  const handleDismiss = useCallback(() => {
    onOpenChange(false)
    onDismiss?.()
  }, [onOpenChange, onDismiss])

  if (!achievement) return null

  const rarityConfig = RARITY_CONFIG[achievement.rarity]

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDismiss}
          />

          {/* Toast Container */}
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <motion.div
              className="relative pointer-events-auto max-w-sm w-full mx-4"
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              {/* Confetti */}
              <ConfettiExplosion />

              {/* Card */}
              <div className={cn(
                "relative bg-card rounded-2xl border-2 p-6 shadow-2xl overflow-hidden",
                rarityConfig.borderStyle
              )}>
                {/* Glow background for rare+ */}
                {(achievement.rarity === "rare" || achievement.rarity === "epic" || achievement.rarity === "legendary") && (
                  <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-accent to-transparent" />
                )}

                {/* Close button */}
                <button
                  onClick={handleDismiss}
                  className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>

                {/* Header */}
                <div className="text-center mb-4">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                    className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-accent/10 mb-3"
                  >
                    <Trophy className="h-8 w-8 text-accent" />
                  </motion.div>

                  <motion.h2
                    className="text-xl font-bold"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    Achievement Unlocked!
                  </motion.h2>

                  <motion.p
                    className="text-sm text-muted-foreground mt-1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <Sparkles className="inline h-3 w-3 mr-1" />
                    You&apos;ve earned a new achievement
                  </motion.p>
                </div>

                {/* Achievement Badge */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <AchievementBadge
                    achievement={achievement}
                    variant="full"
                    showNewIndicator={false}
                  />
                </motion.div>

                {/* Dismiss button */}
                <motion.div
                  className="mt-4 flex justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <Button
                    onClick={handleDismiss}
                    variant="outline"
                    className="w-full"
                  >
                    Awesome!
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

// ============================================
// Queue Component for Multiple Achievements
// ============================================

interface AchievementToastQueueProps {
  /** Array of achievements to show (will show one at a time) */
  achievements: StoredAchievement[]
  /** Callback when an achievement is dismissed */
  onDismiss: (achievementId: string) => void
}

export function AchievementToastQueue({
  achievements,
  onDismiss,
}: AchievementToastQueueProps) {
  // Show the first achievement in the queue
  const currentAchievement = achievements[0] || null

  const handleDismiss = useCallback(() => {
    if (currentAchievement) {
      onDismiss(currentAchievement.id)
    }
  }, [currentAchievement, onDismiss])

  return (
    <AchievementToast
      achievement={currentAchievement}
      open={!!currentAchievement}
      onOpenChange={(open) => {
        if (!open) handleDismiss()
      }}
      onDismiss={handleDismiss}
    />
  )
}
