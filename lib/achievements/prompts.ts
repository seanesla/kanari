/**
 * Daily Achievements + Level Title Prompts
 *
 * Kanari uses Gemini to generate:
 * - 2-3 daily achievements (challenges + badges)
 * - Creative level titles when the user levels up
 */

import type { UserStatsForDailyAchievements } from "./types"

export const DAILY_ACHIEVEMENTS_SYSTEM_PROMPT = `You design daily achievements for Kanari, a voice-based wellness app for preventing burnout.

Create a small daily set that feels motivating, achievable, and specific to the user's recent activity.

## Daily Achievement Types

- challenge (prospective): a goal the user can complete today.
- badge (retrospective): recognition for something the user already did (today or very recently).

## Hard Rules

1) Return EXACTLY the requested number of achievements.
2) Total returned achievements must be between 0 and 3 (the app enforces this).
3) Challenges MUST be measurable using one of the allowed tracking keys.
4) Avoid duplicates: do not reuse titles from the "recentDailyTitles" list.
5) Keep titles short (2–5 words). No hashtags. No quoted text.
6) Keep descriptions to 1 sentence. Insights are optional and must be 1 short sentence.
7) Use exactly ONE emoji per achievement.

## Allowed Tracking Keys (challenges only)

- do_check_in: user completes at least N check-ins today (recording OR AI check-in session)
- complete_suggestions: user completes at least N recovery suggestions today
- schedule_suggestion: user schedules at least N recovery suggestions today

## Points

Assign points based on difficulty and impact:
- Easy: 10–20
- Medium: 25–45
- Hard: 50–80

Never exceed 80. Never return 0 points.

## Categories

- consistency: showing up, completing check-ins
- improvement: measurable improvement in stress/fatigue trends
- engagement: interacting with suggestions and planning
- recovery: completing recovery actions

## Output

Return JSON:
{
  "achievements": [
    {
      "type": "challenge" | "badge",
      "category": "consistency" | "improvement" | "engagement" | "recovery",
      "title": "string",
      "description": "string",
      "insight": "string (optional)",
      "emoji": "single emoji",
      "points": number,
      "tracking": { "key": "...", "target": number } // REQUIRED for challenges
    }
  ],
  "reasoning": "brief explanation"
}`

export function generateDailyAchievementsUserPrompt(stats: UserStatsForDailyAchievements): string {
  const lines: string[] = [
    "Generate daily achievements for TODAY.",
    "",
    `Today: ${stats.todayISO}`,
    `Time zone: ${stats.timeZone}`,
    `Requested achievements: ${stats.requestedCount}`,
    `Carry-overs already active today: ${stats.carryOverCount}`,
    "",
    "## Progress",
    `- Total points: ${stats.totalPoints}`,
    `- Current level: ${stats.level}`,
    `- Daily completion streak: ${stats.currentDailyCompletionStreak} days`,
    "",
    "## Activity",
    `- Total check-ins (all time): ${stats.totalCheckIns}`,
    `- Check-ins today: ${stats.checkInsToday}`,
    `- Check-in streak: ${stats.checkInStreak} days`,
    `- Longest streak: ${stats.longestCheckInStreak} days`,
    `- Days active: ${stats.daysActive}`,
    "",
    "## Wellness (approximate)",
    `- Average stress: ${stats.averageStressScore}/100`,
    `- Average fatigue: ${stats.averageFatigueScore}/100`,
    `- Stress trend: ${stats.stressTrend}`,
    `- Fatigue trend: ${stats.fatigueTrend}`,
    "",
    "## Suggestions",
    `- Active suggestions available: ${stats.activeSuggestionsCount}`,
    `- Suggestions completed (all time): ${stats.suggestionsCompletedTotal}`,
    `- Suggestions completed today: ${stats.suggestionsCompletedToday}`,
    `- Suggestions scheduled today: ${stats.suggestionsScheduledToday}`,
    `- Completion rate: ${Math.round(stats.completionRate * 100)}%`,
    stats.favoriteCategory ? `- Favorite category: ${stats.favoriteCategory}` : "- Favorite category: (none)",
  ]

  if (stats.recentDailyTitles.length > 0) {
    lines.push("")
    lines.push("## Recent Titles (do NOT repeat)")
    for (const title of stats.recentDailyTitles) {
      lines.push(`- ${title}`)
    }
  }

  lines.push("")
  lines.push("Important: Return EXACTLY the requested number of achievements. If requestedCount is 0, return an empty achievements array.")

  return lines.join("\n")
}

export const DAILY_ACHIEVEMENTS_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    achievements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["challenge", "badge"] },
          category: { type: "string", enum: ["consistency", "improvement", "engagement", "recovery"] },
          title: { type: "string" },
          description: { type: "string" },
          insight: { type: "string" },
          emoji: { type: "string" },
          points: { type: "number" },
          tracking: {
            type: "object",
            properties: {
              key: { type: "string", enum: ["do_check_in", "complete_suggestions", "schedule_suggestion"] },
              target: { type: "number" },
            },
            required: ["key", "target"],
          },
        },
        required: ["type", "category", "title", "description", "emoji", "points"],
      },
      maxItems: 3,
    },
    reasoning: { type: "string" },
  },
  required: ["achievements", "reasoning"],
}

export const LEVEL_TITLE_SYSTEM_PROMPT = `You generate short, memorable level titles for Kanari.

The title should feel like a playful, prestigious badge of progress in a burnout-prevention journey.

Rules:
- 2–4 words
- No profanity, no hate, no sexual content
- No hashtags, no quotes, no emojis
- Avoid generic gamer titles like "Level Up" or "XP Master"
- Keep it wellness-adjacent (calm, resilience, focus, recovery, balance)

Return JSON:
{
  "title": "string",
  "reasoning": "brief explanation"
}`

export function generateLevelTitleUserPrompt(input: {
  level: number
  totalPoints: number
  currentDailyCompletionStreak: number
  longestDailyCompletionStreak: number
}): string {
  return [
    "Generate a new level title.",
    `Level: ${input.level}`,
    `Total points: ${input.totalPoints}`,
    `Current completion streak: ${input.currentDailyCompletionStreak}`,
    `Longest completion streak: ${input.longestDailyCompletionStreak}`,
  ].join("\n")
}

export const LEVEL_TITLE_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    reasoning: { type: "string" },
  },
  required: ["title", "reasoning"],
}

