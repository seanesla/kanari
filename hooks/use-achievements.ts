"use client"

/**
 * useAchievements Hook
 *
 * Manages the dynamic AI-generated achievements system.
 * Handles fetching, storing, and displaying personalized achievements.
 *
 * Features:
 * - Generates achievements via Gemini API
 * - Stores earned achievements in IndexedDB
 * - Tracks new (unseen) achievements for celebration
 * - Deduplicates achievements by title
 *
 * Usage:
 * ```tsx
 * const {
 *   achievements,
 *   newAchievements,
 *   loading,
 *   generateAchievements,
 *   markAsSeen,
 * } = useAchievements()
 * ```
 */

import { useState, useCallback, useEffect } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { db, toAchievement, fromAchievement } from "@/lib/storage/db"
import { collectUserStats, type StoredAchievement, type Achievement } from "@/lib/achievements"
import type { Recording, Suggestion, CheckInSession } from "@/lib/types"
import { createGeminiHeaders } from "@/lib/utils"

interface UseAchievementsResult {
  /** All earned achievements, sorted by date (newest first) */
  achievements: StoredAchievement[]
  /** Achievements that haven't been seen/acknowledged yet */
  newAchievements: StoredAchievement[]
  /** Whether achievements are currently being generated */
  loading: boolean
  /** Error message if generation failed */
  error: string | null
  /** Generate new achievements based on current user data */
  generateAchievements: (
    recordings: Recording[],
    suggestions: Suggestion[],
    sessions: CheckInSession[]
  ) => Promise<StoredAchievement[]>
  /** Mark an achievement as seen (after showing celebration) */
  markAsSeen: (achievementId: string) => Promise<void>
  /** Mark all achievements as seen */
  markAllAsSeen: () => Promise<void>
  /** Total count of achievements */
  totalCount: number
  /** Count by rarity */
  countByRarity: Record<string, number>
}

export function useAchievements(): UseAchievementsResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Query all achievements from IndexedDB
  const dbAchievements = useLiveQuery(
    () => db.achievements.orderBy("earnedAt").reverse().toArray(),
    []
  )

  // Convert to StoredAchievement type
  const achievements: StoredAchievement[] = dbAchievements?.map(toAchievement) || []

  // Filter unseen achievements
  const newAchievements = achievements.filter(a => !a.seen)

  // Count by rarity
  const countByRarity = achievements.reduce<Record<string, number>>((acc, a) => {
    acc[a.rarity] = (acc[a.rarity] || 0) + 1
    return acc
  }, {})

  /**
   * Generate new achievements based on user data.
   * Calls the Gemini API to create personalized achievements,
   * then stores any new ones that don't duplicate existing titles.
   */
  const generateAchievements = useCallback(async (
    recordings: Recording[],
    suggestions: Suggestion[],
    sessions: CheckInSession[]
  ): Promise<StoredAchievement[]> => {
    setLoading(true)
    setError(null)

    try {
      // Get existing achievements to avoid duplicates
      const existingAchievements = await db.achievements.toArray()
      const existingTitles = new Set(existingAchievements.map(a => a.title.toLowerCase()))

      // Collect user stats
      const stats = collectUserStats(
        recordings,
        suggestions,
        sessions,
        existingAchievements.map(toAchievement)
      )

      // Call the API
      const headers = await createGeminiHeaders({
        "Content-Type": "application/json",
      })

      const response = await fetch("/api/gemini/achievements", {
        method: "POST",
        headers,
        body: JSON.stringify(stats),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `API error: ${response.status}`)
      }

      const data = await response.json()

      if (!data.achievements || !Array.isArray(data.achievements)) {
        throw new Error("Invalid API response")
      }

      // Filter out duplicates and create StoredAchievements
      const now = new Date().toISOString()
      const newAchievements: StoredAchievement[] = []

      for (const achievement of data.achievements) {
        // Check if we already have this achievement (case-insensitive)
        if (existingTitles.has(achievement.title.toLowerCase())) {
          continue
        }

        const storedAchievement: StoredAchievement = {
          id: crypto.randomUUID(),
          title: achievement.title,
          description: achievement.description,
          category: achievement.category,
          rarity: achievement.rarity,
          earnedAt: now,
          insight: achievement.insight,
          emoji: achievement.emoji,
          seen: false,
        }

        newAchievements.push(storedAchievement)
        existingTitles.add(achievement.title.toLowerCase()) // Prevent duplicates within batch
      }

      // Store new achievements
      if (newAchievements.length > 0) {
        await db.achievements.bulkAdd(newAchievements.map(fromAchievement))
      }

      return newAchievements
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate achievements"
      setError(errorMessage)
      console.error("Achievement generation error:", err)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Mark a single achievement as seen
   */
  const markAsSeen = useCallback(async (achievementId: string) => {
    await db.achievements.update(achievementId, {
      seen: true,
      seenAt: new Date(),
    })
  }, [])

  /**
   * Mark all achievements as seen
   */
  const markAllAsSeen = useCallback(async () => {
    const now = new Date()
    await db.achievements.toCollection().modify({
      seen: true,
      seenAt: now,
    })
  }, [])

  return {
    achievements,
    newAchievements,
    loading,
    error,
    generateAchievements,
    markAsSeen,
    markAllAsSeen,
    totalCount: achievements.length,
    countByRarity,
  }
}

/**
 * Hook to check if user should receive achievements
 * Returns true if enough data exists to generate meaningful achievements
 */
export function useCanGenerateAchievements(
  recordings: Recording[],
  suggestions: Suggestion[]
): boolean {
  // Need at least some activity to generate achievements
  const hasRecordings = recordings.length >= 1
  const hasSuggestionActivity = suggestions.some(
    s => s.status === "completed" || s.status === "accepted" || s.status === "dismissed"
  )

  return hasRecordings || hasSuggestionActivity
}
