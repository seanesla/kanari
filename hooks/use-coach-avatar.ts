/**
 * useCoachAvatar Hook
 *
 * Simple hook to read the coach avatar from IndexedDB settings.
 * Returns the base64-encoded avatar image if available.
 */

import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/storage/db"

interface UseCoachAvatarResult {
  /** Base64-encoded PNG image data (no data: prefix) */
  avatarBase64: string | null
  /** Whether the data is still loading */
  isLoading: boolean
}

/**
 * Hook to get the coach avatar from settings.
 * Uses Dexie's useLiveQuery for reactive updates.
 */
export function useCoachAvatar(): UseCoachAvatarResult {
  const settings = useLiveQuery(
    () => db.settings.get("default"),
    []
  )

  // useLiveQuery returns undefined while loading
  const isLoading = settings === undefined

  return {
    avatarBase64: settings?.coachAvatarBase64 ?? null,
    isLoading,
  }
}
