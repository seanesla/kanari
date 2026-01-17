/**
 * useHistory Hook
 *
 * Builds a unified timeline of AI chat sessions.
 */

import { useMemo } from "react"
import { useCheckInSessionsContext } from "@/lib/check-in-sessions-context"
import type { HistoryItem, AIChatHistoryItem } from "@/lib/types"

/**
 * Hook to fetch AI chat sessions into a unified, sorted history timeline.
 * Uses preloaded sessions from context for instant loading.
 *
 * @param limit - Optional: max number of items to return. If not provided, returns all items.
 * @returns History timeline + loading state
 */
export function useHistory(limit?: number): { items: HistoryItem[]; isLoading: boolean } {
  const { sessions, isLoading } = useCheckInSessionsContext()

  const limitedSessions = useMemo(() => {
    if (!limit) return sessions
    return sessions.slice(0, limit)
  }, [limit, sessions])

  const items = useMemo(() => {
    // Provider query already returns newest-first.
    const sessionItems: AIChatHistoryItem[] = limitedSessions.map((session) => ({
      id: session.id,
      type: "ai_chat",
      timestamp: session.startedAt,
      session,
    }))
    return sessionItems
  }, [limitedSessions])

  return { items, isLoading }
}
