/**
 * useHistory Hook
 *
 * Builds a unified timeline of AI chat sessions.
 */

import { useMemo } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { useOptionalCheckInSessionsContext } from "@/lib/check-in-sessions-context"
import { db, toCheckInSession } from "@/lib/storage/db"
import type { HistoryItem, AIChatHistoryItem } from "@/lib/types"

/**
 * Hook to fetch AI chat sessions into a unified, sorted history timeline.
 * Uses preloaded sessions from context for instant loading.
 *
 * @param limit - Optional: max number of items to return. If not provided, returns all items.
 * @returns History timeline + loading state
 */
export function useHistory(limit?: number): { items: HistoryItem[]; isLoading: boolean } {
  const context = useOptionalCheckInSessionsContext()
  const shouldUseFallback = !context

  const fallbackSessions = useLiveQuery(async () => {
    if (!shouldUseFallback) return null
    const results = await db.checkInSessions.orderBy("startedAt").reverse().toArray()
    return results.map(toCheckInSession)
  }, [shouldUseFallback])

  const sessions = context?.sessions ?? fallbackSessions ?? []
  const isLoading = context ? context.isLoading : fallbackSessions === undefined

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
