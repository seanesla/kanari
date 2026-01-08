import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getTokensFromCookies, isTokenExpired, updateAccessToken } from "@/lib/auth/session"
import { refreshAccessToken } from "@/lib/calendar/oauth"
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/calendar/api"
import { normalizeTimeZone } from "@/lib/timezone"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SuggestionSchema = z.object({
  id: z.string().min(1).max(200),
  content: z.string().min(1).max(1000),
  rationale: z.string().max(5000).optional(),
  duration: z.number().int().min(1).max(12 * 60),
  category: z.enum(["break", "exercise", "mindfulness", "social", "rest"]),
  scheduledFor: z.string().datetime(),
})

const CreateEventRequestSchema = z.object({
  suggestion: SuggestionSchema,
  timeZone: z.string().min(1).max(64).optional(),
})

const DeleteEventRequestSchema = z.object({
  eventId: z.string().min(1).max(500),
})

async function getValidTokens() {
  const tokens = await getTokensFromCookies()
  if (!tokens) return null

  if (!isTokenExpired(tokens.expires_at)) {
    return tokens
  }

  if (!tokens.refresh_token) return null

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("OAuth configuration missing")
  }

  const refreshed = await refreshAccessToken(tokens.refresh_token, {
    clientId,
    clientSecret,
    redirectUri,
  })

  await updateAccessToken(refreshed.access_token, refreshed.expires_at)

  return {
    ...tokens,
    access_token: refreshed.access_token,
    expires_at: refreshed.expires_at,
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentLength = request.headers.get("content-length")
    if (contentLength && Number(contentLength) > 200_000) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 })
    }

    const tokens = await getValidTokens()
    if (!tokens) {
      return NextResponse.json({ error: "Not connected to calendar" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = CreateEventRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { suggestion } = parsed.data
    const timeZone = parsed.data.timeZone ? normalizeTimeZone(parsed.data.timeZone) : undefined

    const start = new Date(suggestion.scheduledFor)
    const end = new Date(start.getTime() + suggestion.duration * 60 * 1000)

    // Keep title concise for calendar UI.
    const summary = suggestion.content.length > 120
      ? `${suggestion.content.slice(0, 117)}...`
      : suggestion.content

    const description = suggestion.rationale
      ? `Kanari recovery suggestion\n\nWhy: ${suggestion.rationale}`
      : "Kanari recovery suggestion"

    const event = await createCalendarEvent(
      {
        summary,
        description,
        start: start.toISOString(),
        end: end.toISOString(),
        timeZone,
      },
      tokens
    )

    return NextResponse.json({
      recoveryBlock: {
        id: `rb_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        suggestionId: suggestion.id,
        calendarEventId: event.id,
        scheduledAt: start.toISOString(),
        duration: suggestion.duration,
        completed: false,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const contentLength = request.headers.get("content-length")
    if (contentLength && Number(contentLength) > 50_000) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 })
    }

    const tokens = await getValidTokens()
    if (!tokens) {
      return NextResponse.json({ error: "Not connected to calendar" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = DeleteEventRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 400 }
      )
    }

    await deleteCalendarEvent(parsed.data.eventId, tokens)

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
