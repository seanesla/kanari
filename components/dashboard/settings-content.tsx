"use client"

import { useState, useEffect, useCallback } from "react"
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
import type { GeminiVoice } from "@/lib/types"

type DraftSettings = {
  enableNotifications: boolean
  dailyReminder: boolean
  enableVAD: boolean
  autoScheduleRecovery: boolean
  localStorageOnly: boolean
}

export function SettingsContent() {
  const [settings, setSettings] = useState<DraftSettings>({
    enableNotifications: true,
    dailyReminder: false,
    enableVAD: true,
    autoScheduleRecovery: false,
    localStorageOnly: true,
  })

  // Gemini API key state
  const [geminiApiKey, setGeminiApiKey] = useState("")

  // Gemini voice state
  const [selectedGeminiVoice, setSelectedGeminiVoice] = useState<GeminiVoice | undefined>(undefined)

  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Load settings from IndexedDB on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const savedSettings = await db.settings.get("default")
        if (savedSettings?.geminiApiKey) {
          setGeminiApiKey(savedSettings.geminiApiKey)
        }
        if (savedSettings?.selectedGeminiVoice) {
          setSelectedGeminiVoice(savedSettings.selectedGeminiVoice)
        }
      } catch (error) {
        console.error("Failed to load settings:", error)
      }
    }
    loadSettings()
  }, [])

  const handleApiKeyChange = useCallback((value: string) => {
    setGeminiApiKey(value)
    setSaveMessage(null)
  }, [])

  // Save settings to IndexedDB
  const handleSaveSettings = useCallback(async () => {
    setIsSaving(true)
    setSaveMessage(null)
    try {
      // Get existing settings or create new with defaults
      const existingSettings = await db.settings.get("default")

      // Build settings object with defaults, existing values, and current UI state
      const defaults = {
        defaultRecordingDuration: 30,
        calendarConnected: false,
        preferredRecoveryTimes: [] as string[],
      }

      const updatedSettings = {
        ...defaults,
        ...existingSettings,
        // Current UI state
        enableNotifications: settings.enableNotifications,
        dailyReminder: settings.dailyReminder,
        enableVAD: settings.enableVAD,
        autoScheduleRecovery: settings.autoScheduleRecovery,
        localStorageOnly: settings.localStorageOnly,
        // Always set id, API key, and voice
        id: "default" as const,
        geminiApiKey: geminiApiKey || undefined,
        selectedGeminiVoice: selectedGeminiVoice,
      }

      await db.settings.put(updatedSettings)
      setSaveMessage({ type: "success", text: "Settings saved successfully!" })
      // Clear success message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (error) {
      console.error("Failed to save settings:", error)
      setSaveMessage({ type: "error", text: "Failed to save settings. Please try again." })
    } finally {
      setIsSaving(false)
    }
  }, [settings, geminiApiKey, selectedGeminiVoice])

  return (
    <div className="w-full space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 auto-rows-max">
        <SettingsRecordingSection
          enableVAD={settings.enableVAD}
          onEnableVADChange={(checked) => setSettings({ ...settings, enableVAD: checked })}
        />

        <SettingsVoiceSection
          selectedVoice={selectedGeminiVoice}
          onVoiceChange={setSelectedGeminiVoice}
        />

        <SettingsNotificationsSection
          enableNotifications={settings.enableNotifications}
          dailyReminder={settings.dailyReminder}
          onEnableNotificationsChange={(checked) => setSettings({ ...settings, enableNotifications: checked })}
          onDailyReminderChange={(checked) => setSettings({ ...settings, dailyReminder: checked })}
        />

        <SettingsPrivacySection
          localStorageOnly={settings.localStorageOnly}
          onLocalStorageOnlyChange={(checked) => setSettings({ ...settings, localStorageOnly: checked })}
        />

        <SettingsAppearanceSection />

        <SettingsAccountSection isSaving={isSaving} />

        <SettingsCalendarSection
          autoScheduleRecovery={settings.autoScheduleRecovery}
          onAutoScheduleRecoveryChange={(checked) => setSettings({ ...settings, autoScheduleRecovery: checked })}
        />

        <SettingsApiSection
          geminiApiKey={geminiApiKey}
          onGeminiApiKeyChange={handleApiKeyChange}
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

      <div className="flex justify-end">
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
    </div>
  )
}
