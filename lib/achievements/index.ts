/**
 * Daily Hybrid Achievements System
 *
 * Kanari generates 2-3 daily achievements combining:
 * - Prospective challenges (to complete today)
 * - Retrospective badges (recognition for what you did)
 *
 * Features:
 * - AI-generated daily content + points
 * - Level progression + AI-generated level titles
 * - Midnight reset in the user's time zone
 * - One-day carry-over for incomplete challenges
 * - Milestone badges for 7/30/60/90+ day completion streaks
 *
 * Usage:
 * ```tsx
 * import { collectUserStatsForDailyAchievements } from "@/lib/achievements"
 *
 * // Collect stats from recordings, suggestions, and sessions
 * const stats = collectUserStatsForDailyAchievements(...)
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
  DailyAchievementType,
  DailyAchievementCategory,
  DailyAchievementTrackingKey,
  DailyAchievementTracking,
  DailyAchievement,
  UserProgress,
  MilestoneBadgeType,
  MilestoneBadge,
  UserStatsForDailyAchievements,
  GeminiDailyAchievementsResponse,
  GeminiLevelTitleResponse,
} from "./types"

// Export prompts
export {
  DAILY_ACHIEVEMENTS_SYSTEM_PROMPT,
  DAILY_ACHIEVEMENTS_RESPONSE_SCHEMA,
  generateDailyAchievementsUserPrompt,
  LEVEL_TITLE_SYSTEM_PROMPT,
  LEVEL_TITLE_RESPONSE_SCHEMA,
  generateLevelTitleUserPrompt,
} from "./prompts"

// Export stats collector
export { collectUserStatsForDailyAchievements } from "./stats-collector"

// UI-friendly helpers (routes + progress labels for trackable challenges)
export type { AchievementTodayCounts, DailyAchievementAction } from "./tracking-actions"
export { getDailyAchievementAction, getDailyAchievementProgress } from "./tracking-actions"
