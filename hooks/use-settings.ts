"use client"

import { useCallback, useEffect, useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { db, type DBSettings } from "@/lib/storage/db"
import {
  generateKey,
  exportKey,
  importKey,
  setCachedKey,
  clearCachedKey,
  isEncryptionAvailable,
} from "@/lib/storage/encryption"
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
  encryptionEnabled: false,
}

// Key storage in localStorage (separate from IndexedDB)
const ENCRYPTION_KEY_STORAGE_KEY = "kanari_encryption_key"

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
// Encryption key management
// ===========================================

export function useEncryption() {
  const [isEncryptionReady, setIsEncryptionReady] = useState(false)
  const [hasEncryptionKey, setHasEncryptionKey] = useState(false)

  // Check for existing encryption key on mount
  useEffect(() => {
    async function checkEncryptionKey() {
      if (!isEncryptionAvailable()) {
        setIsEncryptionReady(false)
        return
      }

      const storedKey = localStorage.getItem(ENCRYPTION_KEY_STORAGE_KEY)
      if (storedKey) {
        try {
          const key = await importKey(storedKey)
          setCachedKey(key)
          setHasEncryptionKey(true)
        } catch {
          // Invalid key, remove it
          localStorage.removeItem(ENCRYPTION_KEY_STORAGE_KEY)
          setHasEncryptionKey(false)
        }
      }
      setIsEncryptionReady(true)
    }
    checkEncryptionKey()
  }, [])

  const enableEncryption = useCallback(async () => {
    if (!isEncryptionAvailable()) {
      throw new Error("Web Crypto API not available")
    }

    // Generate a new key
    const key = await generateKey()
    const exportedKey = await exportKey(key)

    // Store the key in localStorage
    localStorage.setItem(ENCRYPTION_KEY_STORAGE_KEY, exportedKey)

    // Cache the key for immediate use
    setCachedKey(key)
    setHasEncryptionKey(true)

    // Update settings
    await db.settings.update(DEFAULT_SETTINGS_ID, {
      encryptionEnabled: true,
    })
  }, [])

  const disableEncryption = useCallback(async () => {
    // Clear the encryption key
    localStorage.removeItem(ENCRYPTION_KEY_STORAGE_KEY)
    clearCachedKey()
    setHasEncryptionKey(false)

    // Update settings
    await db.settings.update(DEFAULT_SETTINGS_ID, {
      encryptionEnabled: false,
    })

    // Note: This does not decrypt existing encrypted data
    // A full implementation would need to decrypt all data first
  }, [])

  return {
    isEncryptionAvailable: isEncryptionAvailable(),
    isEncryptionReady,
    hasEncryptionKey,
    enableEncryption,
    disableEncryption,
  }
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
