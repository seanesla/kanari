"use client"

/**
 * useOnboarding Hook
 *
 * Manages the onboarding flow state for first-time users.
 * Checks if user has completed onboarding and provides methods to update status.
 */

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/storage/db"
import type { UserSettings } from "@/lib/types"

interface UseOnboardingResult {
  /** Whether onboarding data has loaded */
  isLoading: boolean
  /** Whether the user has completed onboarding */
  hasCompletedOnboarding: boolean
  /** Current user settings */
  settings: UserSettings | null
  /** Mark onboarding as complete */
  completeOnboarding: () => Promise<void>
  /** Update settings during onboarding */
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>
  /** Redirect to onboarding if not completed */
  redirectIfNeeded: () => void
}

const DEFAULT_SETTINGS: UserSettings = {
  defaultRecordingDuration: 30,
  enableVAD: true,
  enableNotifications: false,
  calendarConnected: false,
  autoScheduleRecovery: false,
  preferredRecoveryTimes: [],
  localStorageOnly: true,
  hasCompletedOnboarding: false,
}

export function useOnboarding(): UseOnboardingResult {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)

  // Query settings from IndexedDB
  const dbSettings = useLiveQuery(
    () => db.settings.get("default"),
    []
  )

  // Track loading state
  useEffect(() => {
    // Give Dexie a moment to load
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 100)
    return () => clearTimeout(timer)
  }, [dbSettings])

  const settings = dbSettings || null
  const hasCompletedOnboarding = settings?.hasCompletedOnboarding ?? false

  /**
   * Mark onboarding as complete
   */
  const completeOnboarding = useCallback(async () => {
    const now = new Date().toISOString()

    if (settings) {
      // Update existing settings
      await db.settings.update("default", {
        hasCompletedOnboarding: true,
        onboardingCompletedAt: now,
      })
    } else {
      // Create new settings with onboarding complete
      await db.settings.add({
        id: "default",
        ...DEFAULT_SETTINGS,
        hasCompletedOnboarding: true,
        onboardingCompletedAt: now,
      })
    }
  }, [settings])

  /**
   * Update settings during onboarding
   */
  const updateSettings = useCallback(async (updates: Partial<UserSettings>) => {
    if (settings) {
      await db.settings.update("default", updates)
    } else {
      await db.settings.add({
        id: "default",
        ...DEFAULT_SETTINGS,
        ...updates,
      })
    }
  }, [settings])

  /**
   * Redirect to onboarding if not completed
   */
  const redirectIfNeeded = useCallback(() => {
    if (!isLoading && !hasCompletedOnboarding) {
      router.push("/onboarding")
    }
  }, [isLoading, hasCompletedOnboarding, router])

  return {
    isLoading,
    hasCompletedOnboarding,
    settings,
    completeOnboarding,
    updateSettings,
    redirectIfNeeded,
  }
}

/**
 * Hook to check onboarding status on page load
 * Use this in protected pages to redirect to onboarding if needed
 */
export function useOnboardingGuard(): { isReady: boolean } {
  const { isLoading, hasCompletedOnboarding, redirectIfNeeded } = useOnboarding()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      if (!hasCompletedOnboarding) {
        redirectIfNeeded()
      } else {
        setIsReady(true)
      }
    }
  }, [isLoading, hasCompletedOnboarding, redirectIfNeeded])

  return { isReady }
}
