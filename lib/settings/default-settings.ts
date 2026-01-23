import type { UserSettings } from "@/lib/types"
import type { DBSettings } from "@/lib/storage/db"
import { DEFAULT_ACCENT } from "@/lib/color-utils"
import { DEFAULT_SANS, DEFAULT_SERIF } from "@/lib/font-utils"
import { DEFAULT_TIME_ZONE } from "@/lib/timezone"

const DEFAULT_GEMINI_API_KEY_SOURCE: UserSettings["geminiApiKeySource"] =
  process.env.NEXT_PUBLIC_GEMINI_API_KEY ? "kanari" : "user"

export const DEFAULT_USER_SETTINGS: UserSettings = {
  userName: undefined,

  enableNotifications: false,
  dailyReminderTime: undefined,

  calendarConnected: false,
  autoScheduleRecovery: false,
  preferredRecoveryTimes: [],

  localStorageOnly: true,

  // Gemini API key handling
  geminiApiKeySource: DEFAULT_GEMINI_API_KEY_SOURCE,

  accountabilityMode: "balanced",

  selectedGeminiVoice: undefined,

  coachAvatarBase64: undefined,
  coachAvatarVoice: undefined,

  // Appearance
  accentColor: DEFAULT_ACCENT,
  selectedSansFont: DEFAULT_SANS,
  selectedSerifFont: DEFAULT_SERIF,

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
