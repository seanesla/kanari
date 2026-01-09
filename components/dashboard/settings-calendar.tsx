"use client"

import { Calendar } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface SettingsCalendarSectionProps {
  autoScheduleRecovery: boolean
  onAutoScheduleRecoveryChange: (checked: boolean) => void
}

export function SettingsCalendarSection({
  autoScheduleRecovery,
  onAutoScheduleRecoveryChange,
}: SettingsCalendarSectionProps) {
  return (
    <div className="md:col-span-2 rounded-lg border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-6">
        <Calendar className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold font-serif">Calendar Settings</h2>
      </div>

      <div className="space-y-6">
        {/* Local Calendar Status */}
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-success" />
            <span className="font-sans">Local Calendar</span>
            <span className="text-xs text-muted-foreground font-sans">(Active)</span>
          </div>
        </div>

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
            checked={autoScheduleRecovery}
            onCheckedChange={onAutoScheduleRecoveryChange}
          />
        </div>

        <div className="text-sm text-muted-foreground font-sans">
          <p className="mb-2 font-medium">What happens when you schedule recovery blocks:</p>
          <ul className="space-y-1 ml-4">
            <li className="list-disc">
              Events are displayed in your local calendar view
            </li>
            <li className="list-disc">
              Recovery blocks are scheduled during your preferred time slots
            </li>
            <li className="list-disc">
              You can drag and drop events to reschedule them
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

