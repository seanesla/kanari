import { NextResponse } from "next/server"
import { getTokensFromCookies, clearTokenCookies, isTokenExpired, updateAccessToken } from "@/lib/auth/session"
import { refreshAccessToken, revokeToken } from "@/lib/calendar/oauth"

/**
 * GET /api/auth/session
 * Check if user is authenticated and get session info
 */
export async function GET() {
  try {
    const tokens = await getTokensFromCookies()

    if (!tokens) {
      return NextResponse.json({
        authenticated: false,
      })
    }

    // Check if token is expired
    if (isTokenExpired(tokens.expires_at)) {
      // Try to refresh if we have a refresh token
      if (tokens.refresh_token) {
        try {
          const clientId = process.env.GOOGLE_CLIENT_ID
          const clientSecret = process.env.GOOGLE_CLIENT_SECRET
          const redirectUri = process.env.GOOGLE_REDIRECT_URI

          if (!clientId || !clientSecret || !redirectUri) {
            throw new Error("OAuth configuration missing")
          }

          const config = { clientId, clientSecret, redirectUri }
          const newTokens = await refreshAccessToken(tokens.refresh_token, config)

          // Update the access token cookie
          await updateAccessToken(newTokens.access_token, newTokens.expires_at)

          return NextResponse.json({
            authenticated: true,
            expiresAt: newTokens.expires_at,
          })
        } catch (refreshError) {
          console.error("Failed to refresh token:", refreshError)
          // Clear cookies if refresh fails
          await clearTokenCookies()
          return NextResponse.json({
            authenticated: false,
            error: "Token expired and refresh failed",
          })
        }
      } else {
        // No refresh token, clear session
        await clearTokenCookies()
        return NextResponse.json({
          authenticated: false,
          error: "Token expired",
        })
      }
    }

    return NextResponse.json({
      authenticated: true,
      expiresAt: tokens.expires_at,
    })
  } catch (error) {
    console.error("Session check error:", error)
    return NextResponse.json(
      { authenticated: false, error: "Internal error" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/auth/session
 * Logout - clear session cookies
 */
export async function DELETE() {
  try {
    try {
      const tokens = await getTokensFromCookies()
      if (tokens?.access_token) {
        await revokeToken(tokens.access_token)
      }
    } catch (revokeError) {
      // Best-effort revoke. Cookie clearing is the source of truth for logout.
      console.error("Failed to revoke token:", revokeError)
    }

    await clearTokenCookies()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Logout error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to logout" },
      { status: 500 }
    )
  }
}
