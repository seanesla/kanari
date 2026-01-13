/**
 * POST /api/gemini/achievements/level-title
 *
 * Generate an AI-crafted level title when the user levels up.
 *
 * Request body:
 * {
 *   level: number
 *   totalPoints: number
 *   currentDailyCompletionStreak: number
 *   longestDailyCompletionStreak: number
 * }
 *
 * Response:
 * { title: string, reasoning: string }
 */

import { NextRequest, NextResponse } from "next/server"
import { getAPIKeyFromRequest, validateAPIKey } from "@/lib/gemini/client"
import { parseGeminiJson } from "@/lib/gemini/json"
import {
  LEVEL_TITLE_RESPONSE_SCHEMA,
  LEVEL_TITLE_SYSTEM_PROMPT,
  generateLevelTitleUserPrompt,
  type GeminiLevelTitleResponse,
} from "@/lib/achievements"

function validateInput(body: unknown): body is {
  level: number
  totalPoints: number
  currentDailyCompletionStreak: number
  longestDailyCompletionStreak: number
} {
  if (typeof body !== "object" || body === null) return false
  const b = body as Record<string, unknown>

  const numericFields = ["level", "totalPoints", "currentDailyCompletionStreak", "longestDailyCompletionStreak"]
  for (const field of numericFields) {
    if (typeof b[field] !== "number" || !Number.isFinite(b[field])) return false
  }

  return true
}

async function generateLevelTitle(apiKey: string, input: {
  level: number
  totalPoints: number
  currentDailyCompletionStreak: number
  longestDailyCompletionStreak: number
}): Promise<GeminiLevelTitleResponse> {
  const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent"

  const userPrompt = generateLevelTitleUserPrompt(input)

  const request = {
    systemInstruction: {
      parts: [{ text: LEVEL_TITLE_SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.9,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 256,
      responseMimeType: "application/json",
      responseSchema: LEVEL_TITLE_RESPONSE_SCHEMA,
    },
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 20_000)

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
      throw new Error("Gemini API request timed out after 20s")
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

  const parsed = parseGeminiJson<GeminiLevelTitleResponse>(text)
  if (typeof parsed.title !== "string" || parsed.title.trim().length === 0) {
    throw new Error("Gemini response parse error: missing title")
  }

  return parsed
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = request.headers.get("content-length")
    if (contentLength && Number(contentLength) > 50_000) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 })
    }

    const body = await request.json()
    if (!validateInput(body)) {
      return NextResponse.json({ error: "Invalid request format" }, { status: 400 })
    }

    const apiKey = validateAPIKey(getAPIKeyFromRequest(request))

    const result = await generateLevelTitle(apiKey, body)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Level title generation error:", error)

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

    return NextResponse.json({ error: "Failed to generate level title" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const hasApiKey = !!getAPIKeyFromRequest(request)
    return NextResponse.json({
      status: "ok",
      configured: hasApiKey,
      endpoint: "/api/gemini/achievements/level-title",
      methods: ["POST"],
    })
  } catch {
    return NextResponse.json({ status: "error", error: "Health check failed" }, { status: 500 })
  }
}

