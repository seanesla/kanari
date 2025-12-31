"use client"

import { useEffect, useState } from "react"
import { Calendar, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useCalendar } from "@/hooks/use-calendar"

interface SettingsCalendarSectionProps {
  autoScheduleRecovery: boolean
  onAutoScheduleRecoveryChange: (checked: boolean) => void
}

export function SettingsCalendarSection({
  autoScheduleRecovery,
  onAutoScheduleRecoveryChange,
}: SettingsCalendarSectionProps) {
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
            checked={autoScheduleRecovery}
            onCheckedChange={onAutoScheduleRecoveryChange}
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
                You&apos;ll receive reminders 10 and 30 minutes before each block
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

