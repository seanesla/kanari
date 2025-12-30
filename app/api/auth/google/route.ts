// OAuth initiation endpoint
// Generates authorization URL and redirects user to Google's consent screen

import { NextRequest, NextResponse } from "next/server"
import { generateAuthUrl } from "@/lib/calendar/oauth"

export const runtime = "edge" // Optional: use edge runtime for faster response

const OAUTH_STATE_COOKIE = "kanari_oauth_state"
const OAUTH_CODE_VERIFIER_COOKIE = "kanari_oauth_code_verifier"

const OAUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 10 * 60, // 10 minutes (short-lived, only for completing the OAuth redirect)
}

export async function GET(request: NextRequest) {
  try {
    // Get OAuth config from environment variables
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_REDIRECT_URI

    // Validate environment variables
    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json(
        {
          error: "OAuth configuration missing",
          details: "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI must be set",
        },
        { status: 500 }
      )
    }

    // Generate authorization URL with PKCE
    const { url: authUrl, state, codeVerifier } = await generateAuthUrl({
      clientId,
      clientSecret,
      redirectUri,
    })

    // Store PKCE verifier + CSRF state in short-lived httpOnly cookies for server-side callback.
    // See: docs/error-patterns/oauth-pkce-state-server-storage.md
    const response = NextResponse.json({ authUrl })
    response.cookies.set(OAUTH_STATE_COOKIE, state, OAUTH_COOKIE_OPTIONS)
    response.cookies.set(OAUTH_CODE_VERIFIER_COOKIE, codeVerifier, OAUTH_COOKIE_OPTIONS)

    // Return the URL for client-side redirect
    // Alternatively, could redirect server-side:
    // return NextResponse.redirect(authUrl)
    return response
  } catch (error) {
    console.error("OAuth initiation error:", error)

    return NextResponse.json(
      {
        error: "Failed to initiate OAuth flow",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
