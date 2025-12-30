/**
 * POST /api/gemini/check-in-context
 *
 * Generate a personalized context summary for AI-initiated check-in conversations.
 * Uses Gemini 3 Flash to analyze past sessions and voice trends, producing a warm
 * opening for the conversational AI.
 *
 * Request body: CheckInContextRequest
 * Response: { summary: CheckInContextSummaryResponse } | { error: string }
 */

import { NextRequest, NextResponse } from "next/server"
import { validateAPIKey, getAPIKeyFromRequest } from "@/lib/gemini/client"
import {
  CHECK_IN_CONTEXT_SUMMARY_PROMPT,
  CHECK_IN_CONTEXT_SUMMARY_SCHEMA,
  type CheckInContextSummaryResponse,
} from "@/lib/gemini/prompts"
import type { TimeContext, VoiceTrends } from "@/lib/gemini/check-in-context"

// ============================================
// Types
// ============================================

interface SessionSummary {
  startedAt: string
  messageCount: number
  userMessages: string[]
  summary?: {
    overallMood: string
    suggestedActions: string[]
  }
}

interface CheckInContextRequest {
  sessionCount: number
  sessionSummaries: SessionSummary[]
  timeContext: TimeContext
  voiceTrends: VoiceTrends
}

// ============================================
// Validation
// ============================================

function validateContextRequest(body: unknown): body is CheckInContextRequest {
  if (typeof body !== "object" || body === null) return false

  const req = body as Record<string, unknown>

  // Check session count
  if (typeof req.sessionCount !== "number") return false

  // Check session summaries
  if (!Array.isArray(req.sessionSummaries)) return false

  // Check time context
  if (typeof req.timeContext !== "object" || req.timeContext === null) return false
  const tc = req.timeContext as Record<string, unknown>
  if (typeof tc.currentTime !== "string") return false
  if (typeof tc.dayOfWeek !== "string") return false
  if (!["morning", "afternoon", "evening", "night"].includes(tc.timeOfDay as string)) return false

  // Check voice trends
  if (typeof req.voiceTrends !== "object" || req.voiceTrends === null) return false

  return true
}

// ============================================
// Prompt Generation
// ============================================

function generateUserPrompt(context: CheckInContextRequest): string {
  const { sessionCount, sessionSummaries, timeContext, voiceTrends } = context

  let prompt = `Generate a personalized check-in context summary based on this user data:

TIME CONTEXT:
- Current time: ${timeContext.currentTime}
- Day of week: ${timeContext.dayOfWeek}
- Time of day: ${timeContext.timeOfDay}
- Days since last check-in: ${timeContext.daysSinceLastCheckIn ?? "First check-in"}`

  // Add voice trends if available
  if (voiceTrends.stressTrend || voiceTrends.fatigueTrend) {
    prompt += `

VOICE PATTERN TRENDS (past week):`
    if (voiceTrends.stressTrend) {
      prompt += `
- Stress trend: ${voiceTrends.stressTrend} (avg: ${voiceTrends.averageStressLastWeek ?? "N/A"}/100)`
    }
    if (voiceTrends.fatigueTrend) {
      prompt += `
- Fatigue trend: ${voiceTrends.fatigueTrend} (avg: ${voiceTrends.averageFatigueLastWeek ?? "N/A"}/100)`
    }
  }

  // Add session history if available
  if (sessionCount > 0 && sessionSummaries.length > 0) {
    prompt += `

RECENT CHECK-IN HISTORY (${sessionCount} total sessions):
${sessionSummaries
  .slice(0, 5)
  .map((s, i) => {
    let sessionStr = `
Session ${i + 1} (${s.startedAt}):
- Messages: ${s.messageCount}`
    if (s.userMessages.length > 0) {
      sessionStr += `
- What they shared: ${s.userMessages.slice(0, 2).join("; ")}`
    }
    if (s.summary) {
      sessionStr += `
- Overall mood: ${s.summary.overallMood}`
    }
    return sessionStr
  })
  .join("")}`
  } else {
    prompt += `

NO PREVIOUS CHECK-IN HISTORY - This is the user's first check-in. Generate a warm welcome!`
  }

  prompt += `

Based on this context, generate a warm, personalized opening for the AI to start the conversation.
Return ONLY the JSON object with patternSummary, keyObservations, suggestedOpener, and contextNotes.`

  return prompt
}

// ============================================
// API Handler
// ============================================

async function generateContextSummary(
  apiKey: string,
  context: CheckInContextRequest
): Promise<CheckInContextSummaryResponse> {
  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent"

  const userPrompt = generateUserPrompt(context)

  const request = {
    systemInstruction: {
      parts: [{ text: CHECK_IN_CONTEXT_SUMMARY_PROMPT }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.8, // Warm, creative openers
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
      responseSchema: CHECK_IN_CONTEXT_SUMMARY_SCHEMA,
    },
  }

  const response = await fetch(`${endpoint}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error("No response from Gemini API")
  }

  const text = data.candidates[0].content.parts[0].text

  try {
    const parsed = JSON.parse(text) as CheckInContextSummaryResponse

    // Validate structure
    if (
      typeof parsed.patternSummary !== "string" ||
      !Array.isArray(parsed.keyObservations) ||
      typeof parsed.suggestedOpener !== "string" ||
      typeof parsed.contextNotes !== "string"
    ) {
      throw new Error("Invalid response structure")
    }

    return parsed
  } catch (error) {
    throw new Error(`Failed to parse Gemini response: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    if (!validateContextRequest(body)) {
      return NextResponse.json(
        { error: "Invalid context request format" },
        { status: 400 }
      )
    }

    // Get and validate API key
    const apiKey = validateAPIKey(getAPIKeyFromRequest(request))

    // Generate context summary
    const summary = await generateContextSummary(apiKey, body)

    return NextResponse.json({ summary })
  } catch (error) {
    console.error("Check-in context generation error:", error)

    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        return NextResponse.json(
          { error: "API key configuration error" },
          { status: 500 }
        )
      }

      if (error.message.includes("Gemini API error")) {
        return NextResponse.json(
          { error: "External API error", details: error.message },
          { status: 502 }
        )
      }
    }

    return NextResponse.json(
      { error: "Failed to generate check-in context" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/gemini/check-in-context
 *
 * Health check endpoint
 */
export async function GET(request: NextRequest) {
  try {
    const hasApiKey = !!getAPIKeyFromRequest(request)

    return NextResponse.json({
      status: "ok",
      configured: hasApiKey,
      endpoint: "/api/gemini/check-in-context",
      methods: ["POST"],
    })
  } catch {
    return NextResponse.json(
      { status: "error", error: "Health check failed" },
      { status: 500 }
    )
  }
}
