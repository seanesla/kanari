// OAuth callback handler
// Exchanges authorization code for tokens and stores them securely

import { NextRequest, NextResponse } from "next/server"
import { exchangeCodeForTokens } from "@/lib/calendar/oauth"
import { setTokenCookies } from "@/lib/auth/session"
import { cookies } from "next/headers"

// Note: Removed edge runtime to use cookies() which requires Node.js runtime

const OAUTH_STATE_COOKIE = "kanari_oauth_state"
const OAUTH_CODE_VERIFIER_COOKIE = "kanari_oauth_code_verifier"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get("code")
    const state = searchParams.get("state")
    const error = searchParams.get("error")

    const cookieStore = await cookies()
    const storedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value
    const codeVerifier = cookieStore.get(OAUTH_CODE_VERIFIER_COOKIE)?.value

    // Always clear short-lived OAuth cookies on callback (success or failure).
    cookieStore.delete(OAUTH_STATE_COOKIE)
    cookieStore.delete(OAUTH_CODE_VERIFIER_COOKIE)

    // Handle OAuth errors (e.g., user denied access)
    if (error) {
      console.error("OAuth error:", error)

      // Redirect to settings with error message
      const redirectUrl = new URL("/dashboard/settings", request.url)
      redirectUrl.searchParams.set("error", "oauth_failed")

      return NextResponse.redirect(redirectUrl)
    }

    // Validate required parameters
    if (!code || !state) {
      const redirectUrl = new URL("/dashboard/settings", request.url)
      redirectUrl.searchParams.set("error", "invalid_callback")

      return NextResponse.redirect(redirectUrl)
    }

    // CSRF protection: verify state matches cookie set during initiation.
    // See: docs/error-patterns/oauth-pkce-state-server-storage.md
    if (!storedState || state !== storedState) {
      const redirectUrl = new URL("/dashboard/settings", request.url)
      redirectUrl.searchParams.set("error", "state_mismatch")
      return NextResponse.redirect(redirectUrl)
    }

    // PKCE protection: require the code_verifier that matches the code_challenge.
    if (!codeVerifier) {
      const redirectUrl = new URL("/dashboard/settings", request.url)
      redirectUrl.searchParams.set("error", "missing_verifier")
      return NextResponse.redirect(redirectUrl)
    }

    // Get OAuth config from environment variables
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirectUri = process.env.GOOGLE_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error("OAuth configuration missing")
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(
      code,
      { clientId, clientSecret, redirectUri },
      codeVerifier
    )

    // Store tokens in secure HTTP-only cookies
    await setTokenCookies(tokens)

    const redirectUrl = new URL("/dashboard/settings", request.url)
    redirectUrl.searchParams.set("calendar_connected", "true")

    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error("OAuth callback error:", error)

    const redirectUrl = new URL("/dashboard/settings", request.url)
    redirectUrl.searchParams.set("error", "token_exchange_failed")

    return NextResponse.redirect(redirectUrl)
  }
}
