"use client"

/**
 * Achievements Showcase Component
 *
 * Displays all earned achievements in a grid layout with filtering and stats.
 * Can be used as a full page or as a section within another page.
 *
 * Features:
 * - Grid display of all achievements
 * - Filter by category or rarity
 * - Stats summary (total, by rarity)
 * - Empty state for new users
 */

import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import { Trophy, Filter, Sparkles, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AchievementBadge, RARITY_CONFIG, CATEGORY_CONFIG } from "./achievement-badge"
import type { StoredAchievement, AchievementCategory, AchievementRarity } from "@/lib/achievements"

// ============================================
// Stats Summary Component
// ============================================

interface AchievementStatsProps {
  total: number
  countByRarity: Record<string, number>
  className?: string
}

function AchievementStats({ total, countByRarity, className }: AchievementStatsProps) {
  const rarities: AchievementRarity[] = ["legendary", "epic", "rare", "uncommon", "common"]

  return (
    <div className={cn("flex items-center gap-4 flex-wrap", className)}>
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-accent" />
        <span className="font-semibold">{total} Achievements</span>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {rarities.map(rarity => {
          const count = countByRarity[rarity] || 0
          if (count === 0) return null

          const config = RARITY_CONFIG[rarity]
          return (
            <span key={rarity} className={cn("flex items-center gap-1", config.textColor)}>
              <span className="font-medium">{count}</span>
              <span className="capitalize">{rarity}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ============================================
// Empty State Component
// ============================================

function EmptyState({ onGenerate, loading }: { onGenerate?: () => void; loading?: boolean }) {
  return (
    <div className="text-center py-12">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-muted mb-4"
      >
        <Trophy className="h-10 w-10 text-muted-foreground" />
      </motion.div>

      <h3 className="text-lg font-semibold mb-2">No achievements yet</h3>
      <p className="text-muted-foreground max-w-sm mx-auto mb-6">
        Keep using Kanari to track your wellness journey. Achievements are personalized
        and will appear as you build healthy habits.
      </p>

      {onGenerate && (
        <Button onClick={onGenerate} disabled={loading}>
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Checking for achievements...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Check for achievements
            </>
          )}
        </Button>
      )}
    </div>
  )
}

// ============================================
// Component Props
// ============================================

interface AchievementsShowcaseProps {
  achievements: StoredAchievement[]
  countByRarity: Record<string, number>
  loading?: boolean
  onGenerate?: () => void
  onAchievementClick?: (achievement: StoredAchievement) => void
  className?: string
}

// ============================================
// Main Component
// ============================================

export function AchievementsShowcase({
  achievements,
  countByRarity,
  loading = false,
  onGenerate,
  onAchievementClick,
  className,
}: AchievementsShowcaseProps) {
  const [categoryFilter, setCategoryFilter] = useState<AchievementCategory | "all">("all")
  const [rarityFilter, setRarityFilter] = useState<AchievementRarity | "all">("all")

  // Filter achievements
  const filteredAchievements = useMemo(() => {
    return achievements.filter(a => {
      if (categoryFilter !== "all" && a.category !== categoryFilter) return false
      if (rarityFilter !== "all" && a.rarity !== rarityFilter) return false
      return true
    })
  }, [achievements, categoryFilter, rarityFilter])

  // Check if any filters are active
  const hasFilters = categoryFilter !== "all" || rarityFilter !== "all"

  // Empty state
  if (achievements.length === 0) {
    return (
      <div className={className}>
        <EmptyState onGenerate={onGenerate} loading={loading} />
      </div>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with stats and filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <AchievementStats
          total={achievements.length}
          countByRarity={countByRarity}
        />

        <div className="flex items-center gap-2">
          {/* Generate button */}
          {onGenerate && (
            <Button
              variant="outline"
              size="sm"
              onClick={onGenerate}
              disabled={loading}
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Check for new
            </Button>
          )}

          {/* Filter dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
                {hasFilters && (
                  <span className="ml-1.5 h-4 w-4 rounded-full bg-accent text-accent-foreground text-xs flex items-center justify-center">
                    !
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Category</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => setCategoryFilter("all")}
                className={categoryFilter === "all" ? "bg-muted" : ""}
              >
                All categories
              </DropdownMenuItem>
              {(Object.keys(CATEGORY_CONFIG) as AchievementCategory[]).map(cat => (
                <DropdownMenuItem
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={categoryFilter === cat ? "bg-muted" : ""}
                >
                  <span className="capitalize">{cat}</span>
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator />

              <DropdownMenuLabel>Rarity</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => setRarityFilter("all")}
                className={rarityFilter === "all" ? "bg-muted" : ""}
              >
                All rarities
              </DropdownMenuItem>
              {(["legendary", "epic", "rare", "uncommon", "common"] as AchievementRarity[]).map(rarity => {
                const config = RARITY_CONFIG[rarity]
                return (
                  <DropdownMenuItem
                    key={rarity}
                    onClick={() => setRarityFilter(rarity)}
                    className={rarityFilter === rarity ? "bg-muted" : ""}
                  >
                    <span className={config.textColor}>{config.label}</span>
                  </DropdownMenuItem>
                )
              })}

              {hasFilters && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setCategoryFilter("all")
                      setRarityFilter("all")
                    }}
                    className="text-muted-foreground"
                  >
                    Clear filters
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filtered results message */}
      {hasFilters && (
        <p className="text-sm text-muted-foreground">
          Showing {filteredAchievements.length} of {achievements.length} achievements
        </p>
      )}

      {/* Achievement grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredAchievements.map((achievement, index) => (
          <motion.div
            key={achievement.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <AchievementBadge
              achievement={achievement}
              variant="full"
              showNewIndicator
              onClick={() => onAchievementClick?.(achievement)}
            />
          </motion.div>
        ))}
      </div>

      {/* No results for filter */}
      {filteredAchievements.length === 0 && hasFilters && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No achievements match your filters.</p>
          <Button
            variant="link"
            onClick={() => {
              setCategoryFilter("all")
              setRarityFilter("all")
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
    </div>
  )
}
