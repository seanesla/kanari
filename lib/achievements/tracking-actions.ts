import type { DailyAchievementTracking, DailyAchievementTrackingKey } from "./types"

export interface AchievementTodayCounts {
  checkInsToday: number
  suggestionsCompletedToday: number
  suggestionsScheduledToday: number
}

export interface DailyAchievementAction {
  href: string
  label: string
}

export function getDailyAchievementAction(key: DailyAchievementTrackingKey): DailyAchievementAction {
  switch (key) {
    case "do_check_in":
      return { href: "/check-ins?newCheckIn=true", label: "Start check-in" }
    case "complete_suggestions":
      return { href: "/overview?focus=suggestions", label: "Open suggestions" }
    case "schedule_suggestion":
      return { href: "/overview?focus=suggestions&action=schedule", label: "Schedule a suggestion" }
  }
}

export function getDailyAchievementProgress(input: {
  tracking: DailyAchievementTracking
  counts: AchievementTodayCounts
}): { current: number; target: number; label: string } {
  const { tracking, counts } = input

  switch (tracking.key) {
    case "do_check_in":
      return { current: counts.checkInsToday, target: tracking.target, label: "Check-ins today" }
    case "complete_suggestions":
      return { current: counts.suggestionsCompletedToday, target: tracking.target, label: "Suggestions completed today" }
    case "schedule_suggestion":
      return { current: counts.suggestionsScheduledToday, target: tracking.target, label: "Suggestions scheduled today" }
  }
}
