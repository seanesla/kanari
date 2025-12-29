"use client"

// React hook for calendar operations
// Manages OAuth flow, token refresh, and calendar event creation

import { useState, useEffect, useCallback, useRef } from "react"
import type { Suggestion, RecoveryBlock, UserSettings } from "@/lib/types"
import type { OAuthTokens } from "@/lib/calendar/oauth"
import { revokeToken } from "@/lib/calendar/oauth"
import { scheduleRecoveryBlock } from "@/lib/calendar/scheduler"
import { deleteCalendarEvent } from "@/lib/calendar/api"

export interface UseCalendarReturn {
  // Connection status
  isConnected: boolean
  isLoading: boolean
  error: string | null

  // Actions
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  scheduleEvent: (suggestion: Suggestion, settings?: UserSettings) => Promise<RecoveryBlock | null>
  deleteEvent: (eventId: string) => Promise<void>
  clearError: () => void

  // Token management
  refreshTokens: () => Promise<boolean>
}

interface SessionResponse {
  authenticated: boolean
  accessToken: string | null
  expiresAt?: number
  error?: string
}

export function useCalendar(): UseCalendarReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true) // Start loading until session check completes
  const [error, setError] = useState<string | null>(null)
  const [tokens, setTokens] = useState<OAuthTokens | null>(null)
  const sessionCheckRef = useRef(false)

  // Check session status on mount
  useEffect(() => {
    // Prevent double-checking in StrictMode
    if (sessionCheckRef.current) return
    sessionCheckRef.current = true

    const checkSession = async () => {
      try {
        const response = await fetch("/api/auth/session")
        const data: SessionResponse = await response.json()

        if (data.authenticated && data.accessToken) {
          // Build tokens object from session response
          setTokens({
            access_token: data.accessToken,
            expires_at: data.expiresAt || Date.now() + 3600000,
            token_type: "Bearer",
            scope: "",
          })
          setIsConnected(true)
        } else {
          setIsConnected(false)
          setTokens(null)
        }
      } catch (err) {
        console.error("Failed to check session:", err)
        setIsConnected(false)
        setTokens(null)
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
      const response = await fetch("/api/auth/session")
      const data: SessionResponse = await response.json()

      if (data.authenticated && data.accessToken) {
        setTokens({
          access_token: data.accessToken,
          expires_at: data.expiresAt || Date.now() + 3600000,
          token_type: "Bearer",
          scope: "",
        })
        setError(null)
        return true
      } else {
        setError(data.error || "Failed to refresh token")
        setIsConnected(false)
        setTokens(null)
        return false
      }
    } catch (err) {
      setError("Failed to refresh access token")
      setIsConnected(false)
      setTokens(null)
      return false
    }
  }, [])

  // Ensure we have valid tokens before making API calls
  const ensureValidTokens = useCallback(async (): Promise<OAuthTokens | null> => {
    if (!tokens) {
      setError("Not connected to calendar")
      return null
    }

    // Check if token might be expired (with 5 min buffer)
    const fiveMinutes = 5 * 60 * 1000
    if (tokens.expires_at && tokens.expires_at - Date.now() < fiveMinutes) {
      const refreshed = await refreshTokens()
      if (!refreshed) return null
      // Return updated tokens after refresh
      return tokens
    }

    return tokens
  }, [tokens, refreshTokens])

  // Connect to Google Calendar
  const connect = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Call our API route to get the authorization URL
      const response = await fetch("/api/auth/google")

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
      if (tokens?.access_token) {
        // Revoke the access token with Google
        await revokeToken(tokens.access_token)
      }

      // Clear session cookies via API
      await fetch("/api/auth/session", { method: "DELETE" })

      setTokens(null)
      setIsConnected(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect calendar")
    } finally {
      setIsLoading(false)
    }
  }, [tokens])

  // Schedule a recovery event
  const scheduleEvent = useCallback(
    async (suggestion: Suggestion, settings?: UserSettings): Promise<RecoveryBlock | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const validTokens = await ensureValidTokens()
        if (!validTokens) {
          throw new Error("Calendar not connected or tokens expired")
        }

        const result = await scheduleRecoveryBlock(suggestion, validTokens, settings)

        if (!result.success) {
          throw new Error(result.error || "Failed to schedule recovery block")
        }

        return result.recoveryBlock || null
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to schedule event")
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [ensureValidTokens]
  )

  // Delete a calendar event
  const deleteEvent = useCallback(
    async (eventId: string) => {
      setIsLoading(true)
      setError(null)

      try {
        const validTokens = await ensureValidTokens()
        if (!validTokens) {
          throw new Error("Calendar not connected or tokens expired")
        }

        await deleteCalendarEvent(eventId, validTokens)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete event")
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [ensureValidTokens]
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
