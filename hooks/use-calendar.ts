"use client"

// React hook for calendar operations
// Manages OAuth flow, token refresh, and calendar event creation

import { useState, useEffect, useCallback, useRef } from "react"
import type { Suggestion, RecoveryBlock } from "@/lib/types"

export interface CalendarEventOptions {
  timeZone?: string
}

export interface UseCalendarReturn {
  // Connection status
  isConnected: boolean
  isLoading: boolean
  error: string | null

  // Actions
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  scheduleEvent: (suggestion: Suggestion, options?: CalendarEventOptions) => Promise<RecoveryBlock | null>
  deleteEvent: (eventId: string) => Promise<void>
  clearError: () => void

  // Token management
  refreshTokens: () => Promise<boolean>
}

interface SessionResponse {
  authenticated: boolean
  expiresAt?: number
  error?: string
}

function getApiUrl(path: string): string {
  if (typeof window === "undefined") return path
  try {
    return new URL(path, window.location.origin).toString()
  } catch {
    return path
  }
}

export function useCalendar(): UseCalendarReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true) // Start loading until session check completes
  const [error, setError] = useState<string | null>(null)
  const sessionCheckRef = useRef(false)

  // Check session status on mount
  useEffect(() => {
    // Prevent double-checking in StrictMode
    if (sessionCheckRef.current) return
    sessionCheckRef.current = true

    const checkSession = async () => {
      try {
        const response = await fetch(getApiUrl("/api/auth/session"))
        const data: SessionResponse = await response.json()

        if (data.authenticated) {
          setIsConnected(true)
        } else {
          setIsConnected(false)
        }
      } catch (err) {
        console.error("Failed to check session:", err)
        setIsConnected(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkSession()

    // Also check for successful OAuth redirect (calendar_connected query param)
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get("calendar_connected") === "true") {
      // Clear the query param
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete("calendar_connected")
      window.history.replaceState({}, "", newUrl.toString())
      // Trigger re-check of session
      checkSession()
    }
  }, [])

  // Refresh tokens via session API
  const refreshTokens = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(getApiUrl("/api/auth/session"))
      const data: SessionResponse = await response.json()

      if (data.authenticated) {
        setError(null)
        setIsConnected(true)
        return true
      } else {
        setError(data.error || "Failed to refresh token")
        setIsConnected(false)
        return false
      }
    } catch (err) {
      setError("Failed to refresh access token")
      setIsConnected(false)
      return false
    }
  }, [])

  // Connect to Google Calendar
  const connect = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Call our API route to get the authorization URL
      const response = await fetch(getApiUrl("/api/auth/google"))

      if (!response.ok) {
        throw new Error("Failed to initiate OAuth flow")
      }

      const { authUrl } = await response.json()

      // Redirect to Google's consent screen
      window.location.href = authUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect calendar")
      setIsLoading(false)
    }
  }, [])

  // Disconnect from Google Calendar
  const disconnect = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Clear session cookies via API
      await fetch(getApiUrl("/api/auth/session"), { method: "DELETE" })

      setIsConnected(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect calendar")
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Schedule a recovery event
  const scheduleEvent = useCallback(
    async (suggestion: Suggestion, options?: CalendarEventOptions): Promise<RecoveryBlock | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const connected = isConnected || (await refreshTokens())
        if (!connected) throw new Error("Not connected to calendar")

        const response = await fetch(getApiUrl("/api/calendar/event"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestion, timeZone: options?.timeZone }),
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || "Failed to schedule recovery block")
        }

        return (data.recoveryBlock as RecoveryBlock) || null
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to schedule event")
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [isConnected, refreshTokens]
  )

  // Delete a calendar event
  const deleteEvent = useCallback(
    async (eventId: string) => {
      setIsLoading(true)
      setError(null)

      try {
        const connected = isConnected || (await refreshTokens())
        if (!connected) throw new Error("Not connected to calendar")

        const response = await fetch(getApiUrl("/api/calendar/event"), {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to delete event")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete event")
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [isConnected, refreshTokens]
  )

  // Clear error state
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    isConnected,
    isLoading,
    error,
    connect,
    disconnect,
    scheduleEvent,
    deleteEvent,
    clearError,
    refreshTokens,
  }
}
