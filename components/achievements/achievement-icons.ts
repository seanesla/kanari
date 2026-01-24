import type { ComponentType, SVGProps } from "react"
import {
  Bonfire,
  CalendarPlus,
  CheckCircle,
  GraphUp,
  Heart,
  Microphone,
  MusicDoubleNote,
  Pin,
  Sparks,
  Trophy,
} from "iconoir-react"
import type { DailyAchievement, DailyAchievementCategory, MilestoneBadgeType } from "@/lib/achievements"

type SvgIcon = ComponentType<SVGProps<SVGSVGElement>>

const CATEGORY_TONE_CLASS: Record<DailyAchievementCategory, string> = {
  consistency: "text-[color:var(--kanari-tone-consistency)]",
  improvement: "text-[color:var(--kanari-tone-improvement)]",
  engagement: "text-[color:var(--kanari-tone-engagement)]",
  recovery: "text-[color:var(--kanari-tone-recovery)]",
}

export function getDailyAchievementIcon(achievement: DailyAchievement): {
  Icon: SvgIcon
  colorClass: string
} {
  const colorClass = CATEGORY_TONE_CLASS[achievement.category] ?? "text-accent"

  if (achievement.type === "badge") {
    return { Icon: Sparks, colorClass }
  }

  const trackingKey = achievement.tracking?.key
  if (trackingKey === "do_check_in") return { Icon: Microphone, colorClass }
  if (trackingKey === "complete_suggestions") return { Icon: CheckCircle, colorClass }
  if (trackingKey === "schedule_suggestion") return { Icon: CalendarPlus, colorClass }

  switch (achievement.category) {
    case "consistency":
      return { Icon: Microphone, colorClass }
    case "improvement":
      return { Icon: GraphUp, colorClass }
    case "engagement":
      return { Icon: Sparks, colorClass }
    case "recovery":
      return { Icon: Heart, colorClass }
    default:
      return { Icon: Sparks, colorClass }
  }
}

export function getMilestoneBadgeIcon(type: MilestoneBadgeType): { Icon: SvgIcon; colorClass: string } {
  switch (type) {
    case "7day":
      return { Icon: Bonfire, colorClass: "text-orange-500" }
    case "30day":
      return { Icon: Pin, colorClass: "text-slate-500" }
    case "60day":
      return { Icon: MusicDoubleNote, colorClass: "text-purple-500" }
    case "90day":
      return { Icon: Trophy, colorClass: "text-amber-500" }
    default:
      return { Icon: Trophy, colorClass: "text-amber-500" }
  }
}
