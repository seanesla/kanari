/**
 * Tool Response API Endpoint
 *
 * Receives function responses from the client and forwards them to Gemini.
 * Used for intelligent silence and other function calling features.
 *
 * Source: Context7 - /googleapis/js-genai docs - "sendToolResponse"
 */

import { sessionManager } from "@/lib/gemini/session-manager"
import { ToolResponseRequestSchema } from "@/lib/gemini/schemas"

export async function POST(request: Request) {
  try {
    const contentLength = request.headers.get("content-length")
    if (contentLength && Number(contentLength) > 256_000) {
      return Response.json({ error: "Request body too large" }, { status: 413 })
    }

    const bodyData = await request.json()
    const result = ToolResponseRequestSchema.safeParse(bodyData)

    if (!result.success) {
      return Response.json(
        { error: "Invalid request body", details: result.error.issues },
        { status: 400 }
      )
    }

    const { sessionId, secret, functionResponses } = result.data

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
