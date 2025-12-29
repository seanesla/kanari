// Google OAuth 2.0 utilities for Calendar API access
// Uses PKCE (Proof Key for Code Exchange) for enhanced security

const OAUTH_ENDPOINTS = {
  authorize: "https://accounts.google.com/o/oauth2/v2/auth",
  token: "https://oauth2.googleapis.com/token",
  revoke: "https://oauth2.googleapis.com/revoke",
}

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
]

export interface OAuthTokens {
  access_token: string
  refresh_token?: string
  expires_at: number // Unix timestamp
  token_type: string
  scope: string
}

export interface OAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

// ============================================
// PKCE Helpers
// ============================================

/**
 * Generate a cryptographically random code verifier for PKCE
 */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return base64URLEncode(array)
}

/**
 * Generate code challenge from verifier using SHA-256
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return base64URLEncode(new Uint8Array(hash))
}

/**
 * Base64-URL encode (RFC 4648 §5)
 */
function base64URLEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer))
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

/**
 * Generate a random state parameter for CSRF protection
 */
function generateState(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return base64URLEncode(array)
}

// ============================================
// OAuth Flow Functions
// ============================================

/**
 * Generate authorization URL with PKCE
 * Store the verifier and state in sessionStorage for callback verification
 */
export async function generateAuthUrl(config: OAuthConfig): Promise<string> {
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  const state = generateState()

  // Store verifier and state for callback
  if (typeof window !== "undefined") {
    sessionStorage.setItem("oauth_code_verifier", codeVerifier)
    sessionStorage.setItem("oauth_state", state)
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    access_type: "offline", // Request refresh token
    prompt: "consent", // Force consent screen to ensure refresh token
  })

  return `${OAUTH_ENDPOINTS.authorize}?${params.toString()}`
}

/**
 * Exchange authorization code for access and refresh tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  config: OAuthConfig
): Promise<OAuthTokens> {
  const codeVerifier = typeof window !== "undefined"
    ? sessionStorage.getItem("oauth_code_verifier")
    : null

  if (!codeVerifier) {
    throw new Error("Code verifier not found. OAuth flow may have been tampered with.")
  }

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    code_verifier: codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
  })

  const response = await fetch(OAUTH_ENDPOINTS.token, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Token exchange failed: ${error.error_description || error.error}`)
  }

  const data = await response.json()

  // Clean up stored verifier
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("oauth_code_verifier")
    sessionStorage.removeItem("oauth_state")
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    token_type: data.token_type,
    scope: data.scope,
  }
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(
  refreshToken: string,
  config: OAuthConfig
): Promise<OAuthTokens> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  })

  const response = await fetch(OAUTH_ENDPOINTS.token, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Token refresh failed: ${error.error_description || error.error}`)
  }

  const data = await response.json()

  return {
    access_token: data.access_token,
    refresh_token: refreshToken, // Keep existing refresh token
    expires_at: Date.now() + data.expires_in * 1000,
    token_type: data.token_type,
    scope: data.scope,
  }
}

/**
 * Revoke OAuth tokens (for disconnect/logout)
 */
export async function revokeToken(token: string): Promise<void> {
  const body = new URLSearchParams({
    token,
  })

  const response = await fetch(OAUTH_ENDPOINTS.revoke, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  })

  if (!response.ok) {
    throw new Error("Token revocation failed")
  }
}

/**
 * Verify state parameter to prevent CSRF attacks
 */
export function verifyState(receivedState: string): boolean {
  if (typeof window === "undefined") return false

  const storedState = sessionStorage.getItem("oauth_state")
  return storedState === receivedState
}

/**
 * Check if tokens are expired or will expire soon (within 5 minutes)
 */
export function isTokenExpired(tokens: OAuthTokens): boolean {
  const fiveMinutes = 5 * 60 * 1000
  return tokens.expires_at - Date.now() < fiveMinutes
}

// ============================================
// Token Storage (localStorage with optional encryption)
// ============================================

const STORAGE_KEY = "kanari_calendar_tokens"

/**
 * Store tokens in localStorage
 * TODO: Add encryption using Web Crypto API (AES-GCM)
 */
export function storeTokens(tokens: OAuthTokens): void {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
  } catch (error) {
    console.error("Failed to store tokens:", error)
  }
}

/**
 * Retrieve tokens from localStorage
 */
export function getStoredTokens(): OAuthTokens | null {
  if (typeof window === "undefined") return null

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null

    return JSON.parse(stored)
  } catch (error) {
    console.error("Failed to retrieve tokens:", error)
    return null
  }
}

/**
 * Remove tokens from localStorage
 */
export function clearStoredTokens(): void {
  if (typeof window === "undefined") return

  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error("Failed to clear tokens:", error)
  }
}
