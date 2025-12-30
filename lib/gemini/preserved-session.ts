/**
 * Preserved Session Store
 *
 * Client-side module-level singleton that holds preserved AI Talk session state.
 * Survives React component unmount/remount cycles to allow session reuse
 * and save API tokens.
 *
 * This is DIFFERENT from session-manager.ts which manages server-side sessions.
 * This file manages client-side preservation of the GeminiLiveClient instance.
 *
 * Usage:
 * 1. When user leaves AI Talk: preserveSession() saves client + state
 * 2. When user returns: hasPreservedSession() + getPreservedSession() checks for resumable session
 * 3. When context changes: clearPreservedSession() invalidates the session
 * 4. When Gemini disconnects while preserved: markSessionInvalid() flags for cleanup
 */

import type { GeminiLiveClient } from "./live-client"
import type { CheckInData } from "@/hooks/use-check-in"
import { logDebug } from "@/lib/logger"

/**
 * Shape of a preserved session.
 */
export interface PreservedSession {
  /** The Gemini Live client instance (still connected) */
  client: GeminiLiveClient
  /** Snapshot of CheckInData reducer state */
  checkInData: CheckInData
  /** Context fingerprint at time of preservation */
  contextFingerprint: string
  /** Timestamp when session was preserved */
  preservedAt: number
  /** Whether the session is still valid (false if Gemini disconnected) */
  isValid: boolean
}

// Module-level singleton state
let preservedSession: PreservedSession | null = null

/**
 * Check if there's a preserved session available.
 */
export function hasPreservedSession(): boolean {
  return preservedSession !== null && preservedSession.isValid
}

/**
 * Get the preserved session data.
 * Returns null if no valid preserved session exists.
 */
export function getPreservedSession(): PreservedSession | null {
  if (!preservedSession || !preservedSession.isValid) {
    return null
  }
  return preservedSession
}

/**
 * Get just the context fingerprint from preserved session.
 * Returns null if no preserved session exists.
 */
export function getPreservedFingerprint(): string | null {
  return preservedSession?.contextFingerprint ?? null
}

/**
 * Preserve the current session when user navigates away.
 *
 * @param client - The Gemini Live client (should still be connected)
 * @param checkInData - Snapshot of the current reducer state
 * @param contextFingerprint - Fingerprint computed when session started
 */
export function preserveSession(
  client: GeminiLiveClient,
  checkInData: CheckInData,
  contextFingerprint: string
): void {
  // Clear any existing preserved session first
  if (preservedSession) {
    logDebug(
      "PreservedSession",
      "Replacing existing preserved session"
    )
  }

  preservedSession = {
    client,
    checkInData,
    contextFingerprint,
    preservedAt: Date.now(),
    isValid: true,
  }

  logDebug(
    "PreservedSession",
    "Session preserved",
    { fingerprint: contextFingerprint.substring(0, 50) + "..." }
  )
}

/**
 * Clear the preserved session.
 * Called when:
 * - User explicitly ends the call
 * - Context fingerprint has changed (need fresh session)
 * - Session is consumed (after successful resume)
 *
 * @param disconnect - If true, also disconnect the Gemini client
 */
export function clearPreservedSession(disconnect = true): void {
  if (!preservedSession) {
    return
  }

  if (disconnect && preservedSession.isValid) {
    try {
      preservedSession.client.disconnect()
    } catch {
      // Ignore disconnect errors during cleanup
    }
  }

  logDebug("PreservedSession", "Preserved session cleared")
  preservedSession = null
}

/**
 * Mark the preserved session as invalid.
 * Called when Gemini connection dies while session is preserved.
 * The session data is kept (for logging/debugging) but won't be resumed.
 */
export function markSessionInvalid(): void {
  if (preservedSession) {
    preservedSession.isValid = false
    logDebug("PreservedSession", "Preserved session marked invalid")
  }
}

/**
 * Consume the preserved session (take ownership of client).
 * After calling this, the caller owns the client and is responsible for cleanup.
 * Returns null if no valid session exists.
 */
export function consumePreservedSession(): PreservedSession | null {
  if (!preservedSession || !preservedSession.isValid) {
    return null
  }

  const session = preservedSession
  preservedSession = null // Clear without disconnecting - caller now owns client

  logDebug("PreservedSession", "Preserved session consumed")
  return session
}
