"use client"

import { useMemo } from "react"
import { Flame, Target, MessageCircle } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { useDashboardStats } from "@/hooks/use-storage"
import { Deck } from "@/components/dashboard/deck"

interface EngagementTrackerProps {
  className?: string
  variant?: "wide" | "compact"
}

export function EngagementTracker({ className, variant = "wide" }: EngagementTrackerProps) {
  const stats = useDashboardStats()

  // Total check-ins
  const totalCheckIns = stats.totalRecordings

  const weeklyProgress = useMemo(() => {
    return Math.min(100, (stats.weeklyRecordings / stats.weeklyGoal) * 100)
  }, [stats.weeklyRecordings, stats.weeklyGoal])

  const weeklyMessage = useMemo(() => {
    if (stats.weeklyRecordings === 0) {
      return "Start your week with a check-in"
    }
    if (stats.weeklyRecordings >= stats.weeklyGoal) {
      return "Weekly goal complete!"
    }
    const remaining = stats.weeklyGoal - stats.weeklyRecordings
    return `${remaining} more to hit your goal`
  }, [stats.weeklyRecordings, stats.weeklyGoal])

  const streakMessage = useMemo(() => {
    if (stats.currentStreak === 0) {
      return "Check in today to start"
    }
    return "Keep it going!"
  }, [stats.currentStreak])

  return (
    <Deck className={cn("p-4 md:p-6", className)}>
      <div
        className={cn(
          "grid grid-cols-1",
          variant === "wide" ? "md:grid-cols-3 gap-6" : "gap-4"
        )}
      >
        {/* Weekly Goal */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-accent/10">
              <Target className="h-4 w-4 text-accent" />
            </div>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Weekly Goal
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-serif tabular-nums">
              {stats.weeklyRecordings}
            </span>
            <span className="text-sm text-muted-foreground">
              / {stats.weeklyGoal}
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                weeklyProgress >= 100 ? "bg-success" : "bg-accent"
              )}
              style={{ width: `${weeklyProgress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{weeklyMessage}</p>
        </div>

        {/* Streak */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-orange-500/10">
              <Flame className="h-4 w-4 text-orange-500" />
            </div>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Streak
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-serif tabular-nums">
              {stats.currentStreak}
            </span>
            <span className="text-sm text-muted-foreground">
              {stats.currentStreak === 1 ? "day" : "days"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{streakMessage}</p>
        </div>

        {/* Total Check-ins */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-sky-500/10">
              <MessageCircle className="h-4 w-4 text-sky-400" />
            </div>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              Check-ins
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-serif tabular-nums">
              {totalCheckIns}
            </span>
            <span className="text-sm text-muted-foreground">all time</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {totalCheckIns === 0 ? "Your journey begins here" : "Keep building your check-in streak"}
          </p>
        </div>
      </div>
    </Deck>
  )
}
