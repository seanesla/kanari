import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, getClientIp } from "@/lib/server/rate-limit"

const GEMINI_KEY_SOURCE_HEADER = "X-Kanari-Gemini-Key-Source"

// Shared (Kanari) key limits.
// These are app-level limits to reduce accidental abuse of a shared key.
// Gemini's own per-key quotas and RPM limits still apply.
const KANARI_KEY_WINDOW_MS = 10 * 60 * 1000
const KANARI_KEY_LIMIT = 40

export function maybeRateLimitKanariGeminiKey(
  request: NextRequest,
  bucket: string
): NextResponse | null {
  const source = request.headers.get(GEMINI_KEY_SOURCE_HEADER)
  if (source !== "kanari") return null

  const ip = getClientIp(request)
  const decision = checkRateLimit({
    key: `gemini:${bucket}:${ip}`,
    limit: KANARI_KEY_LIMIT,
    windowMs: KANARI_KEY_WINDOW_MS,
  })

  if (decision.allowed) return null

  const retryAfterSeconds = Math.max(1, Math.ceil((decision.resetAtMs - Date.now()) / 1000))

  return NextResponse.json(
    { error: "Rate limit exceeded. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    }
  )
}
