import { NextRequest, NextResponse } from "next/server"
import { validateAPIKey, getAPIKeyFromRequest, analyzeAudioSemantic } from "@/lib/gemini/client"

/**
 * POST /api/gemini/semantic
 *
 * Analyze audio for semantic content and emotion detection using Gemini.
 * Returns transcription with per-segment emotion labels, observations,
 * and qualitative stress/fatigue interpretations.
 *
 * Request body:
 * {
 *   audio: string,      // Base64-encoded audio data
 *   mimeType: string    // Audio MIME type (e.g., "audio/wav", "audio/webm")
 * }
 *
 * Response:
 * {
 *   segments: [{ timestamp, content, emotion }],
 *   overallEmotion: "happy" | "sad" | "angry" | "neutral",
 *   emotionConfidence: number (0-1),
 *   observations: [{ type, observation, relevance }],
 *   stressInterpretation: string,
 *   fatigueInterpretation: string,
 *   summary: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const contentLength = request.headers.get("content-length")
    if (contentLength && Number(contentLength) > 11_500_000) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 })
    }

    // Parse request body
    const body = await request.json()
    const { audio, mimeType } = body

    // Validate required fields
    if (typeof audio !== "string" || !audio) {
      return NextResponse.json(
        { error: "Missing or invalid audio data. Must be a base64-encoded string." },
        { status: 400 }
      )
    }

    if (typeof mimeType !== "string" || !mimeType) {
      return NextResponse.json(
        { error: "Missing or invalid mimeType. Must be a string like 'audio/wav' or 'audio/webm'." },
        { status: 400 }
      )
    }

    // Validate supported audio formats
    const supportedFormats = [
      "audio/wav",
      "audio/wave",
      "audio/x-wav",
      "audio/webm",
      "audio/ogg",
      "audio/mpeg",
      "audio/mp3",
      "audio/mp4",
      "audio/m4a",
      "audio/flac",
    ]

    if (!supportedFormats.some((format) => mimeType.toLowerCase().startsWith(format))) {
      return NextResponse.json(
        { error: `Unsupported audio format: ${mimeType}. Supported: ${supportedFormats.join(", ")}` },
        { status: 400 }
      )
    }

    // Validate base64 format (basic check)
    try {
      // Check if it's valid base64 by attempting to decode a small portion
      const testDecode = atob(audio.slice(0, 100))
      if (!testDecode) throw new Error("Empty decode")
    } catch {
      return NextResponse.json(
        { error: "Invalid base64 encoding for audio data" },
        { status: 400 }
      )
    }

    // Check audio size (limit to ~10MB base64 which is ~7.5MB raw)
    const maxBase64Size = 10 * 1024 * 1024 // 10MB
    if (audio.length > maxBase64Size) {
      return NextResponse.json(
        { error: `Audio data too large. Maximum size is ${maxBase64Size / 1024 / 1024}MB base64.` },
        { status: 400 }
      )
    }

    // Get and validate API key
    const apiKey = validateAPIKey(getAPIKeyFromRequest(request))

    // Call Gemini semantic analysis
    const analysis = await analyzeAudioSemantic(apiKey, audio, mimeType)

    // Return the analysis result
    return NextResponse.json(analysis)
  } catch (error) {
    console.error("Gemini semantic analysis error:", error)

    // Return appropriate error message
    if (error instanceof Error) {
      // Check for API key errors
      if (error.message.includes("API key")) {
        return NextResponse.json(
          { error: "API key configuration error. Please add your Gemini API key in Settings." },
          { status: 401 }
        )
      }

      // Check for Gemini API errors
      if (error.message.includes("Gemini API error")) {
        return NextResponse.json(
          { error: "External API error", details: error.message },
          { status: 502 }
        )
      }

      // Structured output parsing errors (model returned invalid JSON)
      if (error.message.includes("Gemini response parse error")) {
        return NextResponse.json(
          { error: "External API error", details: error.message },
          { status: 502 }
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
 * GET /api/gemini/semantic
 *
 * Health check endpoint
 */
export async function GET(request: NextRequest) {
  try {
    const hasApiKey = !!getAPIKeyFromRequest(request)

    return NextResponse.json({
      status: "ok",
      configured: hasApiKey,
      source: hasApiKey ? "header" : "none",
      endpoint: "/api/gemini/semantic",
      methods: ["POST"],
      description: "Analyze audio for emotion detection and semantic content",
    })
  } catch {
    return NextResponse.json(
      { status: "error", error: "Health check failed" },
      { status: 500 }
    )
  }
}
