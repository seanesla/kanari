"use client"

import { useCallback, useEffect, useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { db, type DBSettings } from "@/lib/storage/db"
import type { UserSettings } from "@/lib/types"

const DEFAULT_SETTINGS_ID = "default"

const DEFAULT_SETTINGS: UserSettings = {
  // Recording preferences
  defaultRecordingDuration: 45,
  enableVAD: true,
  // Notification preferences
  enableNotifications: false,
  dailyReminderTime: undefined,
  // Calendar integration
  calendarConnected: false,
  autoScheduleRecovery: false,
  preferredRecoveryTimes: [],
  // Privacy
  localStorageOnly: true,
}

export function useSettings() {
  const [isInitialized, setIsInitialized] = useState(false)

  const settings = useLiveQuery(async () => {
    const stored = await db.settings.get(DEFAULT_SETTINGS_ID)
    if (stored) {
      const { id, ...settings } = stored
      return settings as UserSettings
    }
    return null
  }, [])

  // Initialize settings if they don't exist
  useEffect(() => {
    async function initSettings() {
      const existing = await db.settings.get(DEFAULT_SETTINGS_ID)
      if (!existing) {
        await db.settings.add({
          id: DEFAULT_SETTINGS_ID,
          ...DEFAULT_SETTINGS,
        })
      }
      setIsInitialized(true)
    }
    initSettings()
  }, [])

  return {
    settings: settings ?? DEFAULT_SETTINGS,
    isLoading: !isInitialized && settings === undefined,
  }
}

export function useSettingsActions() {
  const updateSettings = useCallback(
    async (updates: Partial<UserSettings>) => {
      const existing = await db.settings.get(DEFAULT_SETTINGS_ID)

      if (existing) {
        await db.settings.update(DEFAULT_SETTINGS_ID, updates)
      } else {
        await db.settings.add({
          id: DEFAULT_SETTINGS_ID,
          ...DEFAULT_SETTINGS,
          ...updates,
        })
      }
    },
    []
  )

  const resetSettings = useCallback(async () => {
    await db.settings.put({
      id: DEFAULT_SETTINGS_ID,
      ...DEFAULT_SETTINGS,
    })
  }, [])

  return { updateSettings, resetSettings }
}

// ===========================================
// Calendar connection state
// ===========================================

const CALENDAR_TOKENS_KEY = "kanari_calendar_tokens"

export interface CalendarTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export function useCalendarConnection() {
  const [tokens, setTokens] = useState<CalendarTokens | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load tokens on mount
  useEffect(() => {
    const stored = localStorage.getItem(CALENDAR_TOKENS_KEY)
    if (stored) {
      try {
        setTokens(JSON.parse(stored))
      } catch {
        localStorage.removeItem(CALENDAR_TOKENS_KEY)
      }
    }
    setIsLoading(false)
  }, [])

  const saveTokens = useCallback(async (newTokens: CalendarTokens) => {
    localStorage.setItem(CALENDAR_TOKENS_KEY, JSON.stringify(newTokens))
    setTokens(newTokens)

    // Update settings
    await db.settings.update(DEFAULT_SETTINGS_ID, {
      calendarConnected: true,
    })
  }, [])

  const clearTokens = useCallback(async () => {
    localStorage.removeItem(CALENDAR_TOKENS_KEY)
    setTokens(null)

    // Update settings
    await db.settings.update(DEFAULT_SETTINGS_ID, {
      calendarConnected: false,
      autoScheduleRecovery: false,
    })
  }, [])

  const isConnected = tokens !== null && tokens.expiresAt > Date.now()
  const isExpired = tokens !== null && tokens.expiresAt <= Date.now()

  return {
    isLoading,
    isConnected,
    isExpired,
    tokens,
    saveTokens,
    clearTokens,
  }
}
