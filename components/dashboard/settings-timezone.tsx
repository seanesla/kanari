"use client"

import { useMemo } from "react"
import { Globe2 } from "@/lib/icons"
import { Label } from "@/components/ui/label"
import { useTimeZone } from "@/lib/timezone-context"
import { COMMON_TIME_ZONES, formatTimeZoneLabel } from "@/lib/timezone"

interface SettingsTimeZoneSectionProps {
  timeZone: string
  onTimeZoneChange: (timeZone: string) => void
}

export function SettingsTimeZoneSection({ timeZone, onTimeZoneChange }: SettingsTimeZoneSectionProps) {
  const { availableTimeZones, isLoading } = useTimeZone()

  const { common, all } = useMemo(() => {
    const commonSet = new Set(COMMON_TIME_ZONES)
    const allUnique = Array.from(new Set(availableTimeZones))
    const rest = allUnique.filter((tz) => !commonSet.has(tz)).sort()
    const common = COMMON_TIME_ZONES.filter((tz) => allUnique.includes(tz))
    return { common, all: rest }
  }, [availableTimeZones])

  const nowPreview = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date())
    } catch {
      return null
    }
  }, [timeZone])

  return (
    <div className="rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl p-6 transition-colors hover:bg-card/40">
      <div className="flex items-center gap-2 mb-6">
        <Globe2 className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold font-serif">Time Zone</h2>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="time-zone" className="text-base font-sans">
            Display & scheduling timezone
          </Label>
          <p className="text-sm text-muted-foreground font-sans mt-1">
            Used across Kanari for calendars, reminders, and timestamps.
          </p>
        </div>

        <select
          id="time-zone"
          value={timeZone}
          onChange={(e) => onTimeZoneChange(e.target.value)}
          disabled={isLoading}
          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm font-sans focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60"
          aria-label="Time zone"
        >
          <optgroup label="Common">
            {common.map((tz) => (
              <option key={tz} value={tz}>
                {formatTimeZoneLabel(tz)}
              </option>
            ))}
          </optgroup>
          {all.length > 0 && (
            <optgroup label="All time zones">
              {all.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </optgroup>
          )}
        </select>

        {nowPreview && (
          <p className="text-xs text-muted-foreground font-sans">
            Current time in {timeZone}: {nowPreview}
          </p>
        )}
      </div>
    </div>
  )
}
