"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Calendar, Key, Mic, Shield, Loader2, Check } from "lucide-react"
import { useSettings, useSettingsActions, useEncryption, useCalendarConnection } from "@/hooks/use-settings"
import { useClearAllData } from "@/hooks/use-storage"
import { useToast } from "@/hooks/use-toast"

export function SettingsContent() {
  const { settings, isLoading } = useSettings()
  const { updateSettings } = useSettingsActions()
  const { isEncryptionAvailable, hasEncryptionKey, enableEncryption, disableEncryption } = useEncryption()
  const { isConnected: isCalendarConnected } = useCalendarConnection()
  const clearAllData = useClearAllData()
  const { toast } = useToast()

  const [isSaving, setIsSaving] = useState(false)
  const [geminiApiKey, setGeminiApiKey] = useState("")

  // Load API key from localStorage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem("kanari_gemini_api_key")
    if (storedKey) {
      setGeminiApiKey(storedKey)
    }
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Save Gemini API key to localStorage
      if (geminiApiKey) {
        localStorage.setItem("kanari_gemini_api_key", geminiApiKey)
      } else {
        localStorage.removeItem("kanari_gemini_api_key")
      }

      toast({
        title: "Settings saved",
        description: "Your preferences have been updated.",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleClearData = async () => {
    if (!confirm("Are you sure you want to delete all your data? This cannot be undone.")) {
      return
    }

    try {
      await clearAllData()
      localStorage.removeItem("kanari_gemini_api_key")
      localStorage.removeItem("kanari_encryption_key")
      localStorage.removeItem("kanari_calendar_tokens")
      setGeminiApiKey("")

      toast({
        title: "Data cleared",
        description: "All your data has been deleted.",
      })
    } catch {
      toast({
        title: "Error",
        description: "Failed to clear data. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleEncryptionToggle = async (enabled: boolean) => {
    try {
      if (enabled) {
        await enableEncryption()
        toast({
          title: "Encryption enabled",
          description: "Your data will now be encrypted.",
        })
      } else {
        await disableEncryption()
        toast({
          title: "Encryption disabled",
          description: "New data will not be encrypted.",
        })
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to toggle encryption.",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Recording Preferences */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-6">
          <Mic className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold">Recording Preferences</h2>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enable-vad" className="text-base">
                Voice Activity Detection
              </Label>
              <p className="text-sm text-muted-foreground">
                Only analyze speech segments, filtering out silence and noise
              </p>
            </div>
            <Switch
              id="enable-vad"
              checked={settings.enableVAD}
              onCheckedChange={(checked) => updateSettings({ enableVAD: checked })}
            />
          </div>

          <div>
            <Label className="text-base">Default Recording Duration</Label>
            <p className="text-sm text-muted-foreground mb-3">Recommended duration for voice check-ins</p>
            <select
              value={settings.defaultRecordingDuration}
              onChange={(e) => updateSettings({ defaultRecordingDuration: Number(e.target.value) })}
              className="h-10 w-32 rounded-md border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="30">30 seconds</option>
              <option value="45">45 seconds</option>
              <option value="60">60 seconds</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-6 text-lg font-semibold">Notifications</h2>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enable-notifications" className="text-base">
                Browser Notifications
              </Label>
              <p className="text-sm text-muted-foreground">Receive alerts for elevated stress or recovery suggestions</p>
            </div>
            <Switch
              id="enable-notifications"
              checked={settings.enableNotifications}
              onCheckedChange={(checked) => updateSettings({ enableNotifications: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="daily-reminder" className="text-base">
                Daily Reminder
              </Label>
              <p className="text-sm text-muted-foreground">Get a reminder to record your daily check-in</p>
            </div>
            <Switch
              id="daily-reminder"
              checked={!!settings.dailyReminderTime}
              onCheckedChange={(checked) =>
                updateSettings({ dailyReminderTime: checked ? "09:00" : undefined })
              }
            />
          </div>
        </div>
      </div>

      {/* Calendar Integration */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold">Calendar Integration</h2>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto-schedule" className="text-base">
                Auto-Schedule Recovery
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically add recovery blocks to your calendar when stress is elevated
              </p>
            </div>
            <Switch
              id="auto-schedule"
              checked={settings.autoScheduleRecovery}
              onCheckedChange={(checked) => updateSettings({ autoScheduleRecovery: checked })}
              disabled={!isCalendarConnected}
            />
          </div>

          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-2 w-2 rounded-full ${isCalendarConnected ? "bg-success" : "bg-muted"}`} />
                <span>Google Calendar</span>
                <span className="text-xs text-muted-foreground">
                  {isCalendarConnected ? "(Connected)" : "(Not connected)"}
                </span>
              </div>
              <Button variant="outline" size="sm" disabled>
                {isCalendarConnected ? "Disconnect" : "Connect"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Calendar integration will be available after completing the Calendar workstream.
            </p>
          </div>
        </div>
      </div>

      {/* API Configuration */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-6">
          <Key className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold">Gemini API</h2>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-base">API Key</Label>
            <p className="text-sm text-muted-foreground mb-3">
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
            <div className="relative">
              <input
                type="password"
                placeholder="Enter your Gemini API key"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 pr-10 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              {geminiApiKey && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-success" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Privacy */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-6">
          <Shield className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold">Privacy</h2>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="local-storage" className="text-base">
                Local Storage Only
              </Label>
              <p className="text-sm text-muted-foreground">
                Store all data locally in your browser. No cloud sync.
              </p>
            </div>
            <Switch
              id="local-storage"
              checked={settings.localStorageOnly}
              onCheckedChange={(checked) => updateSettings({ localStorageOnly: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="encryption" className="text-base">
                Encrypt Stored Data
              </Label>
              <p className="text-sm text-muted-foreground">
                Use AES-GCM encryption for all data stored in IndexedDB
              </p>
              {!isEncryptionAvailable && (
                <p className="text-xs text-destructive mt-1">
                  Web Crypto API not available in this browser
                </p>
              )}
            </div>
            <Switch
              id="encryption"
              checked={hasEncryptionKey}
              onCheckedChange={handleEncryptionToggle}
              disabled={!isEncryptionAvailable}
            />
          </div>

          <Button
            variant="outline"
            className="w-full bg-transparent text-destructive hover:bg-destructive/10"
            onClick={handleClearData}
          >
            Clear All Data
          </Button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          className="bg-accent text-accent-foreground hover:bg-accent/90"
          onClick={handleSave}
          disabled={isSaving}
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
