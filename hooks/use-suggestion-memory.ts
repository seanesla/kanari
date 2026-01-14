"use client"

import { useCallback, useMemo } from "react"
import { useAllSuggestions } from "./use-storage"
import type {
  CategoryEffectivenessStats,
  CategoryPreference,
  CategoryStats,
  GeminiMemoryContext,
  Suggestion,
  SuggestionCategory,
} from "@/lib/types"

const ALL_CATEGORIES: SuggestionCategory[] = [
  "break",
  "exercise",
  "mindfulness",
  "social",
  "rest",
]

function deriveCategoryPreference(stats: Pick<CategoryStats, "completed" | "dismissed" | "total">): CategoryPreference {
  if (stats.total === 0) return "medium"

  const dismissalRate = stats.dismissed / stats.total
  const completionRate = stats.completed / stats.total

  if (dismissalRate > 0.5) return "avoid"
  if (completionRate > 0.6) return "high"
  if (completionRate >= 0.4) return "medium"
  return "low"
}

/**
 * Hook for building Gemini memory context from suggestion history.
 * Used to personalize future suggestions based on user's past actions.
 */
export function useSuggestionMemory() {
  const allSuggestions = useAllSuggestions()

  /**
   * Build memory context for Gemini.
   * Includes recently completed, dismissed, and scheduled suggestions.
   */
  const buildMemoryContext = useCallback((): GeminiMemoryContext => {
    const emptyCategoryStats = ALL_CATEGORIES.reduce((acc, category) => {
      acc[category] = {
        completed: 0,
        dismissed: 0,
        total: 0,
        completionRate: 0,
        preference: "medium",
      }
      return acc
    }, {} as Record<SuggestionCategory, CategoryStats>)

    const emptyEffectivenessByCategory = ALL_CATEGORIES.reduce((acc, category) => {
      acc[category] = {
        totalRatings: 0,
        helpfulRatings: 0,
        notHelpfulRatings: 0,
        helpfulRate: 0,
      }
      return acc
    }, {} as Record<SuggestionCategory, CategoryEffectivenessStats>)

    if (!allSuggestions || allSuggestions.length === 0) {
      return {
        completed: [],
        dismissed: [],
        scheduled: [],
        stats: {
          totalCompleted: 0,
          totalDismissed: 0,
          mostUsedCategory: null,
          leastUsedCategory: null,
          averageCompletionRate: 0,
          categoryStats: emptyCategoryStats,
          preferredCategories: [],
          avoidedCategories: [],
          effectivenessByCategory: emptyEffectivenessByCategory,
        },
      }
    }

    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000

    // Filter completed suggestions (last 30 days, max 20)
    const completed = allSuggestions
      .filter(
        (s) =>
          (s.status === "completed" || s.status === "accepted") &&
          new Date(s.lastUpdatedAt || s.createdAt).getTime() >= thirtyDaysAgo
      )
      .slice(0, 20)
      .map((s) => ({
        content: s.content.slice(0, 80) + (s.content.length > 80 ? "..." : ""),
        category: s.category,
        completedAt: s.lastUpdatedAt || s.createdAt,
      }))

    // Filter dismissed suggestions (last 14 days, max 10)
    const dismissed = allSuggestions
      .filter(
        (s) =>
          s.status === "dismissed" &&
          new Date(s.lastUpdatedAt || s.createdAt).getTime() >= fourteenDaysAgo
      )
      .slice(0, 10)
      .map((s) => ({
        content: s.content.slice(0, 80) + (s.content.length > 80 ? "..." : ""),
        category: s.category,
        dismissedAt: s.lastUpdatedAt || s.createdAt,
      }))

    // Get all scheduled suggestions
    const scheduled = allSuggestions
      .filter((s) => s.status === "scheduled")
      .map((s) => ({
        content: s.content.slice(0, 80) + (s.content.length > 80 ? "..." : ""),
        category: s.category,
        scheduledFor: s.scheduledFor || s.createdAt,
      }))

    // Calculate category usage stats from completed suggestions
    const categoryCount = new Map<SuggestionCategory, number>()
    allSuggestions
      .filter((s) => s.status === "completed" || s.status === "accepted")
      .forEach((s) => {
        categoryCount.set(s.category, (categoryCount.get(s.category) || 0) + 1)
      })

    const sortedCategories = [...categoryCount.entries()].sort(
      (a, b) => b[1] - a[1]
    )

    // Calculate completion rate
    // Treat accepted as completed for memory stats (see docs/error-patterns/accepted-suggestions-missing-from-memory.md)
    const totalActionable = allSuggestions.filter(
      (s) =>
        s.status === "completed" ||
        s.status === "accepted" ||
        s.status === "dismissed" ||
        s.status === "scheduled"
    ).length
    const totalCompleted = allSuggestions.filter(
      (s) => s.status === "completed" || s.status === "accepted"
    ).length
    const averageCompletionRate =
      totalActionable > 0
        ? Math.round((totalCompleted / totalActionable) * 100)
        : 0

    // Per-category preference stats
    const categoryStats = ALL_CATEGORIES.reduce((acc, category) => {
      const completedCount = allSuggestions.filter(
        (s) =>
          (s.status === "completed" || s.status === "accepted") &&
          s.category === category
      ).length

      const dismissedCount = allSuggestions.filter(
        (s) => s.status === "dismissed" && s.category === category
      ).length

      const total = completedCount + dismissedCount
      const completionRate =
        total > 0 ? Math.round((completedCount / total) * 100) : 0

      const stats: CategoryStats = {
        completed: completedCount,
        dismissed: dismissedCount,
        total,
        completionRate,
        preference: deriveCategoryPreference({
          completed: completedCount,
          dismissed: dismissedCount,
          total,
        }),
      }

      acc[category] = stats
      return acc
    }, {} as Record<SuggestionCategory, CategoryStats>)

    const preferredCategories = ALL_CATEGORIES.filter(
      (category) =>
        categoryStats[category].total > 0 &&
        categoryStats[category].completionRate > 60
    )

    const avoidedCategories = ALL_CATEGORIES.filter((category) => {
      const stats = categoryStats[category]
      return stats.total > 0 && stats.dismissed / stats.total > 0.5
    })

    // Effectiveness feedback (helpful rate) by category
    const effectivenessByCategory = ALL_CATEGORIES.reduce((acc, category) => {
      acc[category] = {
        totalRatings: 0,
        helpfulRatings: 0,
        notHelpfulRatings: 0,
        helpfulRate: 0,
      }
      return acc
    }, {} as Record<SuggestionCategory, CategoryEffectivenessStats>)

    for (const suggestion of allSuggestions) {
      const rating = suggestion.effectiveness?.rating
      if (!rating || rating === "skipped") continue

      const effectivenessStats = effectivenessByCategory[suggestion.category]
      effectivenessStats.totalRatings += 1
      if (rating === "very_helpful" || rating === "somewhat_helpful") {
        effectivenessStats.helpfulRatings += 1
      } else if (rating === "not_helpful") {
        effectivenessStats.notHelpfulRatings += 1
      }

      effectivenessStats.helpfulRate =
        effectivenessStats.totalRatings > 0
          ? Math.round(
            (effectivenessStats.helpfulRatings / effectivenessStats.totalRatings) * 100
          )
          : 0
    }

    return {
      completed,
      dismissed,
      scheduled,
      stats: {
        totalCompleted,
        totalDismissed: allSuggestions.filter((s) => s.status === "dismissed")
          .length,
        mostUsedCategory: (sortedCategories[0]?.[0] as SuggestionCategory) || null,
        leastUsedCategory:
          sortedCategories.length > 1
            ? (sortedCategories[sortedCategories.length - 1]?.[0] as SuggestionCategory)
            : null,
        averageCompletionRate,
        categoryStats,
        preferredCategories,
        avoidedCategories,
        effectivenessByCategory,
      },
    }
  }, [allSuggestions])

  /**
   * Get active suggestions (pending or scheduled, not dismissed/completed).
   * These are the suggestions that should be reviewed by Gemini for diff-aware generation.
   */
  const getActiveSuggestions = useCallback((): Suggestion[] => {
    if (!allSuggestions) return []
    return allSuggestions.filter(
      (s) => s.status === "pending" || s.status === "scheduled"
    )
  }, [allSuggestions])

  /**
   * Memoized memory context for performance.
   */
  const memoryContext = useMemo(
    () => buildMemoryContext(),
    [buildMemoryContext]
  )

  return {
    allSuggestions,
    memoryContext,
    buildMemoryContext,
    getActiveSuggestions,
  }
}
