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
import { getAPIKeyFromRequest, validateAPIKey } from "@/lib/gemini/client"
import { maybeRateLimitKanariGeminiKey } from "@/lib/gemini/server-rate-limit"
import {
  buildCheckInSystemInstruction,
  type SystemContextSummary,
  type SystemTimeContext,
} from "@/lib/gemini/live-prompts"
import { safeRandomUUID } from "@/lib/uuid"

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
 *   systemInstruction?: string       // Custom system instruction (legacy)
 *   contextSummary?: SystemContextSummary  // AI-generated context from past sessions
 *   timeContext?: SystemTimeContext  // Current time context
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
    const contentLength = request.headers.get("content-length")
    if (contentLength && Number(contentLength) > 200_000) {
      return NextResponse.json(
        { error: "Request body too large", code: "CONFIG_ERROR" as const },
        { status: 413 }
      )
    }

    const rateLimited = maybeRateLimitKanariGeminiKey(request, "live-session")
    if (rateLimited) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later.", code: "RATE_LIMIT" as const },
        { status: 429 }
      )
    }

    // Get and validate API key (from header first, then env)
    let apiKey: string
    try {
      apiKey = validateAPIKey(getAPIKeyFromRequest(request))
    } catch {
      return NextResponse.json(
        { error: "Gemini API key not configured. Please add your API key in Settings.", code: "CONFIG_ERROR" as const },
        { status: 401 }
      )
    }

    // Parse optional request body
    let systemInstruction: string | undefined
    let body: unknown
    try {
      body = await request.json()
    } catch {
      // No body or invalid JSON - use default system instruction
      body = undefined
    }

    // Legacy: use provided system instruction directly (if present)
    if (
      body &&
      typeof body === "object" &&
      "systemInstruction" in body &&
      typeof (body as { systemInstruction?: unknown }).systemInstruction === "string"
    ) {
      systemInstruction = (body as { systemInstruction: string }).systemInstruction
    } else {
      // Default: always build the check-in instruction (with optional context)
      const contextSummary =
        body && typeof body === "object" && "contextSummary" in body
          ? ((body as { contextSummary?: unknown }).contextSummary as SystemContextSummary | undefined)
          : undefined
      const timeContext =
        body && typeof body === "object" && "timeContext" in body
          ? ((body as { timeContext?: unknown }).timeContext as SystemTimeContext | undefined)
          : undefined

      systemInstruction = buildCheckInSystemInstruction(contextSummary, timeContext)
    }

    // Generate session ID
    const sessionId = safeRandomUUID()

    // Create session on server and get session secret
    const { secret } = await sessionManager.createSession(sessionId, systemInstruction, apiKey)

    // Return session info including secret for client authentication
    const baseUrl = request.nextUrl.origin
    const responseData = {
      sessionId,
      streamUrl: `${baseUrl}/api/gemini/live/stream?sessionId=${sessionId}`,
      audioUrl: `${baseUrl}/api/gemini/live/audio`,
      secret,
    }
    // SECURITY: Never log `secret` (session bearer credential).
    // See: docs/error-patterns/logging-secrets-and-transcripts.md
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
    } catch {
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
