/**
 * Context Fingerprint
 *
 * Computes a fingerprint from IndexedDB data to detect when the AI's
 * pre-loaded context has changed. Used by session preservation to
 * determine whether a preserved session should be invalidated.
 *
 * Changes that invalidate a session:
 * - New voice recording analyzed (changes stress/fatigue trends)
 * - New check-in session completed (changes pattern summaries)
 * - Deletions of either (detected via counts)
 */

import { db, toRecording, toCheckInSession } from "@/lib/storage/db"

export interface ContextFingerprintData {
  /** ID of most recent recording */
  latestRecordingId: string | null
  /** Timestamp of most recent recording */
  latestRecordingCreatedAt: string | null
  /** Total recording count (detects deletions) */
  recordingCount: number
  /** ID of most recent completed check-in session */
  latestCheckInSessionId: string | null
  /** End timestamp of most recent check-in session */
  latestCheckInEndedAt: string | null
  /** Total check-in session count (detects deletions) */
  checkInSessionCount: number
}

/**
 * Fetches the data used to compute the context fingerprint.
 * Exported for testing purposes.
 */
export async function getContextFingerprintData(): Promise<ContextFingerprintData> {
  // Get latest recording
  const recordings = await db.recordings
    .orderBy("createdAt")
    .reverse()
    .limit(1)
    .toArray()

  const latestRecording = recordings[0] ? toRecording(recordings[0]) : null
  const recordingCount = await db.recordings.count()

  // Get latest completed check-in session (has endedAt)
  // IMPORTANT: Do NOT load all sessions here.
  // Check-in sessions can be large (e.g., audio payloads). Pulling the entire table can
  // stall the UI during check-in initialization and make timers appear "stuck".
  // Pattern doc: docs/error-patterns/gemini-live-concurrent-connect-early-resolve.md
  const sessions = await db.checkInSessions
    .orderBy("startedAt")
    .reverse()
    .limit(5)
    .toArray()

  // Find the most recent completed session
  const latestCompletedSession = sessions.find((s) => s.endedAt != null)
  const latestSession = latestCompletedSession
    ? toCheckInSession(latestCompletedSession)
    : null

  const sessionCount = await db.checkInSessions.count()

  return {
    latestRecordingId: latestRecording?.id ?? null,
    latestRecordingCreatedAt: latestRecording?.createdAt ?? null,
    recordingCount,
    latestCheckInSessionId: latestSession?.id ?? null,
    latestCheckInEndedAt: latestSession?.endedAt ?? null,
    checkInSessionCount: sessionCount,
  }
}

/**
 * Computes a fingerprint string from context data.
 * Same data produces same fingerprint.
 */
export function computeFingerprintFromData(data: ContextFingerprintData): string {
  return JSON.stringify(data)
}

/**
 * Computes the current context fingerprint from IndexedDB.
 * Main entry point for fingerprint computation.
 */
export async function computeContextFingerprint(): Promise<string> {
  const data = await getContextFingerprintData()
  return computeFingerprintFromData(data)
}
