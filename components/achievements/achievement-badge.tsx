"use client"

/**
 * Achievement Badge Component
 *
 * Displays a single achievement with styling based on category and rarity.
 * Includes emoji, title, description, and visual indicators for rarity.
 *
 * Features:
 * - Category-specific icons and colors
 * - Rarity-based styling (common → legendary)
 * - Compact and full display modes
 * - Hover effects and tooltips
 */

import { motion } from "framer-motion"
import { Flame, Target, TrendingUp, Zap, Clock, Heart, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useTimeZone } from "@/lib/timezone-context"
import type { AchievementCategory, AchievementRarity, StoredAchievement } from "@/lib/achievements"

// ============================================
// Configuration
// ============================================

/**
 * Category configuration with icons and colors
 */
const CATEGORY_CONFIG: Record<AchievementCategory, {
  icon: typeof Flame
  color: string
  bgColor: string
  borderColor: string
}> = {
  streak: {
    icon: Flame,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
  },
  milestone: {
    icon: Target,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
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
  pattern: {
    icon: Clock,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
  },
  recovery: {
    icon: Heart,
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    borderColor: "border-pink-500/30",
  },
}

/**
 * Rarity configuration with styling
 */
const RARITY_CONFIG: Record<AchievementRarity, {
  label: string
  textColor: string
  glowColor: string
  borderStyle: string
}> = {
  common: {
    label: "Common",
    textColor: "text-muted-foreground",
    glowColor: "",
    borderStyle: "border-border/50",
  },
  uncommon: {
    label: "Uncommon",
    textColor: "text-green-400",
    glowColor: "",
    borderStyle: "border-green-500/30",
  },
  rare: {
    label: "Rare",
    textColor: "text-blue-400",
    glowColor: "shadow-blue-500/20",
    borderStyle: "border-blue-500/40",
  },
  epic: {
    label: "Epic",
    textColor: "text-purple-400",
    glowColor: "shadow-purple-500/30 shadow-lg",
    borderStyle: "border-purple-500/50",
  },
  legendary: {
    label: "Legendary",
    textColor: "text-amber-400",
    glowColor: "shadow-amber-500/40 shadow-xl",
    borderStyle: "border-amber-500/60 border-2",
  },
}

// ============================================
// Component Props
// ============================================

interface AchievementBadgeProps {
  achievement: StoredAchievement
  /** Display mode: compact shows just icon+title, full shows everything */
  variant?: "compact" | "full"
  /** Show the "NEW" indicator */
  showNewIndicator?: boolean
  /** Click handler */
  onClick?: () => void
  className?: string
}

// ============================================
// Main Component
// ============================================

export function AchievementBadge({
  achievement,
  variant = "full",
  showNewIndicator = false,
  onClick,
  className,
}: AchievementBadgeProps) {
  const { timeZone } = useTimeZone()
  const categoryConfig = CATEGORY_CONFIG[achievement.category]
  const rarityConfig = RARITY_CONFIG[achievement.rarity]
  const CategoryIcon = categoryConfig.icon
  const isNew = showNewIndicator && !achievement.seen

  if (variant === "compact") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button
              onClick={onClick}
              className={cn(
                "relative flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
                "hover:scale-105 focus:outline-none focus:ring-2 focus:ring-accent/50",
                categoryConfig.bgColor,
                rarityConfig.borderStyle,
                rarityConfig.glowColor,
                className
              )}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Emoji */}
              <span className="text-lg">{achievement.emoji}</span>

              {/* Title */}
              <span className={cn("text-sm font-medium", categoryConfig.color)}>
                {achievement.title}
              </span>

              {/* New indicator */}
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
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="font-medium">{achievement.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{achievement.description}</p>
            <p className={cn("text-xs mt-1", rarityConfig.textColor)}>{rarityConfig.label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Full variant
  return (
    <motion.div
      onClick={onClick}
      className={cn(
        "relative p-4 rounded-xl border transition-all cursor-pointer",
        "hover:shadow-lg",
        categoryConfig.bgColor,
        rarityConfig.borderStyle,
        rarityConfig.glowColor,
        onClick && "cursor-pointer",
        className
      )}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Emoji badge */}
        <div className={cn(
          "flex-shrink-0 h-12 w-12 rounded-lg flex items-center justify-center text-2xl",
          "border",
          rarityConfig.borderStyle
        )}>
          {achievement.emoji}
        </div>

        {/* Title and rarity */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={cn("font-semibold truncate", categoryConfig.color)}>
              {achievement.title}
            </h3>
            {isNew && (
              <span className="flex-shrink-0 px-1.5 py-0.5 text-xs font-medium bg-accent text-accent-foreground rounded">
                NEW
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <CategoryIcon className={cn("h-3 w-3", categoryConfig.color)} />
            <span className="text-xs text-muted-foreground capitalize">
              {achievement.category}
            </span>
            <span className="text-muted-foreground">•</span>
            <span className={cn("text-xs", rarityConfig.textColor)}>
              {rarityConfig.label}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground mt-3">
        {achievement.description}
      </p>

      {/* Insight */}
      <div className="mt-3 pt-3 border-t border-border/30">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3" />
          <span>{achievement.insight}</span>
        </div>
      </div>

      {/* Date earned */}
      <p className="text-xs text-muted-foreground/70 mt-2">
        Earned {new Date(achievement.earnedAt).toLocaleDateString("en-US", { timeZone })}
      </p>

      {/* Legendary glow effect */}
      {achievement.rarity === "legendary" && (
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          style={{
            background: "linear-gradient(45deg, transparent 40%, rgba(251, 191, 36, 0.1) 50%, transparent 60%)",
            backgroundSize: "200% 200%",
          }}
          animate={{
            backgroundPosition: ["0% 0%", "200% 200%"],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      )}
    </motion.div>
  )
}

// ============================================
// Exports
// ============================================

export { CATEGORY_CONFIG, RARITY_CONFIG }
