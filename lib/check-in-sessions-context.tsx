"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { db, toCheckInSession } from "@/lib/storage/db"
import type { CheckInSession } from "@/lib/types"

interface CheckInSessionsContextValue {
  sessions: CheckInSession[]
  isLoading: boolean
}

const CheckInSessionsContext = createContext<CheckInSessionsContextValue | null>(null)

/**
 * Provider that preloads all check-in sessions at app startup.
 * This ensures the History page loads instantly since data is already cached.
 */
export function CheckInSessionsProvider({ children }: { children: ReactNode }) {
  const sessions = useLiveQuery(async () => {
    const results = await db.checkInSessions.orderBy("startedAt").reverse().toArray()
    return results.map(toCheckInSession)
  }, [])

  const value = useMemo<CheckInSessionsContextValue>(() => {
    return {
      sessions: sessions ?? [],
      isLoading: sessions === undefined,
    }
  }, [sessions])

  return (
    <CheckInSessionsContext.Provider value={value}>
      {children}
    </CheckInSessionsContext.Provider>
  )
}

/**
 * Hook to access preloaded check-in sessions from context.
 */
export function useCheckInSessionsContext(): CheckInSessionsContextValue {
  const context = useContext(CheckInSessionsContext)

  if (!context) {
    throw new Error("useCheckInSessionsContext must be used within CheckInSessionsProvider")
  }

  return context
}

/**
 * Optional variant for cases where the tree may render without the provider
 * (e.g., during route-level isolation or partial renders). Prefer
 * `useCheckInSessionsContext()` when you want to enforce the provider.
 */
export function useOptionalCheckInSessionsContext(): CheckInSessionsContextValue | null {
  return useContext(CheckInSessionsContext)
}

export function useCheckInSessionsFromContext(limit?: number): CheckInSession[] {
  const { sessions } = useCheckInSessionsContext()
  if (limit) {
    return sessions.slice(0, limit)
  }

  return sessions
}
