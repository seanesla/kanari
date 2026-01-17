"use client"

import { useEffect, useRef } from "react"
import { Temporal } from "temporal-polyfill"
import { useTimeZone } from "@/lib/timezone-context"
import { useNotifications } from "@/hooks/use-notifications"

const LAST_REMINDER_DATE_KEY = "kanari:dailyReminder:lastDate"

function normalizeTimeToHHMM(value: string | undefined): string | null {
  if (!value) return null

  const match = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
  if (!match) return null

  const hour = match[1].padStart(2, "0")
  const minute = match[2]
  return `${hour}:${minute}`
}

export interface UseDailyReminderOptions {
  enabled?: boolean
  title?: string
  body?: string
}

export function useDailyReminder(options: UseDailyReminderOptions = {}) {
  const { timeZone } = useTimeZone()
  const { isSupported, notify } = useNotifications()
  const enabled = options.enabled ?? true

  const lastFiredRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled) return

    if (typeof window === "undefined") return

    // In unit tests (node/jsdom), IndexedDB may not exist. Avoid importing Dexie in that case.
    if (typeof indexedDB === "undefined") return

    if (!isSupported) return

    let cancelled = false
    let intervalId: number | null = null
    let timeoutId: number | null = null

    const notificationTitle = options.title ?? "Kanari"
    const notificationBody = options.body ?? "Time for your daily check-in."

    async function tick() {
      if (cancelled) return

      try {
        const { db } = await import("@/lib/storage/db")
        const settings = await db.settings.get("default")

        const reminderTime = normalizeTimeToHHMM(settings?.dailyReminderTime)
        if (!reminderTime) return

        if (Notification.permission !== "granted") return

        const tz = settings?.timeZone ?? timeZone
        const now = Temporal.Now.zonedDateTimeISO(tz)
        const nowHHMM = `${String(now.hour).padStart(2, "0")}:${String(now.minute).padStart(2, "0")}`

        if (nowHHMM !== reminderTime) return

        const today = now.toPlainDate().toString()

        const storedLast = window.localStorage.getItem(LAST_REMINDER_DATE_KEY)
        const lastFired = lastFiredRef.current ?? storedLast

        if (lastFired === today) return

        window.localStorage.setItem(LAST_REMINDER_DATE_KEY, today)
        lastFiredRef.current = today

        notify(notificationTitle, {
          body: notificationBody,
          tag: "kanari-daily-reminder",
        })
      } catch {
        // If anything fails (Dexie missing, IDB blocked, etc.), skip silently.
      }
    }

    // Run an initial check, then align checks to minute boundaries.
    void tick()

    const nowMs = Date.now()
    const msToNextMinute = 60_000 - (nowMs % 60_000)

    timeoutId = window.setTimeout(() => {
      void tick()
      intervalId = window.setInterval(() => {
        void tick()
      }, 60_000)
    }, msToNextMinute)

    return () => {
      cancelled = true
      if (timeoutId !== null) window.clearTimeout(timeoutId)
      if (intervalId !== null) window.clearInterval(intervalId)
    }
  }, [enabled, isSupported, notify, options.body, options.title, timeZone])
}
