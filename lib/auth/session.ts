import { cookies } from "next/headers"
import type { OAuthTokens } from "@/lib/calendar/oauth"

const ACCESS_TOKEN_COOKIE = "google_access_token"
const REFRESH_TOKEN_COOKIE = "google_refresh_token"
const EXPIRY_COOKIE = "google_token_expiry"

// Cookie settings for security
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
}

/**
 * Set OAuth tokens as HTTP-only cookies
 */
export async function setTokenCookies(tokens: OAuthTokens): Promise<void> {
  const cookieStore = await cookies()

  // Set access token (short-lived)
  cookieStore.set(ACCESS_TOKEN_COOKIE, tokens.access_token, {
    ...COOKIE_OPTIONS,
    maxAge: 60 * 60, // 1 hour
  })

  // Set refresh token (long-lived)
  if (tokens.refresh_token) {
    cookieStore.set(REFRESH_TOKEN_COOKIE, tokens.refresh_token, {
      ...COOKIE_OPTIONS,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
  }

  // Set expiry timestamp
  if (tokens.expires_at) {
    cookieStore.set(EXPIRY_COOKIE, tokens.expires_at.toString(), {
      ...COOKIE_OPTIONS,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
  }
}

/**
 * Get OAuth tokens from cookies
 */
export async function getTokensFromCookies(): Promise<OAuthTokens | null> {
  const cookieStore = await cookies()

  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value
  const expiresAtStr = cookieStore.get(EXPIRY_COOKIE)?.value

  if (!accessToken) {
    return null
  }

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAtStr ? parseInt(expiresAtStr, 10) : Date.now(),
    token_type: "Bearer",
    scope: "",
  }
}

/**
 * Clear all OAuth cookies (logout)
 */
export async function clearTokenCookies(): Promise<void> {
  const cookieStore = await cookies()

  cookieStore.delete(ACCESS_TOKEN_COOKIE)
  cookieStore.delete(REFRESH_TOKEN_COOKIE)
  cookieStore.delete(EXPIRY_COOKIE)
}

/**
 * Check if tokens are expired or will expire soon
 */
export function isTokenExpired(expires_at?: number, bufferSeconds = 300): boolean {
  if (!expires_at) return true

  const now = Date.now()
  const expiryWithBuffer = expires_at - bufferSeconds * 1000

  return now >= expiryWithBuffer
}

/**
 * Update access token after refresh
 */
export async function updateAccessToken(access_token: string, expires_at?: number): Promise<void> {
  const cookieStore = await cookies()

  cookieStore.set(ACCESS_TOKEN_COOKIE, access_token, {
    ...COOKIE_OPTIONS,
    maxAge: 60 * 60, // 1 hour
  })

  if (expires_at) {
    cookieStore.set(EXPIRY_COOKIE, expires_at.toString(), {
      ...COOKIE_OPTIONS,
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
  }
}
