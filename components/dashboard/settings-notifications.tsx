"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useNotifications } from "@/hooks/use-notifications"

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
  const { isSupported, permission, requestPermission, notify } = useNotifications()

  const permissionLabel = useMemo(() => {
    if (!isSupported) return "Not supported"
    if (permission === "granted") return "Allowed"
    if (permission === "denied") return "Blocked"
    return "Not enabled"
  }, [isSupported, permission])

  const [isRequesting, setIsRequesting] = useState(false)

  const requestPermissionAndToast = async (): Promise<boolean> => {
    if (!isSupported) {
      toast.error("Browser notifications aren't supported", {
        description: "Try a different browser (Chrome, Edge, Safari) to enable reminders.",
      })
      return false
    }

    if (permission === "denied") {
      toast.error("Notifications are blocked", {
        description: "Enable notifications in your browser/site settings, then try again.",
      })
      return false
    }

    if (permission === "granted") return true

    setIsRequesting(true)
    try {
      const result = await requestPermission()
      if (result !== "granted") {
        toast.error("Notification permission not granted", {
          description: "We can only remind you if you click 'Allow' in the browser prompt.",
        })
        return false
      }

      notify("Kanari", {
        body: "Notifications are enabled. You'll get reminders while Kanari is open.",
        tag: "kanari-notifications-enabled",
      })

      return true
    } finally {
      setIsRequesting(false)
    }
  }

  const handleBrowserNotificationsToggle = (checked: boolean) => {
    if (!checked) {
      onEnableNotificationsChange(false)
      return
    }

    if (!isSupported) {
      toast.error("Browser notifications aren't supported", {
        description: "Try a different browser (Chrome, Edge, Safari) to enable alerts.",
      })
      onEnableNotificationsChange(false)
      return
    }

    if (permission === "granted") {
      onEnableNotificationsChange(true)
      return
    }

    if (permission === "denied") {
      toast.error("Notifications are blocked", {
        description: "Enable notifications in your browser/site settings, then try again.",
      })
      onEnableNotificationsChange(false)
      return
    }

    void requestPermissionAndToast().then((allowed) => {
      onEnableNotificationsChange(allowed)
    })
  }

  const handleDailyReminderToggle = (checked: boolean) => {
    if (!checked) {
      onDailyReminderTimeChange(undefined)
      return
    }

    if (!isSupported) {
      toast.error("Browser notifications aren't supported", {
        description: "Try a different browser (Chrome, Edge, Safari) to enable reminders.",
      })
      return
    }

    if (permission === "granted") {
      onDailyReminderTimeChange(dailyReminderTime ?? "09:00")
      return
    }

    if (permission === "denied") {
      toast.error("Notifications are blocked", {
        description: "Enable notifications in your browser/site settings, then try again.",
      })
      return
    }

    void requestPermissionAndToast().then((allowed) => {
      if (!allowed) return
      onDailyReminderTimeChange(dailyReminderTime ?? "09:00")
    })
  }

  return (
    <div className="rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl p-6 transition-colors hover:bg-card/40">
      <h2 className="mb-6 text-lg font-semibold font-serif">Notifications</h2>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Label htmlFor="enable-notifications" className="text-base font-sans">
                Browser Notifications
              </Label>
              <span className="text-xs text-muted-foreground font-sans">{permissionLabel}</span>
            </div>
            <p className="text-sm text-muted-foreground font-sans">
              Receive alerts for elevated stress or recovery suggestions
            </p>
          </div>
          <Switch
            id="enable-notifications"
            checked={enableNotifications}
            disabled={!isSupported || isRequesting}
            onCheckedChange={handleBrowserNotificationsToggle}
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
                Get a reminder to do your daily check-in (while Kanari is open)
              </p>
            </div>
            <Switch
              id="daily-reminder-enabled"
              checked={dailyReminderEnabled}
              disabled={!isSupported || isRequesting}
              onCheckedChange={handleDailyReminderToggle}
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
