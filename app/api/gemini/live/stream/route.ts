/**
 * Gemini Live SSE Stream Endpoint
 *
 * Server-Sent Events endpoint for streaming Gemini responses to the client.
 * The client connects to this endpoint after creating a session.
 *
 * Events sent:
 * - message: Gemini server messages (audio chunks, transcripts, turn signals)
 * - error: Error events
 * - close: Session closed
 * - ready: Session ready to receive audio
 */

import { NextRequest } from "next/server"
import { sessionManager } from "@/lib/gemini/session-manager"
import type { LiveServerMessage } from "@google/genai"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Extended message type to handle fields that may not be in SDK types yet
interface ExtendedServerMessage extends LiveServerMessage {
  inputTranscription?: {
    text?: string
    isFinal?: boolean
  }
  serverContent?: {
    modelTurn?: {
      parts?: Array<{
        inlineData?: { mimeType?: string; data?: string }
        text?: string
      }>
    }
    turnComplete?: boolean
    interrupted?: boolean
    outputTranscription?: {
      text?: string
      finished?: boolean
    }
  }
}

/**
 * Format a server message for SSE transmission
 * Extracts relevant fields to minimize payload size
 */
function formatServerMessage(msg: ExtendedServerMessage): object {
  const formatted: Record<string, unknown> = {}

  // Setup complete signal
  if (msg.setupComplete) {
    formatted.setupComplete = true
  }

  // Server content (audio, text, turn signals)
  if (msg.serverContent) {
    const content: Record<string, unknown> = {}

    // Model turn with parts (audio/text)
    if (msg.serverContent.modelTurn?.parts) {
      content.modelTurn = {
        parts: msg.serverContent.modelTurn.parts.map((part) => {
          if (part.inlineData) {
            return {
              inlineData: {
                mimeType: part.inlineData.mimeType,
                data: part.inlineData.data,
              },
            }
          }
          if (part.text) {
            return { text: part.text }
          }
          return part
        }),
      }
    }

    // Turn complete signal
    if (msg.serverContent.turnComplete) {
      content.turnComplete = true
    }

    // Interrupted signal (barge-in)
    if (msg.serverContent.interrupted) {
      content.interrupted = true
    }

    // Output transcription (what Gemini is actually saying)
    // Source: Context7 - /googleapis/js-genai docs - "outputAudioTranscription"
    if (msg.serverContent.outputTranscription) {
      content.outputTranscription = msg.serverContent.outputTranscription
    }

    formatted.serverContent = content
  }

  // Input transcription (may be on extended message type)
  if (msg.inputTranscription) {
    formatted.inputTranscription = msg.inputTranscription
  }

  return formatted
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId")

  if (!sessionId) {
    return new Response(JSON.stringify({ error: "Missing sessionId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Get secret from header only (not query params for security)
  const secret = request.headers.get("x-session-secret")
  if (!secret) {
    return new Response(JSON.stringify({ error: "Missing session secret" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Check if session exists
  if (!sessionManager.hasSession(sessionId)) {
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Validate session ownership
  if (!sessionManager.validateSecret(sessionId, secret)) {
    return new Response(JSON.stringify({ error: "Invalid session secret" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })
  }

  const emitter = sessionManager.getEmitter(sessionId)
  if (!emitter) {
    return new Response(JSON.stringify({ error: "Session emitter not found" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Create SSE stream
  const encoder = new TextEncoder()
  let isClosed = false

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (isClosed) return
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(payload))
        } catch (error) {
          console.error("[SSE] Error encoding message:", error)
        }
      }

      // Handle session ready
      const onReady = () => {
        send("ready", { status: "connected" })
      }

      // Handle Gemini messages
      const onMessage = (msg: LiveServerMessage) => {
        const formatted = formatServerMessage(msg as ExtendedServerMessage)
        send("message", formatted)
      }

      // Handle errors
      const onError = (error: Error) => {
        send("error", { message: error.message })
      }

      // Handle session close
      const onClose = () => {
        if (!isClosed) {
          isClosed = true
          send("close", { reason: "Session closed" })
          cleanup()
          controller.close()
        }
      }

      // Cleanup function to remove listeners
      const cleanup = () => {
        emitter.off("ready", onReady)
        emitter.off("message", onMessage)
        emitter.off("error", onError)
        emitter.off("close", onClose)
      }

      // Register listeners
      emitter.on("ready", onReady)
      emitter.on("message", onMessage)
      emitter.on("error", onError)
      emitter.on("close", onClose)

      // Handle client disconnect via abort signal
      request.signal.addEventListener("abort", () => {
        console.log(`[SSE] Client disconnected for session ${sessionId}`)
        cleanup()
        if (!isClosed) {
          isClosed = true
          controller.close()
        }
        // Close server session to free resources
        sessionManager.closeSession(sessionId)
      })

      // Send initial connected event
      send("connected", { sessionId })

      // If session is already ready (onopen fired before SSE connected), send ready event now
      if (sessionManager.isSessionReady(sessionId)) {
        send("ready", { status: "connected" })
      }
    },
    cancel() {
      isClosed = true
      console.log(`[SSE] Stream cancelled for session ${sessionId}`)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  })
}
