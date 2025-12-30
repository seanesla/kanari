/**
 * Tool Response API Endpoint
 *
 * Receives function responses from the client and forwards them to Gemini.
 * Used for intelligent silence and other function calling features.
 *
 * Source: Context7 - /googleapis/js-genai docs - "sendToolResponse"
 */

import { sessionManager } from "@/lib/gemini/session-manager"

export async function POST(request: Request) {
  try {
    const { sessionId, secret, functionResponses } = await request.json()

    // Validate required fields
    if (!sessionId || !secret || !functionResponses) {
      return Response.json(
        { error: "Missing required fields: sessionId, secret, functionResponses" },
        { status: 400 }
      )
    }

    // Validate session ownership
    if (!sessionManager.validateSecret(sessionId, secret)) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Send tool response to Gemini
    await sessionManager.sendToolResponse(sessionId, functionResponses)

    return Response.json({ success: true })
  } catch (error) {
    console.error("[Tool Response API] Error:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to send tool response" },
      { status: 500 }
    )
  }
}
