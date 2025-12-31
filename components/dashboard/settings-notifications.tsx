"use client"

import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface SettingsNotificationsSectionProps {
  enableNotifications: boolean
  dailyReminder: boolean
  onEnableNotificationsChange: (checked: boolean) => void
  onDailyReminderChange: (checked: boolean) => void
}

export function SettingsNotificationsSection({
  enableNotifications,
  dailyReminder,
  onEnableNotificationsChange,
  onDailyReminderChange,
}: SettingsNotificationsSectionProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-6 text-lg font-semibold font-serif">Notifications</h2>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="enable-notifications" className="text-base font-sans">
              Browser Notifications
            </Label>
            <p className="text-sm text-muted-foreground font-sans">
              Receive alerts for elevated stress or recovery suggestions
            </p>
          </div>
          <Switch
            id="enable-notifications"
            checked={enableNotifications}
            onCheckedChange={onEnableNotificationsChange}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="daily-reminder" className="text-base font-sans">
              Daily Reminder
            </Label>
            <p className="text-sm text-muted-foreground font-sans">
              Get a reminder to record your daily check-in
            </p>
          </div>
          <Switch
            id="daily-reminder"
            checked={dailyReminder}
            onCheckedChange={onDailyReminderChange}
          />
        </div>
      </div>
    </div>
  )
}

