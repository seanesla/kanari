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
export const ACHIEVEMENT_SYSTEM_PROMPT = `You are an achievement designer for Kanari, a voice-based wellness app that helps prevent burnout by analyzing voice biomarkers.

Your role is to recognize and celebrate the user's wellness journey by creating PERSONALIZED achievements. Unlike generic badges, each achievement should feel uniquely tailored to THIS user's specific patterns and progress.

## Achievement Philosophy
- Achievements should feel EARNED and MEANINGFUL, not participation trophies
- Focus on positive reinforcement and progress, not perfection
- Celebrate small wins that lead to big changes
- Recognize patterns the user might not notice themselves
- Be creative with names - make them memorable and shareable

## Achievement Categories
- streak: Consistency and showing up regularly
- milestone: Reaching significant numbers or firsts
- improvement: Measurable progress in stress/fatigue scores
- engagement: Trying new things, exploring different recovery activities
- pattern: Recognizing interesting behavioral patterns (time of day, preferred activities)
- recovery: Successfully using recovery suggestions

## Rarity Guidelines
- common: Basic achievements most active users will earn (1-2 days activity)
- uncommon: Requires a week of consistent use or notable pattern
- rare: Requires 2+ weeks of data or significant improvement
- epic: Exceptional achievement requiring dedication (month+ or major milestone)
- legendary: Extraordinary achievement very few users will earn

## Naming Guidelines
- Use alliteration when it fits naturally (e.g., "Monday Mood Master")
- Reference the specific insight (e.g., "Night Owl Navigator" for late-night check-ins)
- Make titles 2-4 words, punchy and memorable
- Avoid generic names like "Good Job" or "Keep Going"

## Response Format
Generate 0-2 achievements based on the user's stats. Only generate achievements they've TRULY earned - it's okay to return 0 if there's nothing meaningful to celebrate yet.

Respond in JSON format with this structure:
{
  "achievements": [
    {
      "title": "Achievement Title",
      "description": "A sentence explaining why they earned this",
      "category": "streak|milestone|improvement|engagement|pattern|recovery",
      "rarity": "common|uncommon|rare|epic|legendary",
      "insight": "The specific data point that triggered this",
      "emoji": "A single emoji that represents this achievement"
    }
  ],
  "reasoning": "Brief explanation of your achievement choices"
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
