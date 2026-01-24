"use client"

/**
 * Daily Achievement Card
 *
 * Displays a single daily achievement (challenge or badge).
 * The old rarity-based UI is intentionally removed for the daily system.
 */

import { motion } from "framer-motion"
import { Bonfire, CheckCircle, Clock, Compass, Flash, GraphUp, Heart, Sparks } from "iconoir-react"
import { cn } from "@/lib/utils"
import { useTimeZone } from "@/lib/timezone-context"
import type { DailyAchievement, DailyAchievementCategory } from "@/lib/achievements"
import { getDailyAchievementIcon } from "./achievement-icons"

const CATEGORY_CONFIG: Record<
  DailyAchievementCategory,
  {
    icon: typeof Bonfire
    tone: string
    stripe: string
    softBg: string
  }
> = {
  consistency: {
    icon: Bonfire,
    tone: "text-[color:var(--kanari-tone-consistency)]",
    stripe: "bg-[var(--kanari-tone-consistency)]",
    softBg: "bg-[var(--kanari-tone-consistency-soft)]",
  },
  improvement: {
    icon: GraphUp,
    tone: "text-[color:var(--kanari-tone-improvement)]",
    stripe: "bg-[var(--kanari-tone-improvement)]",
    softBg: "bg-[var(--kanari-tone-improvement-soft)]",
  },
  engagement: {
    icon: Flash,
    tone: "text-[color:var(--kanari-tone-engagement)]",
    stripe: "bg-[var(--kanari-tone-engagement)]",
    softBg: "bg-[var(--kanari-tone-engagement-soft)]",
  },
  recovery: {
    icon: Heart,
    tone: "text-[color:var(--kanari-tone-recovery)]",
    stripe: "bg-[var(--kanari-tone-recovery)]",
    softBg: "bg-[var(--kanari-tone-recovery-soft)]",
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
  const { Icon: AchievementIcon, colorClass: achievementIconColor } = getDailyAchievementIcon(achievement)

  const isNew = showNewIndicator && achievement.completed && !achievement.seen
  const isCompleted = achievement.completed
  const isChallenge = achievement.type === "challenge"
  const shouldStrikeTitle = achievement.type === "challenge" && (isCompleted || achievement.expired)

  const borderClass = achievement.expired
    ? "border-border/40"
    : isCompleted
      ? "border-emerald-500/30"
      : "border-border/60"
  const ringClass = !achievement.expired && isCompleted ? "ring-1 ring-emerald-500/20" : undefined

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
      ? CheckCircle
      : isChallenge
        ? Compass
        : Sparks

  const StatusIcon = statusIcon

  const carriedOverLabel =
    achievement.carriedOver && achievement.sourceDateISO !== achievement.dateISO
      ? `Carried from ${achievement.sourceDateISO}`
      : null

  if (variant === "compact") {
    const baseClasses = cn(
      "relative flex items-center gap-2 pr-3 pl-2 py-2 rounded-lg border bg-card/35 backdrop-blur-sm transition-all",
      borderClass,
      ringClass,
      achievement.expired && "opacity-60",
      className
    )

    const content = (
      <>
        <div
          aria-hidden="true"
          className={cn(
            "w-[3px] self-stretch rounded-full",
            config.stripe,
            achievement.expired && "opacity-40"
          )}
        />
        <AchievementIcon className={cn("h-5 w-5 flex-shrink-0", achievementIconColor)} />
        <span className={cn("text-sm font-medium truncate", shouldStrikeTitle && "line-through opacity-80")}>
          {achievement.title}
        </span>

        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          +{achievement.points}
        </span>

        {isCompleted && (
          <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-400" />
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
      </>
    )

    if (!onClick) {
      return (
        <motion.div className={baseClasses}>
          {content}
        </motion.div>
      )
    }

    return (
      <motion.button
        onClick={onClick}
        className={cn(
          baseClasses,
          "hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-accent/50"
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        type="button"
      >
        {content}
      </motion.button>
    )
  }

  return (
    <motion.div
      onClick={onClick}
      className={cn(
        "relative p-4 pl-6 rounded-xl border bg-card/35 backdrop-blur-sm transition-all",
        onClick && "cursor-pointer hover:shadow-lg",
        borderClass,
        ringClass,
        achievement.expired && "opacity-60",
        className
      )}
      whileHover={onClick ? { scale: 1.01 } : undefined}
      whileTap={onClick ? { scale: 0.99 } : undefined}
    >
      <div
        aria-hidden="true"
        className={cn(
          "absolute left-3 top-4 bottom-4 w-[3px] rounded-full",
          config.stripe,
          achievement.expired && "opacity-40"
        )}
      />

      <div
        className={cn(
          "absolute top-3 right-3 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
          achievement.expired
            ? "border-border/40 bg-muted/40 text-muted-foreground"
            : isCompleted
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
              : "border-border/40 bg-background/40 text-muted-foreground"
        )}
      >
        <StatusIcon className="h-3 w-3" />
        <span>{statusLabel}</span>
      </div>

      <div className="flex items-start gap-3">
        <div
          className={cn(
            "relative flex-shrink-0 h-12 w-12 rounded-lg flex items-center justify-center text-2xl border",
            borderClass
          )}
        >
          <AchievementIcon className={cn("h-6 w-6", achievementIconColor)} />
          {isCompleted && !achievement.expired && (
            <span className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full border border-emerald-500/25 bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={cn("font-semibold truncate", shouldStrikeTitle && "line-through opacity-80")}>
              {achievement.title}
            </h3>
            {isNew && (
              <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-medium bg-accent text-accent-foreground rounded">
                NEW
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CategoryIcon className={cn("h-3 w-3", config.tone)} />
              <span className="capitalize">{achievement.category}</span>
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
            <Sparks className="h-3 w-3" />
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
