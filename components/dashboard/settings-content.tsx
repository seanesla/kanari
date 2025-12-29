"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Calendar, Key, Mic, Shield } from "lucide-react"

export function SettingsContent() {
  const [settings, setSettings] = useState({
    enableNotifications: true,
    dailyReminder: false,
    enableVAD: true,
    autoScheduleRecovery: false,
    localStorageOnly: true,
    encryptionEnabled: true,
  })

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
              onCheckedChange={(checked) => setSettings({ ...settings, enableVAD: checked })}
            />
          </div>

          <div>
            <Label className="text-base">Default Recording Duration</Label>
            <p className="text-sm text-muted-foreground mb-3">Recommended duration for voice check-ins</p>
            <select className="h-10 w-32 rounded-md border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent">
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
              onCheckedChange={(checked) => setSettings({ ...settings, enableNotifications: checked })}
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
              checked={settings.dailyReminder}
              onCheckedChange={(checked) => setSettings({ ...settings, dailyReminder: checked })}
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
              onCheckedChange={(checked) => setSettings({ ...settings, autoScheduleRecovery: checked })}
            />
          </div>

          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-muted" />
                <span>Google Calendar</span>
                <span className="text-xs text-muted-foreground">(Not connected)</span>
              </div>
              <Button variant="outline" size="sm">
                Connect
              </Button>
            </div>
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
            <input
              type="password"
              placeholder="Enter your Gemini API key"
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
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
              onCheckedChange={(checked) => setSettings({ ...settings, localStorageOnly: checked })}
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
            </div>
            <Switch
              id="encryption"
              checked={settings.encryptionEnabled}
              onCheckedChange={(checked) => setSettings({ ...settings, encryptionEnabled: checked })}
            />
          </div>

          <Button variant="outline" className="w-full bg-transparent text-destructive hover:bg-destructive/10">
            Clear All Data
          </Button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90">Save Changes</Button>
      </div>
    </div>
  )
}
