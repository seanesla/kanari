/**
 * POST /api/gemini/achievements
 *
 * Generate daily achievements (challenges + badges) using Gemini based on user stats.
 *
 * Request body: UserStatsForDailyAchievements
 * Response: { achievements: GeminiDailyAchievementsResponse["achievements"], reasoning: string }
 */

import { NextRequest, NextResponse } from "next/server"
import { validateAPIKey, getAPIKeyFromRequest } from "@/lib/gemini/client"
import { parseGeminiJson } from "@/lib/gemini/json"
import {
  DAILY_ACHIEVEMENTS_SYSTEM_PROMPT,
  DAILY_ACHIEVEMENTS_RESPONSE_SCHEMA,
  generateDailyAchievementsUserPrompt,
  type UserStatsForDailyAchievements,
  type GeminiDailyAchievementsResponse,
} from "@/lib/achievements"

/**
 * Call Gemini API for achievement generation
 */
async function generateAchievements(
  apiKey: string,
  userStats: UserStatsForDailyAchievements
): Promise<GeminiDailyAchievementsResponse> {
  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent"

  const userPrompt = generateDailyAchievementsUserPrompt(userStats)

  const request = {
    systemInstruction: {
      parts: [{ text: DAILY_ACHIEVEMENTS_SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.8, // Creativity while staying structured
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
      responseSchema: DAILY_ACHIEVEMENTS_RESPONSE_SCHEMA,
    },
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30_000) // 30s timeout

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Gemini API request timed out after 30s")
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error("No response from Gemini API")
  }

  const text = data.candidates[0]?.content?.parts?.[0]?.text
  if (typeof text !== "string") {
    throw new Error("Gemini response parse error: missing text")
  }

  const parsed = parseGeminiJson<GeminiDailyAchievementsResponse>(text)

  // Validate structure
  if (!Array.isArray(parsed.achievements)) {
    throw new Error("Gemini response parse error: Invalid response: achievements is not an array")
  }

  // Validate each achievement
  const validTypes = ["challenge", "badge"]
  const validCategories = ["consistency", "improvement", "engagement", "recovery"]
  const validTrackingKeys = ["do_check_in", "complete_suggestions", "schedule_suggestion"]

  for (const achievement of parsed.achievements) {
    if (
      typeof achievement.type !== "string" ||
      !validTypes.includes(achievement.type) ||
      typeof achievement.title !== "string" ||
      typeof achievement.description !== "string" ||
      !validCategories.includes(achievement.category) ||
      typeof achievement.emoji !== "string" ||
      typeof achievement.points !== "number" ||
      !Number.isFinite(achievement.points) ||
      achievement.points <= 0 ||
      achievement.points > 80
    ) {
      throw new Error("Gemini response parse error: Invalid achievement structure")
    }

    if (achievement.type === "challenge") {
      const tracking = achievement.tracking as unknown
      if (typeof tracking !== "object" || tracking === null) {
        throw new Error("Gemini response parse error: Challenge missing tracking")
      }
      const t = tracking as Record<string, unknown>
      if (
        typeof t.key !== "string" ||
        !validTrackingKeys.includes(t.key) ||
        typeof t.target !== "number" ||
        !Number.isFinite(t.target) ||
        t.target <= 0 ||
        t.target > 10
      ) {
        throw new Error("Gemini response parse error: Invalid tracking object")
      }
    }
  }

  return parsed
}

/**
 * Validate user stats input
 */
function validateUserStats(stats: unknown): stats is UserStatsForDailyAchievements {
  if (typeof stats !== "object" || stats === null) return false

  const s = stats as Record<string, unknown>

  // Check required numeric fields
  const numericFields = [
    "requestedCount", "carryOverCount",
    "totalCheckIns", "checkInsToday", "checkInStreak", "longestCheckInStreak", "daysActive",
    "averageStressScore", "averageFatigueScore",
    "activeSuggestionsCount", "suggestionsCompletedTotal", "suggestionsCompletedToday", "suggestionsScheduledToday",
    "completionRate",
    "totalPoints", "level", "currentDailyCompletionStreak",
  ]

  for (const field of numericFields) {
    if (typeof s[field] !== "number") return false
  }

  // Check required string fields
  const validTrends = ["improving", "stable", "worsening"]

  if (typeof s.todayISO !== "string") return false
  if (typeof s.timeZone !== "string") return false
  if (!validTrends.includes(s.stressTrend as string)) return false
  if (!validTrends.includes(s.fatigueTrend as string)) return false

  // Check array field
  if (!Array.isArray(s.recentDailyTitles)) return false

  return true
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = request.headers.get("content-length")
    if (contentLength && Number(contentLength) > 100_000) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 })
    }

    const body = await request.json()

    // Validate input
    if (!validateUserStats(body)) {
      return NextResponse.json(
        { error: "Invalid user stats format" },
        { status: 400 }
      )
    }

    // Get and validate API key
    const apiKey = validateAPIKey(getAPIKeyFromRequest(request))

    // Generate achievements
    const result = await generateAchievements(apiKey, body)

    return NextResponse.json({
      achievements: result.achievements,
      reasoning: result.reasoning,
    })
  } catch (error) {
    console.error("Achievement generation error:", error)

    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        return NextResponse.json(
          { error: "API key configuration error. Please add your Gemini API key in Settings." },
          { status: 401 }
        )
      }

      if (
        error.message.includes("Gemini API error") ||
        error.message.includes("Gemini response parse error")
      ) {
        return NextResponse.json(
          { error: "External API error", details: error.message },
          { status: 502 }
        )
      }
    }

    return NextResponse.json(
      { error: "Failed to generate achievements" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/gemini/achievements
 *
 * Health check endpoint
 */
export async function GET(request: NextRequest) {
  try {
    const hasApiKey = !!getAPIKeyFromRequest(request)

    return NextResponse.json({
      status: "ok",
      configured: hasApiKey,
      endpoint: "/api/gemini/achievements",
      methods: ["POST"],
    })
  } catch {
    return NextResponse.json(
      { status: "error", error: "Health check failed" },
      { status: 500 }
    )
  }
}
