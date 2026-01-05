import type { UserSettings } from "@/lib/types"
import type { DBSettings } from "@/lib/storage/db"

export const DEFAULT_USER_SETTINGS: UserSettings = {
  defaultRecordingDuration: 30,
  enableVAD: true,
  enableNotifications: false,
  calendarConnected: false,
  autoScheduleRecovery: false,
  preferredRecoveryTimes: [],
  localStorageOnly: true,
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
