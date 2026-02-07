"use client"

import { useEffect, useMemo, useCallback, useRef, useState } from "react"
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
import { SettingsAccountSection } from "./settings-account"
import { SettingsApiSection } from "./settings-api"
import { SettingsAccountabilitySection } from "./settings-accountability-section"
import { SettingsAppearanceSection } from "./settings-appearance"
import { SettingsNotificationsSection } from "./settings-notifications"
import { SettingsTimeZoneSection } from "./settings-timezone"
import { SettingsVoiceSection } from "./settings-voice-section"
import { SettingsProfileSection } from "./settings-profile-section"
import { SettingsBiomarkersSection } from "./settings-biomarkers-section"
import { SettingsGraphicsSection } from "./settings-graphics"
import { Deck } from "@/components/dashboard/deck"
import { db } from "@/lib/storage/db"
import { DEFAULT_USER_SETTINGS } from "@/lib/settings/default-settings"
import { patchSettings } from "@/lib/settings/patch-settings"
import { setDisableStartupAnimationSync } from "@/lib/scene-context"
import { useSceneMode } from "@/lib/scene-context"
import { useTimeZone } from "@/lib/timezone-context"
import { normalizeGraphicsQuality } from "@/lib/graphics/quality"
import { Globe2, User } from "@/lib/icons"
import type { AccountabilityMode, FontFamily, GeminiVoice, GraphicsQuality, SerifFamily, UserSettings } from "@/lib/types"

// Pattern doc: docs/error-patterns/settings-schema-drift-and-partial-save.md
type SettingsDraft = Pick<
  UserSettings,
  | "userName"
  | "enableNotifications"
  | "dailyReminderTime"
  | "timeZone"
  | "autoScheduleRecovery"
  | "localStorageOnly"
  | "shareJournalWithAi"
  | "geminiApiKey"
  | "geminiApiKeySource"
  | "selectedGeminiVoice"
  | "accountabilityMode"
  | "accentColor"
  | "selectedSansFont"
  | "selectedSerifFont"
  | "disableStartupAnimation"
  | "graphicsQuality"
>

const DEFAULT_DRAFT: SettingsDraft = {
  userName: DEFAULT_USER_SETTINGS.userName,
  enableNotifications: DEFAULT_USER_SETTINGS.enableNotifications,
  dailyReminderTime: DEFAULT_USER_SETTINGS.dailyReminderTime,
  timeZone: DEFAULT_USER_SETTINGS.timeZone,
  autoScheduleRecovery: DEFAULT_USER_SETTINGS.autoScheduleRecovery,
  localStorageOnly: DEFAULT_USER_SETTINGS.localStorageOnly,
  shareJournalWithAi: DEFAULT_USER_SETTINGS.shareJournalWithAi,
  geminiApiKey: DEFAULT_USER_SETTINGS.geminiApiKey,
  geminiApiKeySource: DEFAULT_USER_SETTINGS.geminiApiKeySource,
  selectedGeminiVoice: DEFAULT_USER_SETTINGS.selectedGeminiVoice,
  accountabilityMode: DEFAULT_USER_SETTINGS.accountabilityMode,
  accentColor: DEFAULT_USER_SETTINGS.accentColor,
  selectedSansFont: DEFAULT_USER_SETTINGS.selectedSansFont,
  selectedSerifFont: DEFAULT_USER_SETTINGS.selectedSerifFont,
  disableStartupAnimation: DEFAULT_USER_SETTINGS.disableStartupAnimation,
  graphicsQuality: DEFAULT_USER_SETTINGS.graphicsQuality,
}

export function SettingsContent() {
  const [draft, setDraft] = useState<SettingsDraft>(() => ({ ...DEFAULT_DRAFT }))

  const [baseline, setBaseline] = useState<SettingsDraft | null>(null)

  const baselineRef = useRef<SettingsDraft | null>(null)
  const { previewAccentColor, previewSansFont, previewSerifFont, previewGraphicsQuality } = useSceneMode()
  const { setTimeZone: setTimeZoneInContext } = useTimeZone()
  useEffect(() => {
    baselineRef.current = baseline
  }, [baseline])

  // If user leaves Settings with unsaved appearance changes, revert previews.
  useEffect(() => {
    return () => {
      const saved = baselineRef.current
      if (!saved) return

      if (saved.accentColor) previewAccentColor(saved.accentColor)
      if (saved.selectedSansFont) previewSansFont(saved.selectedSansFont)
      if (saved.selectedSerifFont) previewSerifFont(saved.selectedSerifFont)
      if (saved.graphicsQuality) previewGraphicsQuality(saved.graphicsQuality)
    }
  }, [previewAccentColor, previewSansFont, previewSerifFont, previewGraphicsQuality])

  // Render the floating save bar into <body> so it's not affected by any
  // parent transforms (e.g. translate-y entry animations on the Settings page).
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setPortalRoot(document.body)
  }, [previewAccentColor, previewSansFont, previewSerifFont, previewGraphicsQuality])

  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const saveMessageTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (saveMessageTimeoutRef.current !== null) {
        window.clearTimeout(saveMessageTimeoutRef.current)
        saveMessageTimeoutRef.current = null
      }
    }
  }, [])

  // Load settings from IndexedDB on mount
  useEffect(() => {
    const fallback: SettingsDraft = { ...DEFAULT_DRAFT }

    async function loadSettings() {
      try {
        const savedSettings = await db.settings.get("default")

        const rawGraphicsQuality = (savedSettings as { graphicsQuality?: unknown })?.graphicsQuality
        const normalizedGraphicsQuality =
          rawGraphicsQuality === undefined
            ? DEFAULT_USER_SETTINGS.graphicsQuality
            : normalizeGraphicsQuality(rawGraphicsQuality)

        // Migrate legacy stored value ("static" -> "medium") once.
        if (rawGraphicsQuality === "static") {
          void patchSettings({ graphicsQuality: normalizedGraphicsQuality }).catch((error) => {
            console.warn("Failed to migrate graphics quality:", error)
          })
        }

        const hydrated: SettingsDraft = {
          userName: savedSettings?.userName ?? DEFAULT_USER_SETTINGS.userName,
          enableNotifications: savedSettings?.enableNotifications ?? DEFAULT_USER_SETTINGS.enableNotifications,
          dailyReminderTime: savedSettings?.dailyReminderTime,
          timeZone: savedSettings?.timeZone ?? DEFAULT_USER_SETTINGS.timeZone,
          autoScheduleRecovery: savedSettings?.autoScheduleRecovery ?? DEFAULT_USER_SETTINGS.autoScheduleRecovery,
          localStorageOnly: savedSettings?.localStorageOnly ?? DEFAULT_USER_SETTINGS.localStorageOnly,
          shareJournalWithAi: savedSettings?.shareJournalWithAi ?? DEFAULT_USER_SETTINGS.shareJournalWithAi,
          geminiApiKey: savedSettings?.geminiApiKey,
          geminiApiKeySource: savedSettings?.geminiApiKeySource ?? DEFAULT_USER_SETTINGS.geminiApiKeySource,
          selectedGeminiVoice: savedSettings?.selectedGeminiVoice as GeminiVoice | undefined,
          accountabilityMode: (savedSettings?.accountabilityMode as AccountabilityMode | undefined) ?? DEFAULT_USER_SETTINGS.accountabilityMode,
          accentColor: savedSettings?.accentColor ?? DEFAULT_USER_SETTINGS.accentColor,
          selectedSansFont: (savedSettings?.selectedSansFont as FontFamily | undefined) ?? DEFAULT_USER_SETTINGS.selectedSansFont,
          selectedSerifFont: (savedSettings?.selectedSerifFont as SerifFamily | undefined) ?? DEFAULT_USER_SETTINGS.selectedSerifFont,
          disableStartupAnimation: savedSettings?.disableStartupAnimation ?? DEFAULT_USER_SETTINGS.disableStartupAnimation,
          graphicsQuality: normalizedGraphicsQuality,
        }

        // Apply the saved appearance immediately so the page matches the stored settings.
        if (hydrated.accentColor) previewAccentColor(hydrated.accentColor)
        if (hydrated.selectedSansFont) previewSansFont(hydrated.selectedSansFont)
        if (hydrated.selectedSerifFont) previewSerifFont(hydrated.selectedSerifFont)
        if (hydrated.graphicsQuality) previewGraphicsQuality(hydrated.graphicsQuality)

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
    const geminiApiKeySource = draft.geminiApiKeySource === "kanari" ? "kanari" : "user"
    const graphicsQuality = draft.graphicsQuality ?? DEFAULT_USER_SETTINGS.graphicsQuality
    return {
      ...draft,
      userName: trimmedName.length > 0 ? trimmedName : undefined,
      geminiApiKey: trimmedKey.length > 0 ? trimmedKey : undefined,
      geminiApiKeySource,
      dailyReminderTime: draft.dailyReminderTime ? draft.dailyReminderTime : undefined,
      selectedGeminiVoice: draft.selectedGeminiVoice ?? undefined,
      accountabilityMode: draft.accountabilityMode ?? DEFAULT_USER_SETTINGS.accountabilityMode,
      graphicsQuality,
    }
  }, [draft])

  const isDirty = useMemo(() => {
    if (!baseline) return false
    return (
      baseline.userName !== normalizedDraft.userName ||
      baseline.enableNotifications !== normalizedDraft.enableNotifications ||
      baseline.dailyReminderTime !== normalizedDraft.dailyReminderTime ||
      baseline.timeZone !== normalizedDraft.timeZone ||
      baseline.autoScheduleRecovery !== normalizedDraft.autoScheduleRecovery ||
      baseline.localStorageOnly !== normalizedDraft.localStorageOnly ||
      baseline.shareJournalWithAi !== normalizedDraft.shareJournalWithAi ||
      baseline.geminiApiKey !== normalizedDraft.geminiApiKey ||
      baseline.geminiApiKeySource !== normalizedDraft.geminiApiKeySource ||
      baseline.selectedGeminiVoice !== normalizedDraft.selectedGeminiVoice ||
      baseline.accountabilityMode !== normalizedDraft.accountabilityMode ||
      baseline.accentColor !== normalizedDraft.accentColor ||
      baseline.selectedSansFont !== normalizedDraft.selectedSansFont ||
      baseline.selectedSerifFont !== normalizedDraft.selectedSerifFont ||
      baseline.disableStartupAnimation !== normalizedDraft.disableStartupAnimation ||
      baseline.graphicsQuality !== normalizedDraft.graphicsQuality
    )
  }, [baseline, normalizedDraft])

  // Save settings to IndexedDB
  const handleSaveSettings = useCallback(async () => {
    if (!normalizedDraft.userName) {
      setSaveMessage({ type: "error", text: "Please enter your name to save settings." })
      // Best-effort focus so the fix is obvious.
      document.getElementById("user-name")?.focus()
      return
    }

    setIsSaving(true)
    setSaveMessage(null)
    try {
      const updates: Partial<UserSettings> = {
        userName: normalizedDraft.userName,
        enableNotifications: normalizedDraft.enableNotifications,
        dailyReminderTime: normalizedDraft.dailyReminderTime,
        timeZone: normalizedDraft.timeZone,
        autoScheduleRecovery: normalizedDraft.autoScheduleRecovery,
        localStorageOnly: normalizedDraft.localStorageOnly,
        shareJournalWithAi: normalizedDraft.shareJournalWithAi,
        geminiApiKey: normalizedDraft.geminiApiKey,
        geminiApiKeySource: normalizedDraft.geminiApiKeySource,
        selectedGeminiVoice: normalizedDraft.selectedGeminiVoice,
        accountabilityMode: normalizedDraft.accountabilityMode,
        accentColor: normalizedDraft.accentColor,
        selectedSansFont: normalizedDraft.selectedSansFont,
        selectedSerifFont: normalizedDraft.selectedSerifFont,
        disableStartupAnimation: normalizedDraft.disableStartupAnimation,
        graphicsQuality: normalizedDraft.graphicsQuality,
      }

      await patchSettings(updates)

      // Sync animation preference to localStorage for instant access on next page load
      setDisableStartupAnimationSync(normalizedDraft.disableStartupAnimation ?? false)

      // Apply time zone immediately (provider does its own persistence too).
      if (normalizedDraft.timeZone) {
        setTimeZoneInContext(normalizedDraft.timeZone)
      }

      setBaseline(normalizedDraft)
      setSaveMessage({ type: "success", text: "Settings saved successfully!" })
      // Clear success message after 3 seconds
      if (saveMessageTimeoutRef.current !== null) {
        window.clearTimeout(saveMessageTimeoutRef.current)
      }
      saveMessageTimeoutRef.current = window.setTimeout(() => {
        setSaveMessage(null)
        saveMessageTimeoutRef.current = null
      }, 3000)
    } catch (error) {
      console.error("Failed to save settings:", error)
      setSaveMessage({ type: "error", text: "Failed to save settings. Please try again." })
    } finally {
      setIsSaving(false)
    }
  }, [normalizedDraft, setTimeZoneInContext])

  const handleResetToDefaults = useCallback(() => {
    setShowResetConfirm(false)
    // Name is mandatory; keep the currently-saved name when resetting.
    setDraft({ ...DEFAULT_DRAFT, userName: baselineRef.current?.userName })
    setSaveMessage(null)

    // Preview defaults (still requires Save to persist).
    if (DEFAULT_DRAFT.accentColor) previewAccentColor(DEFAULT_DRAFT.accentColor)
    if (DEFAULT_DRAFT.selectedSansFont) previewSansFont(DEFAULT_DRAFT.selectedSansFont)
    if (DEFAULT_DRAFT.selectedSerifFont) previewSerifFont(DEFAULT_DRAFT.selectedSerifFont)
    if (DEFAULT_DRAFT.graphicsQuality) previewGraphicsQuality(DEFAULT_DRAFT.graphicsQuality)
  }, [previewAccentColor, previewSansFont, previewSerifFont, previewGraphicsQuality])

  return (
    <div className={`w-full space-y-6 ${isDirty ? "pb-24" : ""}`}>
      {/* Pattern doc: docs/error-patterns/settings-grid-orphan-cell-from-mixed-column-spans.md */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 auto-rows-max">
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

        <SettingsBiomarkersSection />

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

        <SettingsAppearanceSection
          accentColor={draft.accentColor ?? DEFAULT_USER_SETTINGS.accentColor ?? "#d4a574"}
          onAccentColorChange={(color) => {
            setDraft((prev) => ({ ...prev, accentColor: color }))
            setSaveMessage(null)
            previewAccentColor(color)
          }}
          selectedSansFont={(draft.selectedSansFont ?? DEFAULT_USER_SETTINGS.selectedSansFont ?? "Instrument Sans") as FontFamily}
          onSansFontChange={(font) => {
            setDraft((prev) => ({ ...prev, selectedSansFont: font }))
            setSaveMessage(null)
            previewSansFont(font)
          }}
          selectedSerifFont={(draft.selectedSerifFont ?? DEFAULT_USER_SETTINGS.selectedSerifFont ?? "Merriweather") as SerifFamily}
          onSerifFontChange={(font) => {
            setDraft((prev) => ({ ...prev, selectedSerifFont: font }))
            setSaveMessage(null)
            previewSerifFont(font)
          }}
          disableStartupAnimation={draft.disableStartupAnimation ?? false}
          onDisableStartupAnimationChange={(checked) => {
            setDraft((prev) => ({ ...prev, disableStartupAnimation: checked }))
            setSaveMessage(null)
          }}
        />

        <SettingsGraphicsSection
          graphicsQuality={(draft.graphicsQuality ?? DEFAULT_USER_SETTINGS.graphicsQuality ?? "auto") as GraphicsQuality}
          onGraphicsQualityChange={(quality: GraphicsQuality) => {
            setDraft((prev) => ({ ...prev, graphicsQuality: quality }))
            setSaveMessage(null)
            previewGraphicsQuality(quality)
          }}
        />

        <Deck className="md:col-span-2 p-6 transition-colors hover:bg-card/80">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <Globe2 className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-semibold font-serif">Time Zone</h2>
              </div>

              <SettingsTimeZoneSection
                embedded
                timeZone={draft.timeZone ?? DEFAULT_USER_SETTINGS.timeZone ?? "UTC"}
                onTimeZoneChange={(timeZone) => {
                  setDraft((prev) => ({ ...prev, timeZone }))
                  setSaveMessage(null)
                }}
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-6">
                <User className="h-5 w-5 text-accent" />
                <h2 className="text-lg font-semibold font-serif">Account</h2>
              </div>

              <SettingsAccountSection
                embedded
                isSaving={isSaving}
                localStorageOnly={draft.localStorageOnly}
                onLocalStorageOnlyChange={(checked) => {
                  setDraft((prev) => ({ ...prev, localStorageOnly: checked }))
                  setSaveMessage(null)
                }}
                shareJournalWithAi={draft.shareJournalWithAi}
                onShareJournalWithAiChange={(checked: boolean) => {
                  setDraft((prev) => ({ ...prev, shareJournalWithAi: checked }))
                  setSaveMessage(null)
                }}
              />
            </div>
          </div>
        </Deck>

        <div className="md:col-span-2">
          <SettingsApiSection
            geminiApiKey={draft.geminiApiKey ?? ""}
            geminiApiKeySource={(draft.geminiApiKeySource ?? DEFAULT_USER_SETTINGS.geminiApiKeySource ?? "user")}
            onGeminiApiKeyChange={(value) => {
              setDraft((prev) => ({ ...prev, geminiApiKey: value }))
              setSaveMessage(null)
            }}
            onGeminiApiKeySourceChange={(value) => {
              setDraft((prev) => ({ ...prev, geminiApiKeySource: value }))
              setSaveMessage(null)
            }}
          />
        </div>

      </div>

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

      {/* Floating Save / Status Bar */}
      {portalRoot && (isDirty || saveMessage)
        ? createPortal(
            <div className="pointer-events-none fixed left-1/2 top-auto bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-50 w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2">
              <Deck className="pointer-events-auto px-4 py-3">
                <div className="flex items-center justify-between gap-4 w-full" role="status" aria-live="polite">
                  <div className="flex items-center gap-2 text-sm">
                    {saveMessage ? (
                      saveMessage.type === "success" ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="font-medium text-green-500">{saveMessage.text}</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 text-destructive" />
                          <span className="font-medium text-destructive">{saveMessage.text}</span>
                        </>
                      )
                    ) : isDirty && !normalizedDraft.userName ? (
                      <>
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        <span className="font-medium text-destructive">Your name is required.</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-accent" />
                        <span className="font-medium">You have unsaved changes</span>
                      </>
                    )}
                  </div>

                  {isDirty ? (
                    <Button
                      onClick={handleSaveSettings}
                      disabled={isSaving || !normalizedDraft.userName}
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
                  ) : null}
                </div>
              </Deck>
            </div>,
            portalRoot
          )
        : null}
    </div>
  )
}
