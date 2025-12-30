/**
 * Gemini Live API Session Endpoint
 *
 * Generates ephemeral tokens for secure client-side WebSocket connections
 * to the Gemini Live API. Tokens are short-lived and single-use.
 *
 * Source: Context7 - /websites/ai_google_dev_api docs - "Ephemeral tokens"
 * https://ai.google.dev/gemini-api/docs/ephemeral-tokens
 */

import { NextRequest, NextResponse } from "next/server"
import { GoogleGenAI, Modality, ApiError } from "@google/genai"

// Model for conversational check-in with native audio
const LIVE_API_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"

// WebSocket endpoint for Gemini Live API (v1alpha to match ephemeral token API version)
const LIVE_API_WS_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent"

interface SessionResponse {
  token: string
  expiresAt: string
  wsUrl: string
  model: string
}

interface ErrorResponse {
  error: string
  code: "UNAUTHORIZED" | "API_ERROR" | "RATE_LIMIT" | "CONFIG_ERROR"
}

/**
 * POST /api/gemini/session
 *
 * Generate an ephemeral token for Gemini Live API WebSocket connection.
 * The token is single-use and expires in 30 minutes.
 *
 * Response:
 * {
 *   token: string,      // Ephemeral token for WebSocket auth
 *   expiresAt: string,  // ISO timestamp when token expires
 *   wsUrl: string,      // WebSocket URL to connect to
 *   model: string       // Model identifier
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse<SessionResponse | ErrorResponse>> {
  try {
    // Get API key from environment
    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key not configured", code: "CONFIG_ERROR" as const },
        { status: 500 }
      )
    }

    // Initialize Gemini client with API key
    const client = new GoogleGenAI({ apiKey })

    // Token expires in 30 minutes
    const expireTime = new Date(Date.now() + 30 * 60 * 1000)

    // New session can be started within 2 minutes of token creation
    const newSessionExpireTime = new Date(Date.now() + 2 * 60 * 1000)

    // Create ephemeral token with constraints for Live API
    // Source: https://ai.google.dev/gemini-api/docs/ephemeral-tokens
    const tokenResponse = await client.authTokens.create({
      config: {
        uses: 1, // Single-use token
        expireTime: expireTime.toISOString(),
        newSessionExpireTime: newSessionExpireTime.toISOString(),
        liveConnectConstraints: {
          model: `models/${LIVE_API_MODEL}`,
          config: {
            sessionResumption: {}, // Allow session resumption within expireTime
            responseModalities: [Modality.AUDIO, Modality.TEXT],
          },
        },
        httpOptions: {
          apiVersion: "v1alpha",
        },
      },
    })

    // Extract token from response
    // The token is in tokenResponse.name according to the SDK
    const token = tokenResponse.name

    if (!token) {
      console.error("Ephemeral token creation failed:", tokenResponse)
      return NextResponse.json(
        { error: "Failed to create ephemeral token", code: "API_ERROR" as const },
        { status: 500 }
      )
    }

    return NextResponse.json({
      token,
      expiresAt: expireTime.toISOString(),
      wsUrl: LIVE_API_WS_URL,
      model: LIVE_API_MODEL,
    })
  } catch (error) {
    // Log sanitized error - never log full error which may contain API keys/tokens
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const sanitizedMessage = errorMessage
      .replace(/key[=:]\s*[^\s&]+/gi, "key=[REDACTED]")
      .replace(/token[=:]\s*[^\s&]+/gi, "token=[REDACTED]")
      .replace(/access_token[=:]\s*[^\s&]+/gi, "access_token=[REDACTED]")
    console.error("[Gemini Session] Error:", sanitizedMessage)

    // Handle ApiError from @google/genai SDK (has status as number)
    if (error instanceof ApiError) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Please try again later.", code: "RATE_LIMIT" as const },
          { status: 429 }
        )
      }
      if (error.status === 401 || error.status === 403) {
        return NextResponse.json(
          { error: "API key invalid or lacks access to Gemini Live API.", code: "UNAUTHORIZED" as const },
          { status: 401 }
        )
      }
    }

    // Check message for auth errors (fallback for "unregistered callers" error)
    if (errorMessage.includes("unregistered callers") || errorMessage.includes("API Key")) {
      return NextResponse.json(
        { error: "API key lacks access to Gemini Live API ephemeral tokens.", code: "UNAUTHORIZED" as const },
        { status: 401 }
      )
    }

    // Return generic error to client - never expose raw error.message which may contain sensitive data
    return NextResponse.json(
      {
        error: "Failed to create session. Please try again.",
        code: "API_ERROR" as const,
      },
      { status: 500 }
    )
  }
}
