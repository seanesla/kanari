"use client"

import { Mic } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface SettingsRecordingSectionProps {
  enableVAD: boolean
  onEnableVADChange: (checked: boolean) => void
  defaultRecordingDuration: number
  onDefaultRecordingDurationChange: (seconds: number) => void
}

export function SettingsRecordingSection({
  enableVAD,
  onEnableVADChange,
  defaultRecordingDuration,
  onDefaultRecordingDurationChange,
}: SettingsRecordingSectionProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-6">
        <Mic className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold font-serif">Check-in Preferences</h2>
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
            checked={enableVAD}
            onCheckedChange={onEnableVADChange}
            aria-label="Voice Activity Detection"
          />
        </div>

        <div>
          <Label htmlFor="default-check-in-duration" className="text-base font-sans">
            Default Check-in Duration
          </Label>
          <p className="text-sm text-muted-foreground mb-3 font-sans">
            Recommended duration for voice check-ins
          </p>
          <select
            id="default-check-in-duration"
            value={String(defaultRecordingDuration)}
            onChange={(e) => onDefaultRecordingDurationChange(Number(e.target.value))}
            className="h-10 w-32 rounded-md border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent font-sans"
          >
            <option value="30">30 seconds</option>
            <option value="45">45 seconds</option>
            <option value="60">60 seconds</option>
          </select>
        </div>
      </div>
    </div>
  )
}
