/**
 * useHistory Hook
 *
 * Merges voice note recordings and AI chat sessions into a unified,
 * chronologically-sorted timeline. Identifies linked pairs where a
 * voice note triggered a follow-up AI chat conversation.
 *
 * This hook powers the unified History page by combining data from
 * two separate IndexedDB tables (recordings and checkInSessions).
 */

import { useMemo } from "react"
import { useRecordings, useCheckInSessions } from "./use-storage"
import type { HistoryItem, VoiceNoteHistoryItem, AIChatHistoryItem } from "@/lib/types"

/**
 * Hook to fetch and merge voice recordings and AI chat sessions
 * into a unified, sorted history timeline.
 *
 * @param limit - Optional: max number of items to return. If not provided, returns all items.
 * @returns Array of HistoryItems sorted chronologically (newest first)
 */
export function useHistory(limit?: number): HistoryItem[] {
  // Fetch both data sources from IndexedDB via their respective hooks
  const recordings = useRecordings()
  const sessions = useCheckInSessions()

  // Merge, sort, and return the unified timeline
  const historyItems = useMemo(() => {
    // STEP 1: Build a map of recordingId -> sessionId for quick lookup
    // This lets us identify which chat sessions were triggered by which voice notes
    const recordingToSession = new Map<string, string>()
    sessions.forEach((session) => {
      // CheckInSession has an optional recordingId that links back to a Recording
      if (session.recordingId) {
        recordingToSession.set(session.recordingId, session.id)
      }
    })

    // STEP 2: Convert recordings to HistoryItems
    // Each recording becomes a VoiceNoteHistoryItem with optional linkedChatSessionId
    const recordingItems: VoiceNoteHistoryItem[] = recordings.map((rec) => ({
      id: rec.id,
      type: "voice_note",
      timestamp: rec.createdAt, // Sort key
      recording: rec,
      // If a chat was triggered from this recording, store its ID for link display
      linkedChatSessionId: recordingToSession.get(rec.id),
    }))

    // STEP 3: Convert sessions to HistoryItems
    // Each session becomes an AIChatHistoryItem with optional linkedRecordingId
    const sessionItems: AIChatHistoryItem[] = sessions.map((session) => ({
      id: session.id,
      type: "ai_chat",
      timestamp: session.startedAt, // Sort key
      session,
      // The recordingId is already on the session, just pass it through
      linkedRecordingId: session.recordingId,
    }))

    // STEP 4: Combine all items and sort chronologically (newest first)
    // Both VoiceNoteHistoryItem and AIChatHistoryItem have a timestamp field
    const combined = [...recordingItems, ...sessionItems]
    combined.sort((a, b) => {
      // Convert ISO strings to timestamps and sort descending (newest first)
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })

    // STEP 5: Apply limit if provided (e.g., for pagination)
    return limit ? combined.slice(0, limit) : combined
  }, [recordings, sessions, limit])

  return historyItems
}
