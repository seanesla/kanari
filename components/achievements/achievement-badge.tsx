"use client"

/**
 * Daily Achievement Card
 *
 * Displays a single daily achievement (challenge or badge).
 * The old rarity-based UI is intentionally removed for the daily system.
 */

import { motion } from "framer-motion"
import { CheckCircle2, Clock, Flame, Heart, Sparkles, Target, TrendingUp, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTimeZone } from "@/lib/timezone-context"
import type { DailyAchievement, DailyAchievementCategory } from "@/lib/achievements"

const CATEGORY_CONFIG: Record<
  DailyAchievementCategory,
  {
    icon: typeof Flame
    color: string
    bgColor: string
    borderColor: string
  }
> = {
  consistency: {
    icon: Flame,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
  },
  improvement: {
    icon: TrendingUp,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
  },
  engagement: {
    icon: Zap,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
  },
  recovery: {
    icon: Heart,
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/30",
  },
}

interface DailyAchievementCardProps {
  achievement: DailyAchievement
  variant?: "compact" | "full"
  showNewIndicator?: boolean
  onClick?: () => void
  className?: string
}

export function DailyAchievementCard({
  achievement,
  variant = "full",
  showNewIndicator = false,
  onClick,
  className,
}: DailyAchievementCardProps) {
  const { timeZone } = useTimeZone()
  const config = CATEGORY_CONFIG[achievement.category]
  const CategoryIcon = config.icon

  const isNew = showNewIndicator && achievement.completed && !achievement.seen
  const isCompleted = achievement.completed
  const isChallenge = achievement.type === "challenge"

  const statusLabel = achievement.expired
    ? "Expired"
    : isCompleted
      ? "Completed"
      : isChallenge
        ? "In progress"
        : "Earned"

  const statusIcon = achievement.expired
    ? Clock
    : isCompleted
      ? CheckCircle2
      : isChallenge
        ? Target
        : Sparkles

  const StatusIcon = statusIcon

  const carriedOverLabel =
    achievement.carriedOver && achievement.sourceDateISO !== achievement.dateISO
      ? `Carried from ${achievement.sourceDateISO}`
      : null

  if (variant === "compact") {
    return (
      <motion.button
        onClick={onClick}
        className={cn(
          "relative flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
          "hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-accent/50",
          config.bgColor,
          config.borderColor,
          className
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        type="button"
      >
        <span className="text-lg">{achievement.emoji}</span>
        <span className={cn("text-sm font-medium truncate", config.color)}>{achievement.title}</span>

        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          +{achievement.points}
        </span>

        {isCompleted && (
          <CheckCircle2 className={cn("h-4 w-4 flex-shrink-0", config.color)} />
        )}

        {isNew && (
          <motion.div
            className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-accent"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            <motion.div
              className="absolute inset-0 rounded-full bg-accent"
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            />
          </motion.div>
        )}
      </motion.button>
    )
  }

  return (
    <motion.div
      onClick={onClick}
      className={cn(
        "relative p-4 rounded-xl border transition-all",
        onClick && "cursor-pointer hover:shadow-lg",
        config.bgColor,
        config.borderColor,
        achievement.expired && "opacity-60",
        className
      )}
      whileHover={onClick ? { scale: 1.01 } : undefined}
      whileTap={onClick ? { scale: 0.99 } : undefined}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex-shrink-0 h-12 w-12 rounded-lg flex items-center justify-center text-2xl border",
            config.borderColor
          )}
        >
          {achievement.emoji}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={cn("font-semibold truncate", config.color)}>{achievement.title}</h3>
            {isNew && (
              <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-medium bg-accent text-accent-foreground rounded">
                NEW
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CategoryIcon className={cn("h-3 w-3", config.color)} />
              <span className="capitalize">{achievement.category}</span>
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="inline-flex items-center gap-1">
              <StatusIcon className="h-3 w-3" />
              <span>{statusLabel}</span>
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="tabular-nums">+{achievement.points} pts</span>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mt-3">{achievement.description}</p>

      {achievement.insight && (
        <div className="mt-3 pt-3 border-t border-border/30">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            <span>{achievement.insight}</span>
          </div>
        </div>
      )}

      {carriedOverLabel && (
        <p className="text-xs text-muted-foreground/80 mt-2">{carriedOverLabel}</p>
      )}

      <p className="text-xs text-muted-foreground/70 mt-2">
        {achievement.type === "challenge" ? "For" : "Awarded"}{" "}
        {new Date(`${achievement.dateISO}T00:00:00`).toLocaleDateString("en-US", { timeZone })}
      </p>
    </motion.div>
  )
}

export { CATEGORY_CONFIG }

