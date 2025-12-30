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
import { callGeminiAPI, validateAPIKey, getAPIKeyFromRequest } from "@/lib/gemini/client"
import {
  CHECK_IN_CONTEXT_SUMMARY_PROMPT,
  CHECK_IN_CONTEXT_SUMMARY_SCHEMA,
  type CheckInContextSummaryResponse,
} from "@/lib/gemini/prompts"
import { parseGeminiJson } from "@/lib/gemini/json"
import type { TimeContext, VoiceTrends } from "@/lib/gemini/check-in-context"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

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
- Current time (user local): ${timeContext.currentTime}
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

function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/AIza[0-9A-Za-z\-_]{10,}/g, "AIza[REDACTED]")
    .replace(/key[=:]\s*[^\s&]+/gi, "key=[REDACTED]")
    .replace(/token[=:]\s*[^\s&]+/gi, "token=[REDACTED]")
}

async function generateContextSummary(
  apiKey: string,
  context: CheckInContextRequest
): Promise<CheckInContextSummaryResponse> {
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

  const data = await callGeminiAPI(apiKey, request, 30_000)

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error("No response from Gemini API")
  }

  const text = data.candidates[0]?.content?.parts?.[0]?.text
  if (typeof text !== "string") {
    throw new Error("Gemini response parse error: missing text")
  }

  const parsed = parseGeminiJson<CheckInContextSummaryResponse>(text)

  // Validate structure
  if (
    typeof parsed.patternSummary !== "string" ||
    !Array.isArray(parsed.keyObservations) ||
    typeof parsed.suggestedOpener !== "string" ||
    typeof parsed.contextNotes !== "string"
  ) {
    throw new Error("Gemini response parse error: Invalid response structure")
  }

  return parsed
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = request.headers.get("content-length")
    if (contentLength && Number(contentLength) > 500_000) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 })
    }

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
    const message = error instanceof Error ? sanitizeErrorMessage(error.message) : "Unknown error"
    console.error("Check-in context generation error:", message)

    if (error instanceof Error) {
      if (message.includes("API key")) {
        return NextResponse.json(
          { error: "API key configuration error. Please add your Gemini API key in Settings." },
          { status: 401 }
        )
      }

      if (
        message.includes("Gemini API error") ||
        message.includes("Gemini response parse error")
      ) {
        return NextResponse.json(
          { error: "External API error", details: message },
          { status: 502 }
        )
      }

      // Timeouts and connection errors often surface as generic fetch failures.
      if (message.toLowerCase().includes("timed out") || message.toLowerCase().includes("timeout")) {
        return NextResponse.json(
          { error: "Gemini API request timed out", details: message },
          { status: 504 }
        )
      }

      if (
        message.toLowerCase().includes("fetch failed") ||
        message.includes("ECONN") ||
        message.includes("ENOTFOUND") ||
        message.includes("EAI_AGAIN")
      ) {
        return NextResponse.json(
          { error: "Unable to reach Gemini API", details: message },
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
