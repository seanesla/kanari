"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { db } from "@/lib/storage/db"
import { patchSettings } from "@/lib/settings/patch-settings"
import { COMMON_TIME_ZONES, DEFAULT_TIME_ZONE, getSupportedTimeZones, normalizeTimeZone } from "@/lib/timezone"

interface TimeZoneContextValue {
  timeZone: string
  setTimeZone: (timeZone: string) => void
  availableTimeZones: string[]
  isLoading: boolean
}

const TimeZoneContext = createContext<TimeZoneContextValue | null>(null)

function inferBrowserTimeZone(): string {
  if (typeof window === "undefined") return DEFAULT_TIME_ZONE
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE
  } catch {
    return DEFAULT_TIME_ZONE
  }
}

export function TimeZoneProvider({ children }: { children: ReactNode }) {
  const [timeZone, setTimeZoneState] = useState(() => normalizeTimeZone(inferBrowserTimeZone()))
  const [availableTimeZones] = useState(() => getSupportedTimeZones())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    db.settings
      .get("default")
      .then((settings) => {
        const nextTimeZone = settings?.timeZone ?? inferBrowserTimeZone()
        setTimeZoneState(normalizeTimeZone(nextTimeZone))
      })
      .catch((error) => {
        if (process.env.NODE_ENV === "development") {
          console.warn("[TimeZoneProvider] Failed to load settings from IndexedDB:", error)
        }
      })
      .finally(() => setIsLoading(false))
  }, [])

  const setTimeZone = useCallback((nextTimeZone: string) => {
    const normalized = normalizeTimeZone(nextTimeZone)
    setTimeZoneState(normalized)

    void patchSettings({ timeZone: normalized }).catch((error) => {
        if (process.env.NODE_ENV === "development") {
          console.warn("[TimeZoneProvider] Failed to save time zone:", error)
        }
      })
  }, [])

  const value = useMemo<TimeZoneContextValue>(
    () => ({
      timeZone,
      setTimeZone,
      availableTimeZones,
      isLoading,
    }),
    [timeZone, setTimeZone, availableTimeZones, isLoading]
  )

  return <TimeZoneContext.Provider value={value}>{children}</TimeZoneContext.Provider>
}

export function useTimeZone() {
  const context = useContext(TimeZoneContext)
  if (context) return context

  if (process.env.NODE_ENV === "development") {
    console.warn("[useTimeZone] Missing TimeZoneProvider, falling back to default time zone.")
  }

  const fallbackTimeZone = normalizeTimeZone(inferBrowserTimeZone())
  return {
    timeZone: fallbackTimeZone,
    setTimeZone: () => {},
    availableTimeZones: [...COMMON_TIME_ZONES],
    isLoading: false,
  } satisfies TimeZoneContextValue
}
