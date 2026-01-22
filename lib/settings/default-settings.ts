import type { UserSettings } from "@/lib/types"
import type { DBSettings } from "@/lib/storage/db"
import { DEFAULT_TIME_ZONE } from "@/lib/timezone"

export const DEFAULT_USER_SETTINGS: UserSettings = {
  userName: undefined,

  enableNotifications: false,
  dailyReminderTime: undefined,

  calendarConnected: false,
  autoScheduleRecovery: false,
  preferredRecoveryTimes: [],

  localStorageOnly: true,

  accountabilityMode: "balanced",

  selectedGeminiVoice: undefined,

  coachAvatarBase64: undefined,
  coachAvatarVoice: undefined,

  disableStartupAnimation: false,

  timeZone: DEFAULT_TIME_ZONE,

  hasCompletedOnboarding: false,
  onboardingCompletedAt: undefined,
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
