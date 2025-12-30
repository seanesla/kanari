/**
 * Gemini Live Audio Input Endpoint
 *
 * POST endpoint for sending audio chunks to an active Gemini session.
 * The client sends base64-encoded PCM audio (16kHz, 16-bit, mono).
 *
 * Request body:
 * {
 *   sessionId: string,
 *   audio?: string,      // base64 PCM audio
 *   text?: string,       // text message (for context injection)
 *   audioEnd?: boolean   // signal end of audio stream
 * }
 */

import { NextRequest, NextResponse } from "next/server"
import { sessionManager } from "@/lib/gemini/session-manager"
import { AudioInputRequestSchema } from "@/lib/gemini/schemas"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    const bodyData = await request.json()
    const result = AudioInputRequestSchema.safeParse(bodyData)

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: result.error.issues },
        { status: 400 }
      )
    }

    const { sessionId, secret, audio, text, audioEnd } = result.data

    // Check if session exists
    if (!sessionManager.hasSession(sessionId)) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Validate session ownership
    if (!sessionManager.validateSecret(sessionId, secret)) {
      return NextResponse.json({ error: "Invalid session secret" }, { status: 403 })
    }

    // Handle audio chunk
    if (audio) {
      await sessionManager.sendAudio(sessionId, audio)
    }

    // Handle text message (for context injection)
    if (text) {
      await sessionManager.sendText(sessionId, text)
    }

    // Handle audio stream end signal
    if (audioEnd) {
      await sessionManager.sendAudioEnd(sessionId)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[Audio API] Error:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
