"use client"

import { Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
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
            checked={localStorageOnly}
            onCheckedChange={onLocalStorageOnlyChange}
          />
        </div>

        <Button variant="outline" className="w-full bg-transparent text-destructive hover:bg-destructive/10">
          Clear All Data
        </Button>
      </div>
    </div>
  )
}

