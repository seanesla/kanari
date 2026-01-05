"use client"

import { useEffect, useMemo, useCallback, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { GeminiMemorySection } from "./settings-gemini-memory"
import { SettingsAccountSection } from "./settings-account"
import { SettingsApiSection } from "./settings-api"
import { SettingsAppearanceSection } from "./settings-appearance"
import { SettingsCalendarSection } from "./settings-calendar"
import { SettingsNotificationsSection } from "./settings-notifications"
import { SettingsPrivacySection } from "./settings-privacy"
import { SettingsRecordingSection } from "./settings-recording"
import { SettingsVoiceSection } from "./settings-voice-section"
import { db } from "@/lib/storage/db"
import { DEFAULT_USER_SETTINGS, createDefaultSettingsRecord } from "@/lib/settings/default-settings"
import type { GeminiVoice, UserSettings } from "@/lib/types"

// Pattern doc: docs/error-patterns/settings-schema-drift-and-partial-save.md
type SettingsDraft = Pick<
  UserSettings,
  | "defaultRecordingDuration"
  | "enableVAD"
  | "enableNotifications"
  | "dailyReminderTime"
  | "autoScheduleRecovery"
  | "localStorageOnly"
  | "geminiApiKey"
  | "selectedGeminiVoice"
>

export function SettingsContent() {
  const [draft, setDraft] = useState<SettingsDraft>({
    defaultRecordingDuration: DEFAULT_USER_SETTINGS.defaultRecordingDuration,
    enableVAD: DEFAULT_USER_SETTINGS.enableVAD,
    enableNotifications: DEFAULT_USER_SETTINGS.enableNotifications,
    dailyReminderTime: undefined,
    autoScheduleRecovery: DEFAULT_USER_SETTINGS.autoScheduleRecovery,
    localStorageOnly: DEFAULT_USER_SETTINGS.localStorageOnly,
    geminiApiKey: undefined,
    selectedGeminiVoice: undefined,
  })

  const [baseline, setBaseline] = useState<SettingsDraft | null>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Load settings from IndexedDB on mount
  useEffect(() => {
    const fallback: SettingsDraft = {
      defaultRecordingDuration: DEFAULT_USER_SETTINGS.defaultRecordingDuration,
      enableVAD: DEFAULT_USER_SETTINGS.enableVAD,
      enableNotifications: DEFAULT_USER_SETTINGS.enableNotifications,
      dailyReminderTime: undefined,
      autoScheduleRecovery: DEFAULT_USER_SETTINGS.autoScheduleRecovery,
      localStorageOnly: DEFAULT_USER_SETTINGS.localStorageOnly,
      geminiApiKey: undefined,
      selectedGeminiVoice: undefined,
    }

    async function loadSettings() {
      try {
        const savedSettings = await db.settings.get("default")
        const hydrated: SettingsDraft = {
          defaultRecordingDuration: savedSettings?.defaultRecordingDuration ?? DEFAULT_USER_SETTINGS.defaultRecordingDuration,
          enableVAD: savedSettings?.enableVAD ?? DEFAULT_USER_SETTINGS.enableVAD,
          enableNotifications: savedSettings?.enableNotifications ?? DEFAULT_USER_SETTINGS.enableNotifications,
          dailyReminderTime: savedSettings?.dailyReminderTime,
          autoScheduleRecovery: savedSettings?.autoScheduleRecovery ?? DEFAULT_USER_SETTINGS.autoScheduleRecovery,
          localStorageOnly: savedSettings?.localStorageOnly ?? DEFAULT_USER_SETTINGS.localStorageOnly,
          geminiApiKey: savedSettings?.geminiApiKey,
          selectedGeminiVoice: savedSettings?.selectedGeminiVoice as GeminiVoice | undefined,
        }
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
    return {
      ...draft,
      geminiApiKey: trimmedKey.length > 0 ? trimmedKey : undefined,
      dailyReminderTime: draft.dailyReminderTime ? draft.dailyReminderTime : undefined,
      selectedGeminiVoice: draft.selectedGeminiVoice ?? undefined,
    }
  }, [draft])

  const isDirty = useMemo(() => {
    if (!baseline) return false
    return (
      baseline.defaultRecordingDuration !== normalizedDraft.defaultRecordingDuration ||
      baseline.enableVAD !== normalizedDraft.enableVAD ||
      baseline.enableNotifications !== normalizedDraft.enableNotifications ||
      baseline.dailyReminderTime !== normalizedDraft.dailyReminderTime ||
      baseline.autoScheduleRecovery !== normalizedDraft.autoScheduleRecovery ||
      baseline.localStorageOnly !== normalizedDraft.localStorageOnly ||
      baseline.geminiApiKey !== normalizedDraft.geminiApiKey ||
      baseline.selectedGeminiVoice !== normalizedDraft.selectedGeminiVoice
    )
  }, [baseline, normalizedDraft])

  const [isSaveReminderVisible, setIsSaveReminderVisible] = useState(false)
  const saveReminderDismissedRef = useRef(false)
  const prevDirtyRef = useRef(false)

  useEffect(() => {
    // Show the reminder once per "dirty session" (until saved).
    if (!prevDirtyRef.current && isDirty) {
      saveReminderDismissedRef.current = false
      setIsSaveReminderVisible(true)
    }

    // Reset when changes are saved.
    if (!isDirty) {
      saveReminderDismissedRef.current = false
      setIsSaveReminderVisible(false)
    }

    prevDirtyRef.current = isDirty
  }, [isDirty])

  // Save settings to IndexedDB
  const handleSaveSettings = useCallback(async () => {
    setIsSaving(true)
    setSaveMessage(null)
    try {
      const updates: Partial<UserSettings> = {
        defaultRecordingDuration: normalizedDraft.defaultRecordingDuration,
        enableVAD: normalizedDraft.enableVAD,
        enableNotifications: normalizedDraft.enableNotifications,
        dailyReminderTime: normalizedDraft.dailyReminderTime,
        autoScheduleRecovery: normalizedDraft.autoScheduleRecovery,
        localStorageOnly: normalizedDraft.localStorageOnly,
        geminiApiKey: normalizedDraft.geminiApiKey,
        selectedGeminiVoice: normalizedDraft.selectedGeminiVoice,
      }

      const updated = await db.settings.update("default", updates)
      if (updated === 0) {
        await db.settings.put(createDefaultSettingsRecord(updates))
      }

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

  return (
    <div className="w-full space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 auto-rows-max">
        <SettingsRecordingSection
          enableVAD={draft.enableVAD}
          onEnableVADChange={(checked) => {
            setDraft((prev) => ({ ...prev, enableVAD: checked }))
            setSaveMessage(null)
          }}
          defaultRecordingDuration={draft.defaultRecordingDuration}
          onDefaultRecordingDurationChange={(seconds) => {
            setDraft((prev) => ({ ...prev, defaultRecordingDuration: seconds }))
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

        <SettingsPrivacySection
          localStorageOnly={draft.localStorageOnly}
          onLocalStorageOnlyChange={(checked) => {
            setDraft((prev) => ({ ...prev, localStorageOnly: checked }))
            setSaveMessage(null)
          }}
        />

        <SettingsAppearanceSection />

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

      {/* Unsaved changes reminder */}
      {isDirty && isSaveReminderVisible && !saveReminderDismissedRef.current && (
        <div
          className="fixed bottom-24 right-6 z-50 w-[340px] max-w-[calc(100vw-3rem)] rounded-xl border border-border bg-background/95 backdrop-blur shadow-lg"
          role="status"
          aria-live="polite"
        >
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-accent/10 p-2 text-accent">
                <AlertCircle className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Don&apos;t forget to save your changes.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your updates won&apos;t be applied until you click Save.
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  saveReminderDismissedRef.current = true
                  setIsSaveReminderVisible(false)
                }}
              >
                Dismiss
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleSaveSettings()}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save now"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="sticky bottom-4 z-10 rounded-lg bg-background/80 backdrop-blur border border-border/50 px-4 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-muted-foreground font-sans">
            {isDirty ? (
              <span className="font-medium text-foreground">You have unsaved changes.</span>
            ) : (
              <span>All changes saved.</span>
            )}
          </div>

          <Button
            onClick={handleSaveSettings}
            disabled={isSaving || !isDirty}
            className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/90"
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
      </div>
    </div>
  )
}
