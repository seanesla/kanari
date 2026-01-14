"use client"

import { Shield } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface SettingsPrivacySectionProps {
  localStorageOnly: boolean
  onLocalStorageOnlyChange: (checked: boolean) => void
}

export function SettingsPrivacySection({
  localStorageOnly,
  onLocalStorageOnlyChange,
}: SettingsPrivacySectionProps) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl p-6 transition-colors hover:bg-card/40">
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
            checked={localStorageOnly}
            onCheckedChange={onLocalStorageOnlyChange}
            aria-label="Local Storage Only"
          />
        </div>

        <p className="text-sm text-muted-foreground font-sans">
          Want to delete your data? Use the <span className="font-medium text-foreground">Account</span>{" "}
          section below to reset everything.
        </p>
      </div>
    </div>
  )
}
