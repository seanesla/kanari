"use client"

import { useCallback, useMemo } from "react"
import { useAllSuggestions } from "./use-storage"
import type { GeminiMemoryContext, Suggestion, SuggestionCategory } from "@/lib/types"

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
          s.status === "completed" &&
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
      .filter((s) => s.status === "completed")
      .forEach((s) => {
        categoryCount.set(s.category, (categoryCount.get(s.category) || 0) + 1)
      })

    const sortedCategories = [...categoryCount.entries()].sort(
      (a, b) => b[1] - a[1]
    )

    // Calculate completion rate
    const totalActionable = allSuggestions.filter(
      (s) =>
        s.status === "completed" ||
        s.status === "dismissed" ||
        s.status === "scheduled"
    ).length
    const totalCompleted = allSuggestions.filter(
      (s) => s.status === "completed"
    ).length
    const averageCompletionRate =
      totalActionable > 0
        ? Math.round((totalCompleted / totalActionable) * 100)
        : 0

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
