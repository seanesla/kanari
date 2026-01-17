"use client"

import { useEffect, type ReactNode } from "react"
import { CheckInSessionsProvider } from "@/lib/check-in-sessions-context"
import { db } from "@/lib/storage/db"
import { logWarn } from "@/lib/logger"

/**
 * Central place to kick off client-side data loads as soon as the app mounts.
 *
 * Primary goal: preload check-in sessions at app startup so the History page
 * can render instantly without waiting on IndexedDB.
 */
export function DataPreloader({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Warm up IndexedDB early (best-effort). Dexie will also open on first query,
    // but doing it here reduces perceived latency when navigating later.
    db.open().catch((error) => {
      logWarn("DataPreloader", "Failed to open IndexedDB", error)
    })
  }, [])

  return <CheckInSessionsProvider>{children}</CheckInSessionsProvider>
}
