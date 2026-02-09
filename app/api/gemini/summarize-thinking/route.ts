import { NextRequest, NextResponse } from "next/server"
import { validateAPIKey, getAPIKeyFromRequest } from "@/lib/gemini/client"
import { maybeRateLimitKanariGeminiKey } from "@/lib/gemini/server-rate-limit"

/**
 * POST /api/gemini/summarize-thinking
 *
 * Summarize AI thinking/chain-of-thought text using Gemini 3 Flash.
 * Used to provide a concise summary of what the AI is "thinking about"
 * during the processing state.
 *
 * Request body:
 * { thinkingText: string }
 *
 * Response:
 * { summary: string }
 */
export async function POST(request: NextRequest) {
  try {
    const contentLength = request.headers.get("content-length")
    if (contentLength && Number(contentLength) > 50_000) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 })
    }

    const rateLimited = maybeRateLimitKanariGeminiKey(request, "summarize-thinking")
    if (rateLimited) return rateLimited

    const body = await request.json()
    const { thinkingText } = body

    if (!thinkingText || typeof thinkingText !== "string") {
      return NextResponse.json(
        { error: "thinkingText is required and must be a string" },
        { status: 400 }
      )
    }

    // Limit input length to prevent abuse
    if (thinkingText.length > 10_000) {
      return NextResponse.json(
        { error: "thinkingText too long (max 10,000 characters)" },
        { status: 400 }
      )
    }

    const apiKey = validateAPIKey(getAPIKeyFromRequest(request))

    // Keep non-audio runtime summarization on Gemini 3 Flash.
    // Pattern doc: docs/error-patterns/non-audio-runtime-model-drift.md
    const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent"

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10_000) // 10s timeout

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: `You are a helpful assistant that summarizes AI thinking processes.
Given the AI's internal reasoning/chain-of-thought, provide a very brief (1-2 sentences, max 100 words) summary of what the AI is considering or working through.
Focus on the key points without technical jargon.
Be conversational and use present tense (e.g., "Thinking about...", "Considering...", "Looking at...").
Do NOT include any meta-commentary about the thinking process itself.`
            }]
          },
          contents: [{
            role: "user",
            parts: [{ text: `Summarize this AI thinking process:\n\n${thinkingText}` }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 150,
          }
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[summarize-thinking] API error:", errorText)
        return NextResponse.json(
          { error: "Failed to generate summary" },
          { status: 502 }
        )
      }

      const data = await response.json()
      const summary = data.candidates?.[0]?.content?.parts?.[0]?.text

      if (!summary) {
        return NextResponse.json(
          { error: "No summary generated" },
          { status: 502 }
        )
      }

      return NextResponse.json({ summary: summary.trim() })

    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === "AbortError") {
        return NextResponse.json(
          { error: "Request timed out" },
          { status: 504 }
        )
      }
      throw error
    }

  } catch (error) {
    console.error("[summarize-thinking] Error:", error)

    if (error instanceof Error && error.message.includes("API key")) {
      return NextResponse.json(
        { error: "API key configuration error" },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
