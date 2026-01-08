import type { UserSettings } from "@/lib/types"
import type { DBSettings } from "@/lib/storage/db"
import { DEFAULT_TIME_ZONE } from "@/lib/timezone"

export const DEFAULT_USER_SETTINGS: UserSettings = {
  defaultRecordingDuration: 30,
  enableVAD: true,
  enableNotifications: false,
  calendarConnected: false,
  autoScheduleRecovery: false,
  preferredRecoveryTimes: [],
  localStorageOnly: true,
  timeZone: DEFAULT_TIME_ZONE,
  hasCompletedOnboarding: false,
}

export function createDefaultSettingsRecord(
  overrides: Partial<UserSettings> = {}
): DBSettings {
  return {
    id: "default",
    ...DEFAULT_USER_SETTINGS,
    ...overrides,
  }
}
