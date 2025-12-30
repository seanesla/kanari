/**
 * POST /api/gemini/achievements
 *
 * Generate personalized achievements using Gemini based on user stats.
 * Unlike hardcoded badges, each achievement is uniquely generated for the user's journey.
 *
 * Request body: UserStatsForAchievements
 * Response: { achievements: GeminiAchievementResponse["achievements"], reasoning: string }
 */

import { NextRequest, NextResponse } from "next/server"
import { validateAPIKey, getAPIKeyFromRequest } from "@/lib/gemini/client"
import { parseGeminiJson } from "@/lib/gemini/json"
import {
  ACHIEVEMENT_SYSTEM_PROMPT,
  ACHIEVEMENT_RESPONSE_SCHEMA,
  generateAchievementUserPrompt,
  type UserStatsForAchievements,
  type GeminiAchievementResponse,
} from "@/lib/achievements"

/**
 * Call Gemini API for achievement generation
 */
async function generateAchievements(
  apiKey: string,
  userStats: UserStatsForAchievements
): Promise<GeminiAchievementResponse> {
  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent"

  const userPrompt = generateAchievementUserPrompt(userStats)

  const request = {
    systemInstruction: {
      parts: [{ text: ACHIEVEMENT_SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.9, // Higher creativity for unique achievements
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
      responseSchema: ACHIEVEMENT_RESPONSE_SCHEMA,
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

  const parsed = parseGeminiJson<GeminiAchievementResponse>(text)

  // Validate structure
  if (!Array.isArray(parsed.achievements)) {
    throw new Error("Gemini response parse error: Invalid response: achievements is not an array")
  }

  // Validate each achievement
  const validCategories = ["streak", "milestone", "improvement", "engagement", "pattern", "recovery"]
  const validRarities = ["common", "uncommon", "rare", "epic", "legendary"]

  for (const achievement of parsed.achievements) {
    if (
      typeof achievement.title !== "string" ||
      typeof achievement.description !== "string" ||
      !validCategories.includes(achievement.category) ||
      !validRarities.includes(achievement.rarity) ||
      typeof achievement.insight !== "string" ||
      typeof achievement.emoji !== "string"
    ) {
      throw new Error("Gemini response parse error: Invalid achievement structure")
    }
  }

  return parsed
}

/**
 * Validate user stats input
 */
function validateUserStats(stats: unknown): stats is UserStatsForAchievements {
  if (typeof stats !== "object" || stats === null) return false

  const s = stats as Record<string, unknown>

  // Check required numeric fields
  const numericFields = [
    "totalRecordings", "recordingsThisWeek", "recordingStreak", "longestStreak",
    "averageStressScore", "averageFatigueScore", "suggestionsCompleted",
    "suggestionsScheduled", "suggestionsDismissed", "completionRate",
    "helpfulSuggestionsCount", "totalFeedbackGiven", "totalCheckInSessions",
    "averageSessionDuration", "daysActive"
  ]

  for (const field of numericFields) {
    if (typeof s[field] !== "number") return false
  }

  // Check required string fields
  const validTimeOfDay = ["morning", "afternoon", "evening", "night", "varied"]
  const validTrends = ["improving", "stable", "worsening"]

  if (!validTimeOfDay.includes(s.preferredTimeOfDay as string)) return false
  if (typeof s.mostActiveDay !== "string") return false
  if (!validTrends.includes(s.stressTrend as string)) return false
  if (!validTrends.includes(s.fatigueTrend as string)) return false

  // Check array field
  if (!Array.isArray(s.recentAchievementTitles)) return false

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
