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
 *   trend: TrendDirection,
 *   voicePatterns?: { speechRate, energyLevel, pauseFrequency, voiceTone },
 *   history?: { recordingCount, daysOfData, averageStress, averageFatigue, stressChange, fatigueChange },
 *   burnout?: { riskLevel, predictedDays, factors },
 *   confidence?: number
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
    const {
      stressScore,
      stressLevel,
      fatigueScore,
      fatigueLevel,
      trend,
      voicePatterns,
      history,
      burnout,
      confidence
    } = body

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

    // Validate optional enriched fields
    if (voicePatterns !== undefined) {
      if (typeof voicePatterns !== "object" || voicePatterns === null) {
        return NextResponse.json(
          { error: "voicePatterns must be an object" },
          { status: 400 }
        )
      }

      const validSpeechRates = ["fast", "normal", "slow"]
      const validEnergyLevels = ["high", "moderate", "low"]
      const validPauseFrequencies = ["frequent", "normal", "rare"]
      const validVoiceTones = ["bright", "neutral", "dull"]

      if (!validSpeechRates.includes(voicePatterns.speechRate)) {
        return NextResponse.json(
          { error: "Invalid speech rate. Must be: fast, normal, or slow" },
          { status: 400 }
        )
      }

      if (!validEnergyLevels.includes(voicePatterns.energyLevel)) {
        return NextResponse.json(
          { error: "Invalid energy level. Must be: high, moderate, or low" },
          { status: 400 }
        )
      }

      if (!validPauseFrequencies.includes(voicePatterns.pauseFrequency)) {
        return NextResponse.json(
          { error: "Invalid pause frequency. Must be: frequent, normal, or rare" },
          { status: 400 }
        )
      }

      if (!validVoiceTones.includes(voicePatterns.voiceTone)) {
        return NextResponse.json(
          { error: "Invalid voice tone. Must be: bright, neutral, or dull" },
          { status: 400 }
        )
      }
    }

    if (history !== undefined) {
      if (typeof history !== "object" || history === null) {
        return NextResponse.json(
          { error: "history must be an object" },
          { status: 400 }
        )
      }

      if (typeof history.recordingCount !== "number" || history.recordingCount < 0) {
        return NextResponse.json(
          { error: "history.recordingCount must be a non-negative number" },
          { status: 400 }
        )
      }

      if (typeof history.daysOfData !== "number" || history.daysOfData < 0) {
        return NextResponse.json(
          { error: "history.daysOfData must be a non-negative number" },
          { status: 400 }
        )
      }

      if (typeof history.averageStress !== "number" || history.averageStress < 0 || history.averageStress > 100) {
        return NextResponse.json(
          { error: "history.averageStress must be between 0 and 100" },
          { status: 400 }
        )
      }

      if (typeof history.averageFatigue !== "number" || history.averageFatigue < 0 || history.averageFatigue > 100) {
        return NextResponse.json(
          { error: "history.averageFatigue must be between 0 and 100" },
          { status: 400 }
        )
      }

      if (typeof history.stressChange !== "string") {
        return NextResponse.json(
          { error: "history.stressChange must be a string (e.g., '+15% from baseline' or 'stable')" },
          { status: 400 }
        )
      }

      if (typeof history.fatigueChange !== "string") {
        return NextResponse.json(
          { error: "history.fatigueChange must be a string (e.g., '+10% from baseline' or 'stable')" },
          { status: 400 }
        )
      }
    }

    if (burnout !== undefined) {
      if (typeof burnout !== "object" || burnout === null) {
        return NextResponse.json(
          { error: "burnout must be an object" },
          { status: 400 }
        )
      }

      const validRiskLevels = ["low", "moderate", "high", "critical"]

      if (!validRiskLevels.includes(burnout.riskLevel)) {
        return NextResponse.json(
          { error: "Invalid burnout risk level. Must be: low, moderate, high, or critical" },
          { status: 400 }
        )
      }

      if (typeof burnout.predictedDays !== "number" || burnout.predictedDays < 0) {
        return NextResponse.json(
          { error: "burnout.predictedDays must be a non-negative number" },
          { status: 400 }
        )
      }

      if (!Array.isArray(burnout.factors)) {
        return NextResponse.json(
          { error: "burnout.factors must be an array" },
          { status: 400 }
        )
      }

      // Validate each factor is a string
      for (const factor of burnout.factors) {
        if (typeof factor !== "string") {
          return NextResponse.json(
            { error: "All burnout.factors must be strings" },
            { status: 400 }
          )
        }
      }
    }

    if (confidence !== undefined) {
      if (typeof confidence !== "number" || confidence < 0 || confidence > 1) {
        return NextResponse.json(
          { error: "confidence must be a number between 0 and 1" },
          { status: 400 }
        )
      }
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

    // Build enriched context object for future prompt enhancement
    // Currently validated but not yet used in prompts (see lib/gemini/prompts.ts)
    const enrichedContext = {
      ...context,
      ...(voicePatterns && { voicePatterns }),
      ...(history && { history }),
      ...(burnout && { burnout }),
      ...(confidence !== undefined && { confidence })
    }

    // Generate user prompt (currently uses basic context only)
    // Future enhancement: pass enrichedContext when prompts.ts is updated
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
