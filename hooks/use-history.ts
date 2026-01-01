/**
 * useHistory Hook
 *
 * Builds a unified, chronologically-sorted timeline of AI chat sessions.
 */

import { useMemo } from "react"
import { useCheckInSessions } from "./use-storage"
import type { HistoryItem, AIChatHistoryItem } from "@/lib/types"

/**
 * Hook to fetch AI chat sessions into a unified, sorted history timeline.
 *
 * @param limit - Optional: max number of items to return. If not provided, returns all items.
 * @returns Array of HistoryItems sorted chronologically (newest first)
 */
export function useHistory(limit?: number): HistoryItem[] {
  // Fetch sessions from IndexedDB
  const sessions = useCheckInSessions(limit)

  // Merge, sort, and return the unified timeline
  const historyItems = useMemo(() => {
    // Convert sessions to HistoryItems
    const sessionItems: AIChatHistoryItem[] = sessions.map((session) => ({
      id: session.id,
      type: "ai_chat",
      timestamp: session.startedAt, // Sort key
      session,
    }))

    // Sort chronologically (newest first)
    const combined = [...sessionItems]
    combined.sort((a, b) => {
      // Convert ISO strings to timestamps and sort descending (newest first)
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })

    return combined
  }, [sessions])

  return historyItems
}
