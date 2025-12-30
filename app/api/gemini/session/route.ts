/**
 * Gemini Live API Session Endpoint
 *
 * Creates a server-side Gemini Live session using the SDK's ai.live.connect().
 * Returns session ID and URLs for SSE stream and audio input.
 *
 * Architecture:
 * - Session is created and managed on the server (API key stays server-side)
 * - Client receives audio via SSE stream
 * - Client sends audio via POST requests
 *
 * Source: Context7 - /googleapis/js-genai docs - "Live.connect"
 */

import { NextRequest, NextResponse } from "next/server"
import { sessionManager } from "@/lib/gemini/session-manager"
import { ApiError } from "@google/genai"

interface SessionResponse {
  sessionId: string
  streamUrl: string
  audioUrl: string
  secret: string
}

interface ErrorResponse {
  error: string
  code: "UNAUTHORIZED" | "API_ERROR" | "RATE_LIMIT" | "CONFIG_ERROR" | "MAX_SESSIONS"
}

/**
 * POST /api/gemini/session
 *
 * Create a new Gemini Live session on the server.
 *
 * Request body (optional):
 * {
 *   systemInstruction?: string  // Custom system instruction
 * }
 *
 * Response:
 * {
 *   sessionId: string,   // UUID for the session
 *   streamUrl: string,   // SSE endpoint for receiving audio/transcripts
 *   audioUrl: string     // POST endpoint for sending audio
 * }
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<SessionResponse | ErrorResponse>> {
  try {
    // Check API key is configured
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key not configured", code: "CONFIG_ERROR" as const },
        { status: 500 }
      )
    }

    // Parse optional request body
    let systemInstruction: string | undefined
    try {
      const body = await request.json()
      systemInstruction = body?.systemInstruction
    } catch {
      // No body or invalid JSON - use default system instruction
    }

    // Generate session ID
    const sessionId = crypto.randomUUID()

    // Create session on server and get session secret
    console.log(`[Gemini Session] Creating session ${sessionId}`)
    const { secret } = await sessionManager.createSession(sessionId, systemInstruction)

    // Return session info including secret for client authentication
    const baseUrl = request.nextUrl.origin
    const responseData = {
      sessionId,
      streamUrl: `${baseUrl}/api/gemini/live/stream?sessionId=${sessionId}`,
      audioUrl: `${baseUrl}/api/gemini/live/audio`,
      secret,
    }
    console.log(`[Gemini Session] Response data:`, JSON.stringify(responseData))
    return NextResponse.json(responseData)
  } catch (error) {
    // Log sanitized error
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const sanitizedMessage = errorMessage
      .replace(/key[=:]\s*[^\s&]+/gi, "key=[REDACTED]")
      .replace(/token[=:]\s*[^\s&]+/gi, "token=[REDACTED]")
    console.error("[Gemini Session] Error:", sanitizedMessage)

    // Handle max sessions error
    if (errorMessage.includes("Maximum concurrent sessions")) {
      return NextResponse.json(
        { error: "Server busy. Please try again later.", code: "MAX_SESSIONS" as const },
        { status: 503 }
      )
    }

    // Handle ApiError from @google/genai SDK
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

    // Return generic error
    return NextResponse.json(
      { error: "Failed to create session. Please try again.", code: "API_ERROR" as const },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/gemini/session
 *
 * Close an active Gemini Live session.
 *
 * Request body:
 * {
 *   sessionId: string,  // Session ID to close
 *   secret: string      // Session secret for authentication
 * }
 */
export async function DELETE(
  request: NextRequest
): Promise<NextResponse<{ ok: boolean } | ErrorResponse>> {
  try {
    // Parse and validate request body
    let body: { sessionId?: string; secret?: string }
    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid JSON in request body", code: "CONFIG_ERROR" as const },
        { status: 400 }
      )
    }

    const { sessionId, secret } = body

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId", code: "CONFIG_ERROR" as const }, { status: 400 })
    }

    if (!secret) {
      return NextResponse.json({ error: "Missing session secret", code: "CONFIG_ERROR" as const }, { status: 400 })
    }

    // Validate session ownership
    if (!sessionManager.validateSecret(sessionId, secret)) {
      return NextResponse.json({ error: "Invalid session secret", code: "UNAUTHORIZED" as const }, { status: 403 })
    }

    sessionManager.closeSession(sessionId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[Gemini Session] Error closing session:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: message, code: "API_ERROR" as const },
      { status: 500 }
    )
  }
}
