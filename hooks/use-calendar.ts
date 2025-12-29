"use client"

// React hook for calendar operations
// Manages OAuth flow, token refresh, and calendar event creation

import { useState, useEffect, useCallback } from "react"
import type { Suggestion, RecoveryBlock, UserSettings } from "@/lib/types"
import type { OAuthTokens } from "@/lib/calendar/oauth"
import {
  getStoredTokens,
  storeTokens,
  clearStoredTokens,
  isTokenExpired,
  refreshAccessToken,
  revokeToken,
} from "@/lib/calendar/oauth"
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

export function useCalendar(): UseCalendarReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokens, setTokens] = useState<OAuthTokens | null>(null)

  // Check for stored tokens on mount
  useEffect(() => {
    const storedTokens = getStoredTokens()
    if (storedTokens) {
      setTokens(storedTokens)
      setIsConnected(true)
    }

    // Listen for tokens from OAuth callback (passed via URL fragment)
    const handleHashChange = () => {
      const hash = window.location.hash
      if (hash.includes("tokens=")) {
        try {
          const tokenParam = hash.split("tokens=")[1]
          const newTokens = JSON.parse(decodeURIComponent(tokenParam)) as OAuthTokens

          storeTokens(newTokens)
          setTokens(newTokens)
          setIsConnected(true)

          // Clear the hash
          window.location.hash = ""
        } catch (err) {
          console.error("Failed to parse tokens from URL:", err)
          setError("Failed to complete calendar connection")
        }
      }
    }

    // Check on mount
    handleHashChange()

    // Listen for hash changes
    window.addEventListener("hashchange", handleHashChange)
    return () => window.removeEventListener("hashchange", handleHashChange)
  }, [])

  // Get OAuth config from environment
  const getOAuthConfig = useCallback(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    const clientSecret = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET
    const redirectUri = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error("OAuth configuration missing in environment variables")
    }

    return { clientId, clientSecret, redirectUri }
  }, [])

  // Refresh expired tokens
  const refreshTokens = useCallback(async (): Promise<boolean> => {
    if (!tokens?.refresh_token) {
      setError("No refresh token available")
      return false
    }

    try {
      const config = getOAuthConfig()
      const newTokens = await refreshAccessToken(tokens.refresh_token, config)

      storeTokens(newTokens)
      setTokens(newTokens)
      setError(null)
      return true
    } catch (err) {
      setError("Failed to refresh access token")
      setIsConnected(false)
      clearStoredTokens()
      return false
    }
  }, [tokens, getOAuthConfig])

  // Ensure we have valid tokens before making API calls
  const ensureValidTokens = useCallback(async (): Promise<OAuthTokens | null> => {
    if (!tokens) {
      setError("Not connected to calendar")
      return null
    }

    if (isTokenExpired(tokens)) {
      const refreshed = await refreshTokens()
      if (!refreshed) return null

      return getStoredTokens()
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
        // Revoke the access token
        await revokeToken(tokens.access_token)
      }

      // Clear stored tokens
      clearStoredTokens()
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
