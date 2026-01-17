"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

export interface UseNotificationsResult {
  isSupported: boolean
  permission: NotificationPermission | "unsupported"
  canNotify: boolean
  requestPermission: () => Promise<NotificationPermission | "unsupported">
  notify: (title: string, options?: NotificationOptions) => Notification | null
}

export function useNotifications(): UseNotificationsResult {
  const isSupported = typeof window !== "undefined" && "Notification" in window

  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => {
    if (!isSupported) return "unsupported"
    return Notification.permission
  })

  useEffect(() => {
    if (!isSupported) return
    setPermission(Notification.permission)
  }, [isSupported])

  const requestPermission = useCallback(async (): Promise<NotificationPermission | "unsupported"> => {
    if (!isSupported) return "unsupported"

    if (Notification.permission === "granted" || Notification.permission === "denied") {
      setPermission(Notification.permission)
      return Notification.permission
    }

    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      return result
    } catch {
      const fallback = Notification.permission
      setPermission(fallback)
      return fallback
    }
  }, [isSupported])

  const canNotify = useMemo(() => permission === "granted", [permission])

  const notify = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (!isSupported) return null
      if (permission !== "granted") return null

      try {
        return new Notification(title, options)
      } catch {
        return null
      }
    },
    [isSupported, permission]
  )

  return {
    isSupported,
    permission,
    canNotify,
    requestPermission,
    notify,
  }
}
