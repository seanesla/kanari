import { NextRequest, NextResponse } from "next/server"
import { validateAPIKey, generateSuggestions } from "@/lib/gemini/client"
import { SYSTEM_PROMPT, generateUserPrompt, buildWellnessContext } from "@/lib/gemini/prompts"
import type { Suggestion, StressLevel, FatigueLevel, TrendDirection } from "@/lib/types"

/**
 * POST /api/gemini
 *
 * Generate personalized recovery suggestions using Gemini API
 *
 * Request body:
 * {
 *   stressScore: number,
 *   stressLevel: StressLevel,
 *   fatigueScore: number,
 *   fatigueLevel: FatigueLevel,
 *   trend: TrendDirection
 * }
 *
 * Response:
 * {
 *   suggestions: Suggestion[]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json()
    const { stressScore, stressLevel, fatigueScore, fatigueLevel, trend } = body

    // Validate required fields
    if (
      typeof stressScore !== "number" ||
      typeof stressLevel !== "string" ||
      typeof fatigueScore !== "number" ||
      typeof fatigueLevel !== "string" ||
      typeof trend !== "string"
    ) {
      return NextResponse.json(
        { error: "Missing or invalid required fields" },
        { status: 400 }
      )
    }

    // Validate score ranges
    if (stressScore < 0 || stressScore > 100 || fatigueScore < 0 || fatigueScore > 100) {
      return NextResponse.json(
        { error: "Scores must be between 0 and 100" },
        { status: 400 }
      )
    }

    // Validate categorical values
    const validStressLevels: StressLevel[] = ["low", "moderate", "elevated", "high"]
    const validFatigueLevels: FatigueLevel[] = ["rested", "normal", "tired", "exhausted"]
    const validTrends: TrendDirection[] = ["improving", "stable", "declining"]

    if (!validStressLevels.includes(stressLevel as StressLevel)) {
      return NextResponse.json(
        { error: "Invalid stress level" },
        { status: 400 }
      )
    }

    if (!validFatigueLevels.includes(fatigueLevel as FatigueLevel)) {
      return NextResponse.json(
        { error: "Invalid fatigue level" },
        { status: 400 }
      )
    }

    if (!validTrends.includes(trend as TrendDirection)) {
      return NextResponse.json(
        { error: "Invalid trend direction" },
        { status: 400 }
      )
    }

    // Get and validate API key
    const apiKey = validateAPIKey(process.env.GEMINI_API_KEY)

    // Build wellness context
    const context = buildWellnessContext(
      stressScore,
      stressLevel as StressLevel,
      fatigueScore,
      fatigueLevel as FatigueLevel,
      trend as TrendDirection
    )

    // Generate user prompt
    const userPrompt = generateUserPrompt(context)

    // Call Gemini API
    const rawSuggestions = await generateSuggestions(apiKey, SYSTEM_PROMPT, userPrompt)

    // Transform to Suggestion type with IDs and timestamps
    const suggestions: Suggestion[] = rawSuggestions.map((raw) => ({
      id: crypto.randomUUID(),
      content: raw.content,
      rationale: raw.rationale,
      duration: raw.duration,
      category: raw.category,
      status: "pending" as const,
      createdAt: new Date().toISOString(),
    }))

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error("Gemini API error:", error)

    // Return appropriate error message
    if (error instanceof Error) {
      // Check for API key errors
      if (error.message.includes("API key")) {
        return NextResponse.json(
          { error: "API key configuration error" },
          { status: 500 }
        )
      }

      // Check for Gemini API errors
      if (error.message.includes("Gemini API error")) {
        return NextResponse.json(
          { error: "External API error", details: error.message },
          { status: 502 }
        )
      }

      // Check for parsing errors
      if (error.message.includes("parse")) {
        return NextResponse.json(
          { error: "Failed to parse API response" },
          { status: 500 }
        )
      }
    }

    // Generic error
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/gemini
 *
 * Health check endpoint
 */
export async function GET() {
  try {
    // Check if API key is configured (without exposing it)
    const hasApiKey = !!process.env.GEMINI_API_KEY

    return NextResponse.json({
      status: "ok",
      configured: hasApiKey,
      endpoint: "/api/gemini",
      methods: ["POST"],
    })
  } catch (error) {
    return NextResponse.json(
      { status: "error", error: "Health check failed" },
      { status: 500 }
    )
  }
}
