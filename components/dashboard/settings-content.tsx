"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
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
import { Calendar, Key, Mic, Shield, AlertCircle, CheckCircle2, Paintbrush, Eye, EyeOff, Loader2, RefreshCw, Trash2, User } from "lucide-react"
import { useCalendar } from "@/hooks/use-calendar"
import { useClearAllData } from "@/hooks/use-storage"
import { GeminiMemorySection } from "./settings-gemini-memory"
import { ColorPicker } from "./color-picker"
import { FontPicker } from "./font-picker"
import { db } from "@/lib/storage/db"
import { verifyGeminiApiKey } from "@/lib/gemini/client"

export function SettingsContent() {
  const router = useRouter()
  const clearAllData = useClearAllData()

  const [settings, setSettings] = useState({
    enableNotifications: true,
    dailyReminder: false,
    enableVAD: true,
    autoScheduleRecovery: false,
    localStorageOnly: true,
  })

  // Gemini API key state
  const [geminiApiKey, setGeminiApiKey] = useState("")

  // Reset dialog state
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKeyStatus, setApiKeyStatus] = useState<"idle" | "valid" | "invalid" | "checking">("idle")
  const [apiKeyError, setApiKeyError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Load settings from IndexedDB on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const savedSettings = await db.settings.get("default")
        if (savedSettings?.geminiApiKey) {
          setGeminiApiKey(savedSettings.geminiApiKey)
          // Don't auto-validate on load - user needs to verify
          setApiKeyStatus("idle")
        }
      } catch (error) {
        console.error("Failed to load settings:", error)
      }
    }
    loadSettings()
  }, [])

  // Reset status when API key changes
  const handleApiKeyChange = useCallback((value: string) => {
    setGeminiApiKey(value)
    setSaveMessage(null)
    setApiKeyError(null)
    setApiKeyStatus("idle")
  }, [])

  // Verify API key with Google
  const handleVerifyApiKey = useCallback(async () => {
    if (!geminiApiKey.trim()) {
      setApiKeyError("API key is required")
      return
    }

    setApiKeyStatus("checking")
    setApiKeyError(null)

    const result = await verifyGeminiApiKey(geminiApiKey)

    if (result.valid) {
      setApiKeyStatus("valid")
    } else {
      setApiKeyStatus("invalid")
      setApiKeyError(result.error || "Invalid API key")
    }
  }, [geminiApiKey])

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
        // Always set id and API key
        id: "default" as const,
        geminiApiKey: geminiApiKey || undefined,
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
  }, [settings, geminiApiKey])

  // Modify onboarding - restart onboarding flow while keeping data
  const handleModifyOnboarding = useCallback(async () => {
    try {
      const existingSettings = await db.settings.get("default")
      if (existingSettings) {
        await db.settings.update("default", {
          hasCompletedOnboarding: false,
          onboardingCompletedAt: undefined,
        })
      }
      router.push("/onboarding")
    } catch (error) {
      console.error("Failed to modify onboarding:", error)
    }
  }, [router])

  // Reset all data - clear everything and restart onboarding
  const handleResetAllData = useCallback(async () => {
    setIsResetting(true)
    try {
      // Clear all user data
      await clearAllData()

      // Delete settings entirely (will be recreated during onboarding)
      await db.settings.delete("default")

      // Clear sessionStorage (OAuth tokens, dedup hashes)
      sessionStorage.clear()

      // Redirect to onboarding
      router.push("/onboarding")
    } catch (error) {
      console.error("Failed to reset data:", error)
      setIsResetting(false)
    }
  }, [clearAllData, router])

  const { isConnected, isLoading, error, connect, disconnect, clearError } = useCalendar()
  const [showSuccess, setShowSuccess] = useState(false)

  // Check for OAuth callback success message
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("calendar_connected") === "true") {
      setShowSuccess(true)
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname)

      // Hide success message after 5 seconds
      const timer = setTimeout(() => setShowSuccess(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [])

  return (
    <div className="w-full space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 auto-rows-max">
        {/* Recording Preferences */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Mic className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold font-serif">Recording Preferences</h2>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="enable-vad" className="text-base font-sans">
                  Voice Activity Detection
                </Label>
                <p className="text-sm text-muted-foreground font-sans">
                  Only analyze speech segments, filtering out silence and noise
                </p>
              </div>
              <Switch
                id="enable-vad"
                checked={settings.enableVAD}
                onCheckedChange={(checked) => setSettings({ ...settings, enableVAD: checked })}
              />
            </div>

            <div>
              <Label className="text-base font-sans">Default Recording Duration</Label>
              <p className="text-sm text-muted-foreground mb-3 font-sans">Recommended duration for voice check-ins</p>
              <select className="h-10 w-32 rounded-md border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent font-sans">
                <option value="30">30 seconds</option>
                <option value="45">45 seconds</option>
                <option value="60">60 seconds</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-6 text-lg font-semibold font-serif">Notifications</h2>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="enable-notifications" className="text-base font-sans">
                  Browser Notifications
                </Label>
                <p className="text-sm text-muted-foreground font-sans">Receive alerts for elevated stress or recovery suggestions</p>
              </div>
              <Switch
                id="enable-notifications"
                checked={settings.enableNotifications}
                onCheckedChange={(checked) => setSettings({ ...settings, enableNotifications: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="daily-reminder" className="text-base font-sans">
                  Daily Reminder
                </Label>
                <p className="text-sm text-muted-foreground font-sans">Get a reminder to record your daily check-in</p>
              </div>
              <Switch
                id="daily-reminder"
                checked={settings.dailyReminder}
                onCheckedChange={(checked) => setSettings({ ...settings, dailyReminder: checked })}
              />
            </div>
          </div>
        </div>

        {/* Privacy */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold font-serif">Privacy</h2>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="local-storage" className="text-base font-sans">
                  Local Storage Only
                </Label>
                <p className="text-sm text-muted-foreground font-sans">
                  Store all data locally in your browser. No cloud sync.
                </p>
              </div>
              <Switch
                id="local-storage"
                checked={settings.localStorageOnly}
                onCheckedChange={(checked) => setSettings({ ...settings, localStorageOnly: checked })}
              />
            </div>

            <Button variant="outline" className="w-full bg-transparent text-destructive hover:bg-destructive/10">
              Clear All Data
            </Button>
          </div>
        </div>

        {/* Appearance */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Paintbrush className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold font-serif">Appearance</h2>
          </div>

          <ColorPicker />

          <div className="mt-6 pt-6 border-t border-border">
            <FontPicker />
          </div>
        </div>

        {/* Account */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <User className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold font-serif">Account</h2>
          </div>

          <div className="space-y-6">
            {/* Modify Onboarding */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                <Label className="text-base font-sans">Modify Onboarding</Label>
              </div>
              <p className="text-sm text-muted-foreground mb-3 font-sans">
                Go through the onboarding steps again without losing your recordings or data.
              </p>
              <Button
                variant="outline"
                onClick={handleModifyOnboarding}
                disabled={isSaving || isResetting}
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Restart Onboarding
              </Button>
            </div>

            {/* Reset All Data */}
            <div className="pt-4 border-t border-border">
              <div className="flex items-center gap-2 mb-2">
                <Trash2 className="h-4 w-4 text-destructive" />
                <Label className="text-base font-sans text-destructive">Reset All Data</Label>
              </div>
              <p className="text-sm text-muted-foreground mb-3 font-sans">
                Permanently delete all your recordings, suggestions, and settings. This cannot be undone.
              </p>
              <Button
                variant="outline"
                onClick={() => setShowResetDialog(true)}
                disabled={isSaving || isResetting}
                className="w-full bg-transparent text-destructive hover:bg-destructive/10 border-destructive/50"
              >
                {isResetting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Reset All Data
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Calendar Integration */}
        <div className="md:col-span-2 rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Calendar className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold font-serif">Calendar Integration</h2>
          </div>

          <div className="space-y-6">
            {/* Success Message */}
            {showSuccess && (
              <div className="rounded-lg bg-success/10 border border-success/20 p-4">
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-5 w-5" />
                  <p className="font-medium">Google Calendar connected successfully!</p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-destructive">Calendar connection error</p>
                    <p className="text-sm text-destructive/80 mt-1">{error}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearError}
                    className="text-destructive hover:text-destructive"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="auto-schedule" className="text-base font-sans">
                  Auto-Schedule Recovery
                </Label>
                <p className="text-sm text-muted-foreground font-sans">
                  Automatically add recovery blocks to your calendar when stress is elevated
                </p>
              </div>
              <Switch
                id="auto-schedule"
                checked={settings.autoScheduleRecovery}
                onCheckedChange={(checked) => setSettings({ ...settings, autoScheduleRecovery: checked })}
                disabled={!isConnected}
              />
            </div>

            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-2 w-2 rounded-full ${isConnected ? "bg-success" : "bg-muted"}`}
                  />
                  <span className="font-sans">Google Calendar</span>
                  <span className="text-xs text-muted-foreground font-sans">
                    {isConnected ? "(Connected)" : "(Not connected)"}
                  </span>
                </div>
                {isConnected ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => disconnect()}
                    disabled={isLoading}
                  >
                    {isLoading ? "Disconnecting..." : "Disconnect"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => connect()}
                    disabled={isLoading}
                  >
                    {isLoading ? "Connecting..." : "Connect"}
                  </Button>
                )}
              </div>
            </div>

            {isConnected && (
              <div className="text-sm text-muted-foreground font-sans">
                <p className="mb-2 font-medium">What happens when you schedule recovery blocks:</p>
                <ul className="space-y-1 ml-4">
                  <li className="list-disc">
                    Events are created in your primary Google Calendar
                  </li>
                  <li className="list-disc">
                    Recovery blocks are scheduled during available time slots
                  </li>
                  <li className="list-disc">
                    You'll receive reminders 10 and 30 minutes before each block
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* API Configuration */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Key className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold font-serif">Gemini API</h2>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-base font-sans">API Key</Label>
              <p className="text-sm text-muted-foreground mb-3 font-sans">
                Required for personalized suggestions. Get one from{" "}
                <a
                  href="https://aistudio.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  Google AI Studio
                </a>
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={geminiApiKey}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    placeholder="Enter your Gemini API key (starts with AIza...)"
                    className={`h-10 w-full rounded-md border bg-background px-3 pr-10 text-sm focus:outline-none focus:ring-1 font-sans ${
                      apiKeyStatus === "valid"
                        ? "border-green-500 focus:border-green-500 focus:ring-green-500"
                        : apiKeyStatus === "invalid"
                        ? "border-destructive focus:border-destructive focus:ring-destructive"
                        : "border-border focus:border-accent focus:ring-accent"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showApiKey ? "Hide API key" : "Show API key"}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  variant="outline"
                  onClick={handleVerifyApiKey}
                  disabled={!geminiApiKey.trim() || apiKeyStatus === "checking" || apiKeyStatus === "valid"}
                >
                  {apiKeyStatus === "checking" ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : apiKeyStatus === "valid" ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Verified
                    </>
                  ) : (
                    "Verify"
                  )}
                </Button>
              </div>
              {/* Validation feedback */}
              {apiKeyStatus === "valid" && (
                <p className="mt-2 text-sm text-green-500 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  API key verified successfully!
                </p>
              )}
              {apiKeyError && (
                <p className="mt-2 text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {apiKeyError}
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground font-sans">
                Your API key is stored locally in your browser and never sent to our servers.
              </p>
            </div>
          </div>
        </div>

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

      {/* Reset All Data Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset All Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all your recordings, suggestions, trends, and settings.
              You&apos;ll be taken through the onboarding process again as a new user.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetAllData}
              disabled={isResetting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isResetting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                "Reset Everything"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
