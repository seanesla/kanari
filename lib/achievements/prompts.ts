/**
 * Achievement Generation Prompts
 *
 * Prompts for Gemini to generate personalized achievements based on user patterns.
 * These achievements are unique to each user's journey - no two users get the same badges.
 */

import type { UserStatsForAchievements, AchievementCategory, AchievementRarity } from "./types"

/**
 * System prompt for achievement generation
 * Instructs Gemini on how to create personalized, meaningful achievements
 */
export const ACHIEVEMENT_SYSTEM_PROMPT = `You are an EXTREMELY SELECTIVE achievement designer for Kanari, a voice-based wellness app that helps prevent burnout by analyzing voice biomarkers.

Your job is to recognize EXCEPTIONAL progress, NOT to hand out participation trophies. Most of your responses should return ZERO achievements.

## CORE PRINCIPLES (FOLLOW STRICTLY)

1. **ACHIEVEMENTS MUST BE RARE** - The vast majority of API calls should return an empty achievements array. Only award something when the user has genuinely accomplished something notable.

2. **NO PARTICIPATION TROPHIES** - Never award achievements just for using the app. Usage alone is not an achievement.

3. **REQUIRE MEASURABLE IMPACT** - Only award for: significant stress/fatigue reduction (20%+), sustained streaks (14+ consecutive days), or completing many helpful recovery suggestions (10+).

4. **DATA QUALITY MATTERS** - Check the dataQuality section. If hasEnoughHistory is false OR journeyDurationDays < 14, return ZERO achievements. Early users should NOT receive achievements.

5. **QUALITY OVER QUANTITY** - It is FAR better to give zero achievements than to give a meaningless one.

## EXPLICIT BANS - NEVER award achievements for:
- First recording or early milestones (1st, 5th, 10th recording)
- Time-of-day preferences (morning person, night owl, etc.)
- Simple activity counts (X recordings, X sessions)
- Just showing up or using the app regularly
- Dismissing or skipping suggestions
- Short streaks (under 14 days)
- Patterns that don't represent genuine wellness IMPROVEMENT
- Anything that could be earned in the first 2 weeks

## WHAT DESERVES AN ACHIEVEMENT:
- 20%+ sustained reduction in average stress over 3+ weeks
- 14+ day streak WITH improving wellness metrics (not just streak alone)
- Completing 10+ recovery suggestions that were rated as helpful
- Dramatic wellness turnaround (high stress -> sustained low stress over weeks)
- Long-term dedication: 2+ months of consistent use WITH measurable improvement
- Exceptional completion rate (80%+) on suggestions over many weeks

## Achievement Categories
- streak: ONLY for 14+ day streaks with improving metrics
- milestone: ONLY for genuinely impressive milestones (50+ recordings WITH improvement)
- improvement: ONLY for 20%+ sustained stress/fatigue reduction over 3+ weeks
- engagement: ONLY for completing 10+ helpful suggestions
- pattern: ALMOST NEVER USE - patterns alone are not achievements
- recovery: ONLY for sustained engagement with recovery over weeks

## Rarity (BE EXTREMELY STRICT)
- common: Almost never used. Only for genuinely notable 2-week+ achievements with measurable progress.
- uncommon: 1 month of data + clear positive wellness trends (not just usage)
- rare: 2+ months of dedication + significant measurable improvement
- epic: 3+ months + transformative wellness change
- legendary: Exceptional - very few users will EVER earn this

## Naming Guidelines
- Make titles 2-4 words, punchy and memorable
- Reference the specific wellness insight, not just activity
- Avoid generic names

## Response Format
Return 0-1 achievements. Returning 0 is the EXPECTED default. Only return an achievement if the user has genuinely earned something exceptional based on the strict criteria above.

{
  "achievements": [],
  "reasoning": "Brief explanation - include why you're NOT awarding if returning empty"
}`

/**
 * Generate user prompt with stats for achievement generation
 */
export function generateAchievementUserPrompt(stats: UserStatsForAchievements): string {
  const lines: string[] = [
    "Based on this user's wellness journey stats, generate personalized achievements they've earned.",
    "",
    "## User Stats",
    "",
    "### Recording Activity",
    `- Total recordings: ${stats.totalRecordings}`,
    `- Recordings this week: ${stats.recordingsThisWeek}`,
    `- Current streak: ${stats.recordingStreak} days`,
    `- Longest streak ever: ${stats.longestStreak} days`,
    `- Days active: ${stats.daysActive}`,
    stats.firstRecordingDate ? `- First recording: ${stats.firstRecordingDate}` : "- First recording: None yet",
    "",
    "### Time Patterns",
    `- Preferred time of day: ${stats.preferredTimeOfDay}`,
    `- Most active day: ${stats.mostActiveDay}`,
    "",
    "### Wellness Metrics",
    `- Average stress score: ${stats.averageStressScore}/100`,
    `- Average fatigue score: ${stats.averageFatigueScore}/100`,
    `- Stress trend: ${stats.stressTrend}`,
    `- Fatigue trend: ${stats.fatigueTrend}`,
    stats.lowestStressDay ? `- Lowest stress day: ${stats.lowestStressDay}` : "",
    stats.highestImprovementDay ? `- Biggest improvement: ${stats.highestImprovementDay}` : "",
    "",
    "### Suggestion Engagement",
    `- Completed: ${stats.suggestionsCompleted}`,
    `- Scheduled: ${stats.suggestionsScheduled}`,
    `- Dismissed: ${stats.suggestionsDismissed}`,
    `- Completion rate: ${Math.round(stats.completionRate * 100)}%`,
    stats.favoriteCategory ? `- Favorite category: ${stats.favoriteCategory}` : "",
    stats.leastUsedCategory ? `- Least used: ${stats.leastUsedCategory}` : "",
    "",
    "### Effectiveness Feedback",
    `- Helpful suggestions: ${stats.helpfulSuggestionsCount}`,
    `- Total feedback given: ${stats.totalFeedbackGiven}`,
    "",
    "### Check-in Sessions",
    `- Total AI conversations: ${stats.totalCheckInSessions}`,
    `- Average duration: ${Math.round(stats.averageSessionDuration / 60)} minutes`,
  ]

  // Add recent achievements to avoid duplicates
  if (stats.recentAchievementTitles.length > 0) {
    lines.push("")
    lines.push("### Recent Achievements (DO NOT DUPLICATE)")
    stats.recentAchievementTitles.forEach(title => {
      lines.push(`- ${title}`)
    })
  }

  lines.push("")
  lines.push("Generate 0-2 NEW achievements this user has earned. Be creative and specific to their journey.")

  return lines.filter(line => line !== undefined).join("\n")
}

/**
 * JSON schema for structured output from Gemini
 */
export const ACHIEVEMENT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    achievements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Short, catchy achievement title (2-4 words)",
          },
          description: {
            type: "string",
            description: "One sentence explaining why they earned this",
          },
          category: {
            type: "string",
            enum: ["streak", "milestone", "improvement", "engagement", "pattern", "recovery"],
            description: "Achievement category for styling",
          },
          rarity: {
            type: "string",
            enum: ["common", "uncommon", "rare", "epic", "legendary"],
            description: "Rarity level based on difficulty to earn",
          },
          insight: {
            type: "string",
            description: "The specific data point that triggered this achievement",
          },
          emoji: {
            type: "string",
            description: "A single emoji representing this achievement",
          },
        },
        required: ["title", "description", "category", "rarity", "insight", "emoji"],
      },
      maxItems: 2,
    },
    reasoning: {
      type: "string",
      description: "Brief explanation of achievement choices",
    },
  },
  required: ["achievements", "reasoning"],
}

/**
 * Example achievements for reference (not used in prompts, just for documentation)
 */
export const EXAMPLE_ACHIEVEMENTS = [
  {
    title: "Monday Mood Master",
    description: "Your stress levels on Mondays have improved 20% over the past month",
    category: "improvement" as AchievementCategory,
    rarity: "rare" as AchievementRarity,
    insight: "Monday stress dropped from 72 to 58 average",
    emoji: "🌟",
  },
  {
    title: "Night Owl Navigator",
    description: "You've consistently checked in during evening hours, building a healthy nighttime routine",
    category: "pattern" as AchievementCategory,
    rarity: "uncommon" as AchievementRarity,
    insight: "80% of recordings between 8pm-11pm",
    emoji: "🦉",
  },
  {
    title: "Mindfulness Maven",
    description: "You've completed 10 mindfulness suggestions - that's real dedication to mental wellness",
    category: "recovery" as AchievementCategory,
    rarity: "rare" as AchievementRarity,
    insight: "10 mindfulness suggestions completed",
    emoji: "🧘",
  },
  {
    title: "Streak Starter",
    description: "You've checked in 3 days in a row - building the habit!",
    category: "streak" as AchievementCategory,
    rarity: "common" as AchievementRarity,
    insight: "3-day recording streak",
    emoji: "🔥",
  },
  {
    title: "First Voice",
    description: "You made your first voice recording. Every journey begins with a single step.",
    category: "milestone" as AchievementCategory,
    rarity: "common" as AchievementRarity,
    insight: "First recording completed",
    emoji: "🎤",
  },
  {
    title: "Feedback Champion",
    description: "You've provided helpful feedback on 5 suggestions, making Kanari smarter for everyone",
    category: "engagement" as AchievementCategory,
    rarity: "uncommon" as AchievementRarity,
    insight: "5 effectiveness ratings submitted",
    emoji: "💬",
  },
]
