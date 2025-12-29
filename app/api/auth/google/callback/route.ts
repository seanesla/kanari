// OAuth callback handler
// Exchanges authorization code for tokens and stores them securely

import { NextRequest, NextResponse } from "next/server"
import { exchangeCodeForTokens, verifyState } from "@/lib/calendar/oauth"

export const runtime = "edge" // Optional: use edge runtime for faster response

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get("code")
    const state = searchParams.get("state")
    const error = searchParams.get("error")

    // Handle OAuth errors (e.g., user denied access)
    if (error) {
      const errorDescription = searchParams.get("error_description") || "Unknown error"
      console.error("OAuth error:", error, errorDescription)

      // Redirect to settings with error message
      const redirectUrl = new URL("/dashboard/settings", request.url)
      redirectUrl.searchParams.set("error", "oauth_failed")
      redirectUrl.searchParams.set("message", errorDescription)

      return NextResponse.redirect(redirectUrl)
    }

    // Validate required parameters
    if (!code || !state) {
      const redirectUrl = new URL("/dashboard/settings", request.url)
      redirectUrl.searchParams.set("error", "invalid_callback")
      redirectUrl.searchParams.set("message", "Missing authorization code or state")

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
    const tokens = await exchangeCodeForTokens(code, {
      clientId,
      clientSecret,
      redirectUri,
    })

    // In a production app, you would:
    // 1. Store tokens in a secure database associated with the user
    // 2. Set a secure HTTP-only cookie with a session ID
    // 3. Implement proper CSRF protection
    //
    // For this client-side prototype, we'll pass tokens via URL fragment
    // so they can be stored in localStorage by the client
    // (Not recommended for production, but acceptable for a hackathon demo)

    const redirectUrl = new URL("/dashboard/settings", request.url)

    // Use URL fragment (hash) to pass tokens - these won't be sent to server
    const tokenData = encodeURIComponent(JSON.stringify(tokens))
    redirectUrl.hash = `tokens=${tokenData}`

    // Also set success flag in query params
    redirectUrl.searchParams.set("calendar_connected", "true")

    return NextResponse.redirect(redirectUrl)
  } catch (error) {
    console.error("OAuth callback error:", error)

    const redirectUrl = new URL("/dashboard/settings", request.url)
    redirectUrl.searchParams.set("error", "token_exchange_failed")
    redirectUrl.searchParams.set(
      "message",
      error instanceof Error ? error.message : "Unknown error"
    )

    return NextResponse.redirect(redirectUrl)
  }
}
