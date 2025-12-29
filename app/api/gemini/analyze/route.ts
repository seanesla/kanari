import { NextRequest, NextResponse } from "next/server"
import { validateAPIKey, analyzeAudioSemantic } from "@/lib/gemini/client"
import type { GeminiSemanticAnalysis } from "@/lib/types"

/**
 * POST /api/gemini/analyze
 *
 * Analyze audio for semantic content and emotion using Gemini API
 *
 * Request body:
 * {
 *   audioData: string,  // Base64-encoded audio
 *   mimeType: string    // Audio MIME type (e.g., "audio/wav", "audio/webm")
 * }
 *
 * Response:
 * {
 *   analysis: GeminiSemanticAnalysis
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json()
    const { audioData, mimeType } = body

    // Validate required fields
    if (typeof audioData !== "string" || typeof mimeType !== "string") {
      return NextResponse.json({ error: "Missing or invalid required fields: audioData and mimeType" }, { status: 400 })
    }

    // Validate audioData is base64
    if (!audioData || audioData.length === 0) {
      return NextResponse.json({ error: "audioData cannot be empty" }, { status: 400 })
    }

    // Validate mimeType format
    const validMimeTypes = ["audio/wav", "audio/webm", "audio/ogg", "audio/mp3", "audio/mpeg", "audio/mp4"]
    if (!validMimeTypes.includes(mimeType.toLowerCase())) {
      return NextResponse.json(
        {
          error: `Invalid mimeType. Must be one of: ${validMimeTypes.join(", ")}`,
        },
        { status: 400 }
      )
    }

    // Get and validate API key
    const apiKey = validateAPIKey(process.env.GEMINI_API_KEY)

    // Call Gemini API for audio semantic analysis
    const analysis: GeminiSemanticAnalysis = await analyzeAudioSemantic(apiKey, audioData, mimeType)

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error("Gemini audio analysis error:", error)

    // Return appropriate error message
    if (error instanceof Error) {
      // Check for API key errors
      if (error.message.includes("API key")) {
        return NextResponse.json({ error: "API key configuration error" }, { status: 500 })
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
        return NextResponse.json({ error: "Failed to parse API response", details: error.message }, { status: 500 })
      }

      // Check for validation errors
      if (error.message.includes("Missing") || error.message.includes("Invalid")) {
        return NextResponse.json(
          { error: "API response validation failed", details: error.message },
          { status: 502 }
        )
      }
    }

    // Generic error
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * GET /api/gemini/analyze
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
      endpoint: "/api/gemini/analyze",
      methods: ["POST"],
      description: "Gemini audio semantic analysis",
    })
  } catch (error) {
    return NextResponse.json({ status: "error", error: "Health check failed" }, { status: 500 })
  }
}
