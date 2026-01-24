"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import type { EntityTable, IDType } from "dexie"
import {
  db,
  fromCheckInSession,
  fromTrendData,
  fromSuggestion,
  fromDailyAchievement,
  fromMilestoneBadge,
  fromJournalEntry,
  toTrendData,
} from "@/lib/storage/db"
import { createDefaultSettingsRecord } from "@/lib/settings/default-settings"
import type { TrendData } from "@/lib/types"
import {
  generateDemoCheckInSessions,
  generateDemoTrendData,
  generateDemoSuggestions,
  generateDemoAchievements,
  generateDemoMilestoneBadges,
  generateDemoUserProgress,
  generateDemoJournalEntries,
  DEMO_USER_NAME,
  DEMO_API_KEY,
} from "@/lib/demo/demo-data"
import { waitForElement, scrollToElement, waitForScrollEnd } from "@/lib/demo/demo-utils"
import type { DemoState, DemoContextValue, DemoStep } from "./steps/types"
import { ALL_DEMO_STEPS } from "./steps/all-steps"

const DemoContext = createContext<DemoContextValue | null>(null)

const DEMO_BACKUP_STORAGE_KEY = "kanari_demo_backup_v1"

type DemoBackupV1 = {
  version: 1
  createdAtISO: string
  settings: {
    existed: boolean
    userName?: string
    geminiApiKey?: string
    hasCompletedOnboarding?: boolean
    onboardingCompletedAt?: string
  }
  userProgress: {
    existed: boolean
    record?: unknown
  }
  trendData: {
    previous: TrendData[]
    missingIds: string[]
  }
}

function safeReadDemoBackup(): DemoBackupV1 | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(DEMO_BACKUP_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DemoBackupV1
    if (parsed?.version !== 1) return null
    return parsed
  } catch {
    return null
  }
}

function safeWriteDemoBackup(backup: DemoBackupV1): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(DEMO_BACKUP_STORAGE_KEY, JSON.stringify(backup))
  } catch {
    // Ignore localStorage failures (private mode, quota, etc.)
  }
}

function safeClearDemoBackup(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(DEMO_BACKUP_STORAGE_KEY)
  } catch {
    // ignore
  }
}

const initialState: DemoState = {
  isActive: false,
  currentStepIndex: 0,
  totalSteps: ALL_DEMO_STEPS.length,
  currentPhase: "landing",
  highlightedElement: null,
  isNavigating: false,
  isTransitioning: false,
  hasSeededData: false,
}

interface DemoProviderProps {
  children: ReactNode
}

export function DemoProvider({ children }: DemoProviderProps) {
  const router = useRouter()
  const [state, setState] = useState<DemoState>(initialState)

  // Seed demo data into IndexedDB
  const seedDemoData = useCallback(async () => {
    try {
      const sessions = generateDemoCheckInSessions()
      const trends = generateDemoTrendData()
      const suggestions = generateDemoSuggestions()
      const achievements = generateDemoAchievements()
      const badges = generateDemoMilestoneBadges()
      const progress = generateDemoUserProgress()
      const journals = generateDemoJournalEntries()

      // Backup any real user data we're about to overwrite (settings/userProgress/trendData).
      // This keeps demo mode reversible.
      // See: docs/error-patterns/demo-mode-overwrites-real-user-data.md
      if (!safeReadDemoBackup()) {
        const existingSettings = await db.settings.get("default")
        const existingProgress = await db.userProgress.get("default")

        const previousTrends: TrendData[] = []
        const missingTrendIds: string[] = []
        for (const trend of trends) {
          const existingTrend = await db.trendData.get(trend.date)
          if (existingTrend) {
            previousTrends.push(toTrendData(existingTrend))
          } else {
            missingTrendIds.push(trend.date)
          }
        }

        safeWriteDemoBackup({
          version: 1,
          createdAtISO: new Date().toISOString(),
          settings: {
            existed: !!existingSettings,
            userName: existingSettings?.userName,
            geminiApiKey: existingSettings?.geminiApiKey,
            hasCompletedOnboarding: existingSettings?.hasCompletedOnboarding,
            onboardingCompletedAt: existingSettings?.onboardingCompletedAt,
          },
          userProgress: {
            existed: !!existingProgress,
            record: existingProgress ?? undefined,
          },
          trendData: {
            previous: previousTrends,
            missingIds: missingTrendIds,
          },
        })
      }

      // Fast bulk seeding to keep "Feature Tour" snappy for judges.
      // See: docs/error-patterns/demo-seed-data-bulk-operations.md
      await db.transaction(
        "rw",
        [
          db.checkInSessions,
          db.trendData,
          db.suggestions,
          db.achievements,
          db.milestoneBadges,
          db.userProgress,
          db.journalEntries,
          db.settings,
        ],
        async () => {
          // Demo can be started multiple times (or after a refresh) without a clean stop.
          // Remove any existing demo rows first so we don't accumulate duplicates.
          const deleteDemoRows = async <T extends { id: string }>(table: EntityTable<T, "id">) => {
            const keys = await table.where("id").startsWith("demo_").primaryKeys()
            if (keys.length > 0) {
              await table.bulkDelete(keys as IDType<T, "id">[])
            }
          }

          await deleteDemoRows(db.checkInSessions)
          await deleteDemoRows(db.suggestions)
          await deleteDemoRows(db.achievements)
          await deleteDemoRows(db.milestoneBadges)
          await deleteDemoRows(db.journalEntries)

          await db.checkInSessions.bulkPut(sessions.map(fromCheckInSession))
          await db.trendData.bulkPut(trends.map(fromTrendData))
          await db.suggestions.bulkPut(suggestions.map(fromSuggestion))
          await db.achievements.bulkPut(achievements.map(fromDailyAchievement))
          await db.milestoneBadges.bulkPut(badges.map(fromMilestoneBadge))
          await db.userProgress.put(progress)
          await db.journalEntries.bulkPut(journals.map(fromJournalEntry))

          const existingSettings = await db.settings.get("default")
          const existingKey = existingSettings?.geminiApiKey?.trim() ?? ""
          const geminiApiKeyForDemo =
            existingKey && existingKey !== DEMO_API_KEY ? existingSettings?.geminiApiKey : DEMO_API_KEY
          if (existingSettings) {
            await db.settings.update("default", {
              userName: DEMO_USER_NAME,
              // IMPORTANT: Never overwrite a real user-provided key. Demo mode only needs a placeholder
              // when no key is configured, and overwriting breaks real check-ins.
              // See: docs/error-patterns/demo-mode-overwrites-real-user-data.md
              geminiApiKey: geminiApiKeyForDemo,
              hasCompletedOnboarding: true,
              onboardingCompletedAt: new Date().toISOString(),
            })
          } else {
            await db.settings.put(
              createDefaultSettingsRecord({
                userName: DEMO_USER_NAME,
                geminiApiKey: DEMO_API_KEY,
                hasCompletedOnboarding: true,
                onboardingCompletedAt: new Date().toISOString(),
              })
            )
          }
        }
      )

      return true
    } catch (error) {
      console.error("[DemoProvider] Failed to seed demo data:", error)
      return false
    }
  }, [])

  // Clean up demo data
  const cleanupDemoData = useCallback(async () => {
    try {
      const backup = safeReadDemoBackup()

      const sessions = await db.checkInSessions.toArray()
      const demoSessionIds = sessions.filter((s) => s.id.startsWith("demo_")).map((s) => s.id)
      await db.checkInSessions.bulkDelete(demoSessionIds)

      const suggestions = await db.suggestions.toArray()
      const demoSuggestionIds = suggestions.filter((s) => s.id.startsWith("demo_")).map((s) => s.id)
      await db.suggestions.bulkDelete(demoSuggestionIds)

      const achievements = await db.achievements.toArray()
      const demoAchievementIds = achievements.filter((a) => a.id.startsWith("demo_")).map((a) => a.id)
      await db.achievements.bulkDelete(demoAchievementIds)

      const badges = await db.milestoneBadges.toArray()
      const demoBadgeIds = badges.filter((b) => b.id.startsWith("demo_")).map((b) => b.id)
      await db.milestoneBadges.bulkDelete(demoBadgeIds)

      const journals = await db.journalEntries.toArray()
      const demoJournalIds = journals.filter((j) => j.id.startsWith("demo_")).map((j) => j.id)
      await db.journalEntries.bulkDelete(demoJournalIds)

      if (backup) {
        // Restore any overwritten tables/records.
        if (backup.trendData.missingIds.length > 0) {
          await db.trendData.bulkDelete(backup.trendData.missingIds)
        }
        if (backup.trendData.previous.length > 0) {
          await db.trendData.bulkPut(backup.trendData.previous.map(fromTrendData))
        }

        if (backup.userProgress.existed) {
          await db.userProgress.put(backup.userProgress.record as Parameters<typeof db.userProgress.put>[0])
        } else {
          await db.userProgress.delete("default")
        }

        if (backup.settings.existed) {
          await db.settings.update("default", {
            userName: backup.settings.userName,
            geminiApiKey: backup.settings.geminiApiKey,
            hasCompletedOnboarding: backup.settings.hasCompletedOnboarding,
            onboardingCompletedAt: backup.settings.onboardingCompletedAt,
          })
        } else {
          await db.settings.update("default", {
            userName: undefined,
            geminiApiKey: undefined,
            hasCompletedOnboarding: false,
            onboardingCompletedAt: undefined,
          })
        }

        safeClearDemoBackup()
      } else {
        // Best-effort fallback: only revert obvious demo placeholders.
        // If localStorage is unavailable we may not have a backup to restore from, so avoid wiping
        // real user settings (especially their API key).
        const currentSettings = await db.settings.get("default")
        const looksLikeDemo =
          currentSettings?.userName === DEMO_USER_NAME || currentSettings?.geminiApiKey === DEMO_API_KEY

        if (currentSettings && looksLikeDemo) {
          await db.settings.update("default", {
            ...(currentSettings.userName === DEMO_USER_NAME ? { userName: undefined } : {}),
            ...(currentSettings.geminiApiKey === DEMO_API_KEY ? { geminiApiKey: undefined } : {}),
            hasCompletedOnboarding: false,
            onboardingCompletedAt: undefined,
          })
        }
      }
    } catch (error) {
      console.error("[DemoProvider] Failed to cleanup demo data:", error)
    }
  }, [])

  // If a demo run was interrupted (refresh/crash) we can be left with:
  // - demo data still seeded in IndexedDB
  // - a backup still present in localStorage
  // Auto-cleanup on mount so users don't get stuck with demo settings (e.g., DEMO_MODE key).
  useEffect(() => {
    const backup = safeReadDemoBackup()
    if (!backup) return
    cleanupDemoData()
  }, [cleanupDemoData])

  // Get current step
  const getCurrentStep = useCallback((): DemoStep | null => {
    if (!state.isActive || state.currentStepIndex >= ALL_DEMO_STEPS.length) {
      return null
    }
    return ALL_DEMO_STEPS[state.currentStepIndex]
  }, [state.isActive, state.currentStepIndex])

  // Execute step (scroll, highlight, etc.)
  const executeStep = useCallback(async (step: DemoStep) => {
    // Mark step as transitioning immediately so the UI can pause autoplay + prevent key skips.
    setState((prev) => ({
      ...prev,
      isTransitioning: true,
      // Keep the previous highlight while we transition. If it disappears (route change),
      // DemoSpotlight will fall back to a full dim overlay.
    }))

    // If step changes route, do a client navigation (do NOT hard-reload or we lose demo state).
    // See: docs/error-patterns/internal-navigation-window-location-href.md
    if (step.route) {
      setState((prev) => ({ ...prev, isNavigating: true }))
      router.push(step.route)
    }

    // Wait for target element if specified
    if (step.waitFor) {
      await waitForElement(step.waitFor, 5000)
    }

    const isMobileViewport = () => typeof window !== "undefined" && window.innerWidth < 768

    const isElementVisible = (el: HTMLElement): boolean => {
      const rect = el.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    }

    const waitForSelector = (selector: string, timeoutMs: number): Promise<HTMLElement | null> => {
      return new Promise((resolve) => {
        const existing = document.querySelector<HTMLElement>(selector)
        if (existing) {
          resolve(existing)
          return
        }

        const observer = new MutationObserver(() => {
          const found = document.querySelector<HTMLElement>(selector)
          if (found) {
            observer.disconnect()
            resolve(found)
          }
        })

        observer.observe(document.body, { childList: true, subtree: true })

        setTimeout(() => {
          observer.disconnect()
          resolve(null)
        }, timeoutMs)
      })
    }

    const ensureMobileHistorySidebarOpen = async (): Promise<void> => {
      if (!isMobileViewport()) return

      // The History page uses the shared Sidebar + Sheet on mobile. If the Sheet is closed,
      // the sidebar content (and our demo targets) won't be present in the DOM.
      const sheetSelector = '[data-slot="sheet-content"][data-mobile="true"]'
      const alreadyOpen = document.querySelector(sheetSelector)
      if (alreadyOpen) return

      const triggers = Array.from(document.querySelectorAll<HTMLElement>('[data-sidebar="trigger"]'))
      const trigger = triggers.find(isElementVisible)
      if (!trigger) return

      trigger.click()
      await waitForSelector(sheetSelector, 1500)
    }

    // For mobile check-in steps, ensure the sidebar sheet is opened before we wait for targets.
    if (step.target === "demo-checkin-sidebar" || step.target === "demo-new-checkin-button") {
      await ensureMobileHistorySidebarOpen()
    }

    // Wait for target element
    const element = await waitForElement(step.target, 3000)
    if (element) {
      const didScroll = scrollToElement(element, step.scrollBehavior)
      if (didScroll) {
        await waitForScrollEnd(1000)
      }
    }

    // Update state
    setState((prev) => ({
      ...prev,
      highlightedElement: element ? step.target : null,
      currentPhase: step.phase,
      isNavigating: false,
      isTransitioning: false,
    }))
  }, [router])

  // Navigate to next step
  const nextStep = useCallback(() => {
    setState((prev) => {
      const nextIndex = prev.currentStepIndex + 1
      if (nextIndex >= ALL_DEMO_STEPS.length) {
        return {
          ...prev,
          currentStepIndex: nextIndex,
          currentPhase: "complete",
          highlightedElement: null,
          isTransitioning: false,
        }
      }
      return { ...prev, currentStepIndex: nextIndex }
    })
  }, [])

  // Navigate to previous step
  const previousStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStepIndex: Math.max(0, prev.currentStepIndex - 1),
    }))
  }, [])

  // Go to specific step
  const goToStep = useCallback((index: number) => {
    if (index >= 0 && index < ALL_DEMO_STEPS.length) {
      setState((prev) => ({ ...prev, currentStepIndex: index }))
    }
  }, [])

  // Start demo
  const startDemo = useCallback(async () => {
    const seeded = await seedDemoData()
    setState({
      isActive: true,
      currentStepIndex: 0,
      totalSteps: ALL_DEMO_STEPS.length,
      currentPhase: "landing",
      highlightedElement: null,
      isNavigating: false,
      isTransitioning: false,
      hasSeededData: seeded,
    })
  }, [seedDemoData])

  // Stop demo
  const stopDemo = useCallback(
    (redirectTo: string = "/") => {
      cleanupDemoData()
      setState(initialState)
      router.push(redirectTo)
    },
    [cleanupDemoData, router]
  )

  // Execute step when step index changes
  useEffect(() => {
    if (state.isActive && state.currentStepIndex < ALL_DEMO_STEPS.length) {
      const step = ALL_DEMO_STEPS[state.currentStepIndex]
      executeStep(step)
    }
  }, [state.isActive, state.currentStepIndex, executeStep])

  const contextValue = useMemo<DemoContextValue>(
    () => ({
      ...state,
      startDemo,
      stopDemo,
      nextStep,
      previousStep,
      goToStep,
      getCurrentStep,
    }),
    [state, startDemo, stopDemo, nextStep, previousStep, goToStep, getCurrentStep]
  )

  return (
    <DemoContext.Provider value={contextValue}>{children}</DemoContext.Provider>
  )
}

export function useDemo(): DemoContextValue {
  const context = useContext(DemoContext)
  if (!context) {
    throw new Error("useDemo must be used within a DemoProvider")
  }
  return context
}

export function useDemoStatus(): { isActive: boolean } {
  const context = useContext(DemoContext)
  return { isActive: context?.isActive ?? false }
}
