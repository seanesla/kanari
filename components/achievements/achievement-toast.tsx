"use client"

/**
 * Celebration Toast / Modal Component
 *
 * A celebratory modal that appears when a user completes a challenge,
 * earns a badge, or unlocks a milestone.
 * Features confetti animation, sound effects (optional), and smooth transitions.
 *
 * Usage:
 * ```tsx
 * <CelebrationToastQueue
 *   achievements={celebrations}
 *   milestones={milestones}
 *   onDismissAchievement={markAchievementSeen}
 *   onDismissMilestone={markMilestoneSeen}
 * />
 * ```
 */

import { useEffect, useCallback, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle, Sparks, Trophy, Xmark } from "iconoir-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DailyAchievementCard } from "./achievement-badge"
import { getMilestoneBadgeIcon } from "./achievement-icons"
import type { DailyAchievement, MilestoneBadge } from "@/lib/achievements"

// ============================================
// Confetti Particle Component
// ============================================

interface ConfettiParticleProps {
  color: string
}

function ConfettiParticle({ color }: ConfettiParticleProps) {
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
          color={CONFETTI_COLORS[i % CONFETTI_COLORS.length]}
        />
      ))}
    </div>
  )
}

// ============================================
// Component Props
// ============================================

type CelebrationItem =
  | { kind: "achievement"; achievement: DailyAchievement }
  | { kind: "milestone"; milestone: MilestoneBadge }

interface CelebrationToastProps {
  item: CelebrationItem | null
  /** Whether the toast is visible */
  open: boolean
  /** Callback when visibility changes */
  onOpenChange: (open: boolean) => void
  /** Callback when user dismisses (to mark as seen) */
  onDismiss?: () => void
  /** Called after exit animation completes */
  onAfterClose?: () => void
  /** Auto-dismiss after this many milliseconds (0 = no auto-dismiss) */
  autoDismissMs?: number
}

// ============================================
// Main Component
// ============================================

export function CelebrationToast({
  item,
  open,
  onOpenChange,
  onDismiss,
  onAfterClose,
  autoDismissMs = 5000,
}: CelebrationToastProps) {
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

  if (!item) return null

  const heading =
    item.kind === "milestone"
      ? "Milestone Unlocked!"
      : item.achievement.type === "challenge"
        ? "Challenge Complete!"
        : "Badge Earned!"

  const subheading =
    item.kind === "milestone"
      ? `Streak: ${item.milestone.streakDays} days`
      : item.achievement.type === "challenge"
        ? `+${item.achievement.points} points`
        : `+${item.achievement.points} points`

  const milestoneIcon = item.kind === "milestone" ? getMilestoneBadgeIcon(item.milestone.type) : null

  return (
    <AnimatePresence onExitComplete={onAfterClose}>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Toast Container */}
          <div
            className="fixed inset-0 flex items-center justify-center z-50"
            data-testid="celebration-toast-overlay"
            onClick={handleDismiss}
          >
            <motion.div
              className="relative pointer-events-auto max-w-sm w-full mx-4"
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={(event) => event.stopPropagation()}
            >
              {/* Confetti */}
              <ConfettiExplosion />

              {/* Card */}
              <div className={cn(
                "relative bg-card rounded-2xl border p-6 shadow-2xl overflow-hidden",
                item.kind === "milestone" ? "border-accent/40" : "border-border/60"
              )}>
                {/* Subtle glow */}
                <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-accent to-transparent" />

                {/* Close button */}
                <button
                  onClick={handleDismiss}
                  className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted transition-colors"
                >
                  <Xmark className="h-4 w-4 text-muted-foreground" />
                </button>

                {/* Header */}
                <div className="text-center mb-4">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                    className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-accent/10 mb-3"
                  >
                    {item.kind === "milestone" ? (
                      <Trophy className="h-8 w-8 text-accent" />
                    ) : (
                      <CheckCircle className="h-8 w-8 text-accent" />
                    )}
                  </motion.div>

                  <motion.h2
                    className="text-xl font-bold"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    {heading}
                  </motion.h2>

                  <motion.p
                    className="text-sm text-muted-foreground mt-1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <Sparks className="inline h-3 w-3 mr-1" />
                    {subheading}
                  </motion.p>
                </div>

                {/* Content */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  {item.kind === "achievement" ? (
                    <DailyAchievementCard achievement={item.achievement} variant="full" showNewIndicator={false} />
                  ) : (
                    <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-12 w-12 rounded-lg border border-accent/30 flex items-center justify-center text-2xl">
                          {milestoneIcon && <milestoneIcon.Icon className={cn("h-6 w-6", milestoneIcon.colorClass)} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-semibold truncate">{item.milestone.title}</h3>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {item.milestone.streakDays}d
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{item.milestone.description}</p>
                        </div>
                      </div>
                    </div>
                  )}
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

interface CelebrationToastQueueProps {
  achievements: DailyAchievement[]
  milestones: MilestoneBadge[]
  onDismissAchievement: (achievementId: string) => void
  onDismissMilestone: (badgeId: string) => void
}

export function CelebrationToastQueue({
  achievements,
  milestones,
  onDismissAchievement,
  onDismissMilestone,
}: CelebrationToastQueueProps) {
  const [ignoredAchievementIds, setIgnoredAchievementIds] = useState<Set<string>>(() => new Set())
  const [ignoredMilestoneIds, setIgnoredMilestoneIds] = useState<Set<string>>(() => new Set())
  const [visibleItem, setVisibleItem] = useState<CelebrationItem | null>(null)
  const [open, setOpen] = useState(false)

  const pendingItems: CelebrationItem[] = useMemo(() => {
    const nextMilestones = milestones
      .filter((m) => !ignoredMilestoneIds.has(m.id))
      .map((m) => ({ kind: "milestone" as const, milestone: m }))

    const nextAchievements = achievements
      .filter((a) => !ignoredAchievementIds.has(a.id))
      .map((a) => ({ kind: "achievement" as const, achievement: a }))

    return [...nextMilestones, ...nextAchievements]
  }, [achievements, ignoredAchievementIds, ignoredMilestoneIds, milestones])

  // If there's no visible item (or it disappeared because it got marked seen), show the next.
  useEffect(() => {
    if (open) return
    if (visibleItem) {
      const visibleId = visibleItem.kind === "milestone" ? visibleItem.milestone.id : visibleItem.achievement.id
      const stillPending = pendingItems.some((item: CelebrationItem) => {
        const id = item.kind === "milestone" ? item.milestone.id : item.achievement.id
        return id === visibleId
      })
      if (stillPending) return
    }

    const next = pendingItems[0] ?? null
    setVisibleItem(next)
    setOpen(!!next)
  }, [open, pendingItems, visibleItem])

  const markIgnoredAndSeen = useCallback(() => {
    if (!visibleItem) return
    if (visibleItem.kind === "milestone") {
      const id = visibleItem.milestone.id
      setIgnoredMilestoneIds((prev: Set<string>) => {
        const next = new Set(prev)
        next.add(id)
        return next
      })
      onDismissMilestone(id)
      return
    }

    const id = visibleItem.achievement.id
    setIgnoredAchievementIds((prev: Set<string>) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
    onDismissAchievement(id)
  }, [onDismissAchievement, onDismissMilestone, visibleItem])

  const handleAfterClose = useCallback(() => {
    // Once the exit animation completes, rotate the queue.
    const next = pendingItems[0] ?? null
    setVisibleItem(next)
    setOpen(!!next)
  }, [pendingItems])

  return (
    <CelebrationToast
      item={visibleItem}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
      }}
      onDismiss={markIgnoredAndSeen}
      onAfterClose={handleAfterClose}
    />
  )
}
