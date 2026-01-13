"use client"

import { useEffect, useState } from "react"
import { useDashboardAnimation } from "../layout"
import { cn } from "@/lib/utils"
import { useRecordings, useCheckInSessions } from "@/hooks/use-storage"
import { useAllSuggestions } from "@/hooks/use-storage"
import { useAchievements } from "@/hooks/use-achievements"
import { DailyAchievementCard, CelebrationToastQueue } from "@/components/achievements"
import { DecorativeGrid } from "@/components/ui/decorative-grid"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { getDateLabel } from "@/lib/date-utils"
import { useTimeZone } from "@/lib/timezone-context"

export default function AchievementsPage() {
  const { shouldAnimate } = useDashboardAnimation()
  const [visible, setVisible] = useState(!shouldAnimate)
  const { timeZone } = useTimeZone()

  // Get data needed for generating achievements
  const recordings = useRecordings()
  const suggestions = useAllSuggestions()
  const sessions = useCheckInSessions()

  const {
    loading,
    error,
    progress,
    todayISO,
    achievementsToday,
    history,
    milestoneBadges,
    celebrationQueue,
    milestoneCelebrationQueue,
    dayCompletion,
    ensureToday,
    completeAchievement,
    markAchievementSeen,
    markMilestoneSeen,
  } = useAchievements({ recordings, suggestions, sessions })

  // Trigger entry animation
  useEffect(() => {
    if (shouldAnimate) {
      const timer = setTimeout(() => setVisible(true), 100)
      return () => clearTimeout(timer)
    }
  }, [shouldAnimate])

  const progressToNextLevel = 100 - (progress.totalPoints % 100)
  const dailyProgressPct = dayCompletion.totalCount > 0
    ? (dayCompletion.completedCount / dayCompletion.totalCount) * 100
    : 0

  const historyByDate = history
    .filter((a) => a.dateISO !== todayISO)
    .reduce<Record<string, typeof history>>((acc, achievement) => {
      acc[achievement.dateISO] = acc[achievement.dateISO] || []
      acc[achievement.dateISO].push(achievement)
      return acc
    }, {})

  const historyDates = Object.keys(historyByDate).sort((a, b) => b.localeCompare(a))

  return (
    <div className="min-h-screen bg-transparent relative overflow-hidden">
      <main className="px-8 md:px-16 lg:px-20 pt-28 pb-12 relative z-10">
        {/* Header */}
        <div className="relative mb-12 overflow-hidden rounded-lg p-6 min-h-[200px] flex items-center">
          <DecorativeGrid />
          <div
            className={cn(
              "relative transition-all duration-1000 delay-100",
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
            )}
          >
            <h1 className="text-3xl md:text-4xl font-serif leading-[0.95] mb-3">
              Your <span className="text-accent">achievements</span>
            </h1>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-xl">
              Milestones you&apos;ve earned on your wellness journey. Achievements are personalized based on your progress.
            </p>
          </div>
        </div>

        {/* Achievements Showcase */}
        <div
          className={cn(
            "transition-all duration-1000 delay-200",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}
        >
          {/* Today */}
          <div className="rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Today&apos;s Achievements</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Level {progress.level} • {progress.levelTitle} • {progress.totalPoints} pts
                </p>
              </div>
              <div className="text-sm text-muted-foreground sm:text-right">
                <div>
                  Daily: <span className="font-medium text-foreground">{dayCompletion.completedCount}/{dayCompletion.totalCount}</span>
                </div>
                <div>
                  Suggestions: <span className="font-medium text-foreground">{dayCompletion.recommendedActionsCompleted}/{dayCompletion.recommendedActionsRequired}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <Progress value={dailyProgressPct} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{dayCompletion.isComplete ? "Day complete" : "Keep going"}</span>
                <span>{progressToNextLevel} pts to next level</span>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive mt-3">
                {error}
              </p>
            )}

            <div className="grid gap-4 mt-5 md:grid-cols-2">
              {achievementsToday.length === 0 ? (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    {loading ? "Generating today’s achievements…" : "No achievements generated yet."}
                  </div>
                  {!loading && (
                    <Button variant="outline" size="sm" onClick={() => void ensureToday()}>
                      Generate today&apos;s achievements
                    </Button>
                  )}
                </div>
              ) : (
                achievementsToday.map((achievement) => (
                  <div key={achievement.id} className="space-y-2">
                    <DailyAchievementCard achievement={achievement} variant="full" showNewIndicator />
                    {achievement.type === "challenge" && !achievement.expired && (
                      achievement.completed ? (
                        <Button variant="outline" size="sm" disabled className="w-full">
                          Completed
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void completeAchievement(achievement.id)}
                          className="w-full"
                        >
                          Mark complete
                        </Button>
                      )
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Milestones */}
          <div className="mt-6 rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl p-6">
            <h2 className="text-lg font-semibold">Milestones</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Earn milestone badges at 7, 30, 60, and 90 days of completed daily sets.
            </p>

            {milestoneBadges.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-4">No milestone badges yet.</p>
            ) : (
              <div className="grid gap-3 mt-4 sm:grid-cols-2 lg:grid-cols-3">
                {milestoneBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className={cn(
                      "rounded-xl border border-accent/25 bg-accent/5 p-4",
                      !badge.seen && "ring-2 ring-accent/40"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-lg border border-accent/25 flex items-center justify-center text-2xl">
                        {badge.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-semibold truncate">{badge.title}</h3>
                          <span className="text-xs text-muted-foreground tabular-nums">{badge.streakDays}d</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{badge.description}</p>
                        <p className="text-xs text-muted-foreground/70 mt-2">
                          Earned {new Date(badge.earnedAt).toLocaleDateString("en-US", { timeZone })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* History */}
          <div className="mt-6 rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl p-6">
            <h2 className="text-lg font-semibold">History</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Your full daily achievements log.
            </p>

            {historyDates.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-4">No history yet.</p>
            ) : (
              <div className="mt-4 space-y-6">
                {historyDates.map((dateISO) => {
                  const dayItems = (historyByDate[dateISO] || []).slice().sort((a, b) => {
                    if (a.type !== b.type) return a.type === "challenge" ? -1 : 1
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                  })

                  return (
                    <div key={dateISO} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium">
                          {getDateLabel(`${dateISO}T00:00:00.000Z`, timeZone)}
                        </h3>
                        <span className="text-xs text-muted-foreground">
                          {dayItems.filter((a) => a.completed).length}/{dayItems.length}
                        </span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {dayItems.map((achievement) => (
                          <DailyAchievementCard
                            key={achievement.id}
                            achievement={achievement}
                            variant="compact"
                            showNewIndicator
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Celebrations */}
          <CelebrationToastQueue
            achievements={celebrationQueue}
            milestones={milestoneCelebrationQueue}
            onDismissAchievement={(id) => void markAchievementSeen(id)}
            onDismissMilestone={(id) => void markMilestoneSeen(id)}
          />
        </div>
      </main>
    </div>
  )
}
