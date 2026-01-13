/**
 * Achievement System Types
 *
 * Defines types for Kanari's daily hybrid achievements system.
 *
 * The system combines:
 * - Daily challenges (prospective): goals for the user to complete today
 * - Daily badges (retrospective): recognition for what the user has already done
 *
 * Achievements reset daily at midnight in the user's selected time zone.
 * Incomplete challenges may carry over once.
 */

/**
 * Daily achievement type
 */
export type DailyAchievementType = "challenge" | "badge"

/**
 * Daily achievement category - determines icon and color scheme
 */
export type DailyAchievementCategory =
  | "consistency"
  | "improvement"
  | "engagement"
  | "recovery"

/**
 * Optional tracking key for challenges that can be auto-completed.
 * Kept intentionally small so we only generate challenges the app can measure.
 */
export type DailyAchievementTrackingKey =
  | "do_check_in"
  | "complete_suggestions"
  | "schedule_suggestion"

export interface DailyAchievementTracking {
  key: DailyAchievementTrackingKey
  target: number
}

/**
 * Stored daily achievement (challenge or badge)
 */
export interface DailyAchievement {
  id: string
  /** YYYY-MM-DD in the user's selected time zone */
  dateISO: string
  /** Original date the achievement was generated for (used for carry-over display) */
  sourceDateISO: string
  type: DailyAchievementType
  category: DailyAchievementCategory
  title: string
  description: string
  insight?: string
  emoji: string
  /** AI-assigned points (guardrailed client-side) */
  points: number
  /** When this achievement was generated/awarded */
  createdAt: string
  /** Whether the user completed this achievement (badges are completed immediately) */
  completed: boolean
  completedAt?: string
  /** Whether this challenge was carried over from a previous day */
  carriedOver: boolean
  /** Whether the user has seen the completion/badge celebration */
  seen: boolean
  seenAt?: string
  /** Optional tracking for auto-completing challenges */
  tracking?: DailyAchievementTracking
  /** If true, this challenge is no longer completable (expired after carry-over) */
  expired?: boolean
  expiredAt?: string
}

/**
 * User meta-progression and daily completion tracking
 */
export interface UserProgress {
  id: string // Always "default"
  totalPoints: number
  level: number
  levelTitle: string
  /** Current streak of completed achievement-days */
  currentDailyCompletionStreak: number
  longestDailyCompletionStreak: number
  lastCompletedDateISO: string | null
  lastGeneratedDateISO: string | null
  lastLevelUpAt?: string
}

/**
 * Milestone badges awarded for consecutive days completed.
 */
export type MilestoneBadgeType = "7day" | "30day" | "60day" | "90day"

export interface MilestoneBadge {
  id: string
  type: MilestoneBadgeType
  title: string
  description: string
  emoji: string
  earnedAt: string
  streakDays: number
  seen: boolean
  seenAt?: string
}

/**
 * Stats sent to Gemini for daily achievement generation.
 * Keep this compact and stable: the server validates basic shape.
 */
export interface UserStatsForDailyAchievements {
  todayISO: string
  timeZone: string
  /** How many NEW achievements to generate for today (not counting carry-overs) */
  requestedCount: number
  /** Number of carried-over challenges already active today */
  carryOverCount: number
  // Activity
  totalCheckIns: number
  checkInsToday: number
  checkInStreak: number
  longestCheckInStreak: number
  daysActive: number
  // Wellness
  averageStressScore: number
  averageFatigueScore: number
  stressTrend: "improving" | "stable" | "worsening"
  fatigueTrend: "improving" | "stable" | "worsening"
  // Suggestions
  activeSuggestionsCount: number
  suggestionsCompletedTotal: number
  suggestionsCompletedToday: number
  suggestionsScheduledToday: number
  favoriteCategory: string | null
  completionRate: number
  // Progress
  totalPoints: number
  level: number
  currentDailyCompletionStreak: number
  // Dedupe
  recentDailyTitles: string[]
}

/**
 * Gemini response when generating daily achievements.
 */
export interface GeminiDailyAchievementsResponse {
  achievements: Array<{
    type: DailyAchievementType
    category: DailyAchievementCategory
    title: string
    description: string
    insight?: string
    emoji: string
    points: number
    tracking?: DailyAchievementTracking
  }>
  reasoning: string
}

/**
 * Gemini response for level title generation.
 */
export interface GeminiLevelTitleResponse {
  title: string
  reasoning: string
}
