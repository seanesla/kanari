/**
 * Dynamic AI-Generated Achievements System
 *
 * Unlike traditional hardcoded badges, Kanari's achievements are personalized
 * by Gemini based on each user's unique wellness journey.
 *
 * Features:
 * - AI-generated achievement titles and descriptions
 * - Pattern recognition for behavioral insights
 * - Rarity system based on achievement difficulty
 * - Celebration animations for new achievements
 *
 * Usage:
 * ```tsx
 * import { collectUserStats, type Achievement } from "@/lib/achievements"
 *
 * // Collect stats from recordings, suggestions, and sessions
 * const stats = collectUserStats(recordings, suggestions, sessions, recentAchievements)
 *
 * // Call the achievements API to generate new ones
 * const response = await fetch("/api/gemini/achievements", {
 *   method: "POST",
 *   body: JSON.stringify(stats),
 * })
 * ```
 */

// Export types
export type {
  AchievementCategory,
  AchievementRarity,
  Achievement,
  StoredAchievement,
  UserStatsForAchievements,
  GeminiAchievementResponse,
  AchievementNotification,
} from "./types"

// Export prompts
export {
  ACHIEVEMENT_SYSTEM_PROMPT,
  ACHIEVEMENT_RESPONSE_SCHEMA,
  generateAchievementUserPrompt,
  EXAMPLE_ACHIEVEMENTS,
} from "./prompts"

// Export stats collector
export { collectUserStats } from "./stats-collector"
