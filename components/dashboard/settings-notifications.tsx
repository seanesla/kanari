"use client"

import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface SettingsNotificationsSectionProps {
  enableNotifications: boolean
  onEnableNotificationsChange: (checked: boolean) => void
  dailyReminderTime?: string
  onDailyReminderTimeChange: (time: string | undefined) => void
}

export function SettingsNotificationsSection({
  enableNotifications,
  onEnableNotificationsChange,
  dailyReminderTime,
  onDailyReminderTimeChange,
}: SettingsNotificationsSectionProps) {
  const dailyReminderEnabled = Boolean(dailyReminderTime)

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
            aria-label="Browser Notifications"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="daily-reminder-enabled" className="text-base font-sans">
                Daily Reminder
              </Label>
              <p className="text-sm text-muted-foreground font-sans">
                Get a reminder to do your daily check-in
              </p>
            </div>
            <Switch
              id="daily-reminder-enabled"
              checked={dailyReminderEnabled}
              onCheckedChange={(checked) => {
                if (checked) {
                  onDailyReminderTimeChange(dailyReminderTime ?? "09:00")
                } else {
                  onDailyReminderTimeChange(undefined)
                }
              }}
              aria-label="Daily Reminder"
            />
          </div>

          {dailyReminderEnabled && (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border/50 bg-secondary/10 p-3">
              <Label htmlFor="daily-reminder-time" className="text-sm font-sans text-muted-foreground">
                Daily Reminder Time
              </Label>
              <input
                id="daily-reminder-time"
                type="time"
                value={dailyReminderTime ?? "09:00"}
                onChange={(e) => onDailyReminderTimeChange(e.target.value)}
                className="h-9 w-[140px] rounded-md border border-border bg-background px-2 text-sm font-sans focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                aria-label="Daily Reminder Time"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

