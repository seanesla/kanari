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
// Token Storage (localStorage with AES-GCM encryption)
// ============================================

const STORAGE_KEY = "kanari_calendar_tokens"
const KEY_DB_NAME = "kanari_crypto"
const KEY_STORE_NAME = "keys"
const ENCRYPTION_KEY_ID = "token_encryption_key"

/**
 * Open IndexedDB for key storage
 */
function openKeyDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(KEY_DB_NAME, 1)

    request.onerror = () => reject(new Error("Failed to open key database"))

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(KEY_STORE_NAME)) {
        db.createObjectStore(KEY_STORE_NAME, { keyPath: "id" })
      }
    }

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result)
    }
  })
}

/**
 * Get or create AES-GCM encryption key
 * Key is stored in IndexedDB (CryptoKey can't be JSON serialized)
 */
async function getOrCreateEncryptionKey(): Promise<CryptoKey> {
  const db = await openKeyDatabase()

  // Try to get existing key
  const existingKey = await new Promise<CryptoKey | null>((resolve, reject) => {
    const tx = db.transaction(KEY_STORE_NAME, "readonly")
    const store = tx.objectStore(KEY_STORE_NAME)
    const request = store.get(ENCRYPTION_KEY_ID)

    request.onerror = () => reject(new Error("Failed to retrieve key"))
    request.onsuccess = () => {
      const result = request.result
      resolve(result ? result.key : null)
    }
  })

  if (existingKey) {
    db.close()
    return existingKey
  }

  // Generate new key
  const newKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false, // Not extractable for security
    ["encrypt", "decrypt"]
  )

  // Store the key
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(KEY_STORE_NAME, "readwrite")
    const store = tx.objectStore(KEY_STORE_NAME)
    const request = store.put({ id: ENCRYPTION_KEY_ID, key: newKey })

    request.onerror = () => reject(new Error("Failed to store key"))
    request.onsuccess = () => resolve()
  })

  db.close()
  return newKey
}

/**
 * Encrypt tokens using AES-GCM
 */
async function encryptTokens(tokens: OAuthTokens): Promise<string> {
  const key = await getOrCreateEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(tokens))

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  )

  // Combine IV + ciphertext and base64 encode
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(ciphertext), iv.length)

  return btoa(String.fromCharCode(...combined))
}

/**
 * Decrypt tokens using AES-GCM
 */
async function decryptTokens(encrypted: string): Promise<OAuthTokens> {
  const key = await getOrCreateEncryptionKey()

  // Decode base64 and split IV + ciphertext
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  )

  return JSON.parse(new TextDecoder().decode(decrypted))
}

/**
 * Check if stored data is encrypted (base64) or plain JSON
 */
function isEncrypted(data: string): boolean {
  try {
    JSON.parse(data)
    return false // Valid JSON = not encrypted
  } catch {
    return true // Not valid JSON = likely encrypted
  }
}

/**
 * Store tokens in localStorage with AES-GCM encryption
 */
export async function storeTokens(tokens: OAuthTokens): Promise<void> {
  if (typeof window === "undefined") return

  try {
    const encrypted = await encryptTokens(tokens)
    localStorage.setItem(STORAGE_KEY, encrypted)
  } catch (error) {
    console.error("Failed to store tokens:", error)
  }
}

/**
 * Retrieve tokens from localStorage with decryption
 * Handles migration from unencrypted to encrypted storage
 */
export async function getStoredTokens(): Promise<OAuthTokens | null> {
  if (typeof window === "undefined") return null

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null

    // Handle migration: if plain JSON, decrypt fails, re-encrypt
    if (!isEncrypted(stored)) {
      // Legacy unencrypted data - migrate to encrypted
      const tokens = JSON.parse(stored) as OAuthTokens
      await storeTokens(tokens) // Re-store encrypted
      return tokens
    }

    return await decryptTokens(stored)
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
