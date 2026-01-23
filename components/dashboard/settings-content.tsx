"use client"

import { useEffect, useMemo, useCallback, useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle2, Loader2 } from "@/lib/icons"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { GeminiMemorySection } from "./settings-gemini-memory"
import { SettingsAccountSection } from "./settings-account"
import { SettingsApiSection } from "./settings-api"
import { SettingsAccountabilitySection } from "./settings-accountability-section"
import { SettingsAppearanceSection } from "./settings-appearance"
import { SettingsCalendarSection } from "./settings-calendar"
import { SettingsNotificationsSection } from "./settings-notifications"
import { SettingsPrivacySection } from "./settings-privacy"
import { SettingsTimeZoneSection } from "./settings-timezone"
import { SettingsVoiceSection } from "./settings-voice-section"
import { SettingsProfileSection } from "./settings-profile-section"
import { db } from "@/lib/storage/db"
import { DEFAULT_USER_SETTINGS, createDefaultSettingsRecord } from "@/lib/settings/default-settings"
import { setDisableStartupAnimationSync } from "@/lib/scene-context"
import type { AccountabilityMode, GeminiVoice, UserSettings } from "@/lib/types"

// Pattern doc: docs/error-patterns/settings-schema-drift-and-partial-save.md
type SettingsDraft = Pick<
  UserSettings,
  | "userName"
  | "enableNotifications"
  | "dailyReminderTime"
  | "autoScheduleRecovery"
  | "localStorageOnly"
  | "geminiApiKey"
  | "selectedGeminiVoice"
  | "accountabilityMode"
  | "disableStartupAnimation"
>

const DEFAULT_DRAFT: SettingsDraft = {
  userName: DEFAULT_USER_SETTINGS.userName,
  enableNotifications: DEFAULT_USER_SETTINGS.enableNotifications,
  dailyReminderTime: DEFAULT_USER_SETTINGS.dailyReminderTime,
  autoScheduleRecovery: DEFAULT_USER_SETTINGS.autoScheduleRecovery,
  localStorageOnly: DEFAULT_USER_SETTINGS.localStorageOnly,
  geminiApiKey: DEFAULT_USER_SETTINGS.geminiApiKey,
  selectedGeminiVoice: DEFAULT_USER_SETTINGS.selectedGeminiVoice,
  accountabilityMode: DEFAULT_USER_SETTINGS.accountabilityMode,
  disableStartupAnimation: DEFAULT_USER_SETTINGS.disableStartupAnimation,
}

export function SettingsContent() {
  const [draft, setDraft] = useState<SettingsDraft>(() => ({ ...DEFAULT_DRAFT }))

  const [baseline, setBaseline] = useState<SettingsDraft | null>(null)

  // Render the floating save bar into <body> so it's not affected by any
  // parent transforms (e.g. translate-y entry animations on the Settings page).
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setPortalRoot(document.body)
  }, [])

  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // Load settings from IndexedDB on mount
  useEffect(() => {
    const fallback: SettingsDraft = { ...DEFAULT_DRAFT }

    async function loadSettings() {
      try {
        const savedSettings = await db.settings.get("default")
        const hydrated: SettingsDraft = {
          userName: savedSettings?.userName ?? DEFAULT_USER_SETTINGS.userName,
          enableNotifications: savedSettings?.enableNotifications ?? DEFAULT_USER_SETTINGS.enableNotifications,
          dailyReminderTime: savedSettings?.dailyReminderTime,
          autoScheduleRecovery: savedSettings?.autoScheduleRecovery ?? DEFAULT_USER_SETTINGS.autoScheduleRecovery,
          localStorageOnly: savedSettings?.localStorageOnly ?? DEFAULT_USER_SETTINGS.localStorageOnly,
          geminiApiKey: savedSettings?.geminiApiKey,
          selectedGeminiVoice: savedSettings?.selectedGeminiVoice as GeminiVoice | undefined,
          accountabilityMode: (savedSettings?.accountabilityMode as AccountabilityMode | undefined) ?? DEFAULT_USER_SETTINGS.accountabilityMode,
          disableStartupAnimation: savedSettings?.disableStartupAnimation ?? DEFAULT_USER_SETTINGS.disableStartupAnimation,
        }

        // Keep localStorage in sync so SceneProvider can read it synchronously on load.
        setDisableStartupAnimationSync(hydrated.disableStartupAnimation ?? false)

        setDraft(hydrated)
        setBaseline(hydrated)
      } catch (error) {
        console.error("Failed to load settings:", error)
        // If IndexedDB read fails, treat defaults as the baseline so the Save button
        // doesn't appear "dirty" by default.
        setBaseline((prev) => prev ?? fallback)
      }
    }
    loadSettings()
  }, [])

  const normalizedDraft = useMemo((): SettingsDraft => {
    const trimmedKey = draft.geminiApiKey?.trim() ?? ""
    const trimmedName = draft.userName?.trim() ?? ""
    return {
      ...draft,
      userName: trimmedName.length > 0 ? trimmedName : undefined,
      geminiApiKey: trimmedKey.length > 0 ? trimmedKey : undefined,
      dailyReminderTime: draft.dailyReminderTime ? draft.dailyReminderTime : undefined,
      selectedGeminiVoice: draft.selectedGeminiVoice ?? undefined,
      accountabilityMode: draft.accountabilityMode ?? DEFAULT_USER_SETTINGS.accountabilityMode,
    }
  }, [draft])

  const isDirty = useMemo(() => {
    if (!baseline) return false
    return (
      baseline.userName !== normalizedDraft.userName ||
      baseline.enableNotifications !== normalizedDraft.enableNotifications ||
      baseline.dailyReminderTime !== normalizedDraft.dailyReminderTime ||
      baseline.autoScheduleRecovery !== normalizedDraft.autoScheduleRecovery ||
      baseline.localStorageOnly !== normalizedDraft.localStorageOnly ||
      baseline.geminiApiKey !== normalizedDraft.geminiApiKey ||
      baseline.selectedGeminiVoice !== normalizedDraft.selectedGeminiVoice ||
      baseline.accountabilityMode !== normalizedDraft.accountabilityMode ||
      baseline.disableStartupAnimation !== normalizedDraft.disableStartupAnimation
    )
  }, [baseline, normalizedDraft])

  // Save settings to IndexedDB
  const handleSaveSettings = useCallback(async () => {
    setIsSaving(true)
    setSaveMessage(null)
    try {
      const updates: Partial<UserSettings> = {
        userName: normalizedDraft.userName,
        enableNotifications: normalizedDraft.enableNotifications,
        dailyReminderTime: normalizedDraft.dailyReminderTime,
        autoScheduleRecovery: normalizedDraft.autoScheduleRecovery,
        localStorageOnly: normalizedDraft.localStorageOnly,
        geminiApiKey: normalizedDraft.geminiApiKey,
        selectedGeminiVoice: normalizedDraft.selectedGeminiVoice,
        accountabilityMode: normalizedDraft.accountabilityMode,
        disableStartupAnimation: normalizedDraft.disableStartupAnimation,
      }

      const updated = await db.settings.update("default", updates)
      if (updated === 0) {
        await db.settings.put(createDefaultSettingsRecord(updates))
      }

      // Sync animation preference to localStorage for instant access on next page load
      setDisableStartupAnimationSync(normalizedDraft.disableStartupAnimation ?? false)

      setBaseline(normalizedDraft)
      setSaveMessage({ type: "success", text: "Settings saved successfully!" })
      // Clear success message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (error) {
      console.error("Failed to save settings:", error)
      setSaveMessage({ type: "error", text: "Failed to save settings. Please try again." })
    } finally {
      setIsSaving(false)
    }
  }, [normalizedDraft])

  const handleResetToDefaults = useCallback(() => {
    setShowResetConfirm(false)
    setDraft({ ...DEFAULT_DRAFT })
    setSaveMessage(null)

    // Reset localStorage too (applies on next load even before the user saves).
    setDisableStartupAnimationSync(DEFAULT_DRAFT.disableStartupAnimation ?? false)
  }, [])

  return (
    <div className={`w-full space-y-8 ${isDirty ? "pb-24" : ""}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 auto-rows-max">
        <SettingsProfileSection
          userName={draft.userName ?? ""}
          onUserNameChange={(name) => {
            setDraft((prev) => ({ ...prev, userName: name }))
            setSaveMessage(null)
          }}
        />

        <SettingsVoiceSection
          selectedVoice={draft.selectedGeminiVoice}
          onVoiceChange={(voice) => {
            setDraft((prev) => ({ ...prev, selectedGeminiVoice: voice }))
            setSaveMessage(null)
          }}
        />

        <SettingsAccountabilitySection
          accountabilityMode={draft.accountabilityMode}
          onAccountabilityModeChange={(mode) => {
            setDraft((prev) => ({ ...prev, accountabilityMode: mode }))
            setSaveMessage(null)
          }}
        />

        <SettingsNotificationsSection
          enableNotifications={draft.enableNotifications}
          onEnableNotificationsChange={(checked) => {
            setDraft((prev) => ({ ...prev, enableNotifications: checked }))
            setSaveMessage(null)
          }}
          dailyReminderTime={draft.dailyReminderTime}
          onDailyReminderTimeChange={(time) => {
            setDraft((prev) => ({ ...prev, dailyReminderTime: time }))
            setSaveMessage(null)
          }}
        />

        <SettingsTimeZoneSection />

        <SettingsPrivacySection
          localStorageOnly={draft.localStorageOnly}
          onLocalStorageOnlyChange={(checked) => {
            setDraft((prev) => ({ ...prev, localStorageOnly: checked }))
            setSaveMessage(null)
          }}
        />

        <SettingsAppearanceSection
          disableStartupAnimation={draft.disableStartupAnimation}
          onDisableStartupAnimationChange={(checked) => {
            setDraft((prev) => ({ ...prev, disableStartupAnimation: checked }))
            setSaveMessage(null)

            // Apply instantly for the next page load, even if user forgets to click Save.
            setDisableStartupAnimationSync(checked)
          }}
        />

        <SettingsAccountSection isSaving={isSaving} />

        <SettingsCalendarSection
          autoScheduleRecovery={draft.autoScheduleRecovery}
          onAutoScheduleRecoveryChange={(checked) => {
            setDraft((prev) => ({ ...prev, autoScheduleRecovery: checked }))
            setSaveMessage(null)
          }}
        />

        <SettingsApiSection
          geminiApiKey={draft.geminiApiKey ?? ""}
          onGeminiApiKeyChange={(value) => {
            setDraft((prev) => ({ ...prev, geminiApiKey: value }))
            setSaveMessage(null)
          }}
        />

        {/* Gemini Memory */}
        <div className="md:col-span-2">
          <GeminiMemorySection />
        </div>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div
          className={`rounded-lg p-4 ${
            saveMessage.type === "success"
              ? "bg-green-500/10 border border-green-500/20 text-green-500"
              : "bg-destructive/10 border border-destructive/20 text-destructive"
          }`}
        >
          <div className="flex items-center gap-2">
            {saveMessage.type === "success" ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <p className="font-medium">{saveMessage.text}</p>
          </div>
        </div>
      )}

      {/* Reset to Defaults */}
      <div className="rounded-lg border border-border/50 px-4 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-muted-foreground font-sans">
            <span className="font-medium text-foreground">Reset all settings</span>
            <p className="mt-1">
              This will reset all settings to their default values.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => setShowResetConfirm(true)}
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            Reset to Defaults
          </Button>
        </div>
      </div>

      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to defaults?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset all settings to their default values. Your current settings will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetToDefaults}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Floating Save Bar - appears when there are unsaved changes */}
      {portalRoot && isDirty
        ? createPortal(
            <div
              className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur px-4 py-3 shadow-lg"
              role="status"
              aria-live="polite"
            >
              <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-accent" />
                  <span className="font-medium">You have unsaved changes</span>
                </div>
                <Button
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </div>,
            portalRoot
          )
        : null}
    </div>
  )
}
