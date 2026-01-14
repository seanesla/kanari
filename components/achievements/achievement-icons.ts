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
import type { DailyAchievement, MilestoneBadgeType } from "@/lib/achievements"

type SvgIcon = ComponentType<SVGProps<SVGSVGElement>>

export function getDailyAchievementIcon(achievement: DailyAchievement): {
  Icon: SvgIcon
  colorClass: string
} {
  if (achievement.type === "badge") {
    return { Icon: Sparks, colorClass: "text-yellow-500" }
  }

  const trackingKey = achievement.tracking?.key
  if (trackingKey === "do_check_in") return { Icon: Microphone, colorClass: "text-blue-500" }
  if (trackingKey === "complete_suggestions") return { Icon: CheckCircle, colorClass: "text-green-500" }
  if (trackingKey === "schedule_suggestion") return { Icon: CalendarPlus, colorClass: "text-indigo-500" }

  switch (achievement.category) {
    case "consistency":
      return { Icon: Microphone, colorClass: "text-blue-500" }
    case "improvement":
      return { Icon: GraphUp, colorClass: "text-green-500" }
    case "engagement":
      return { Icon: Sparks, colorClass: "text-yellow-500" }
    case "recovery":
      return { Icon: Heart, colorClass: "text-pink-500" }
    default:
      return { Icon: Sparks, colorClass: "text-yellow-500" }
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

