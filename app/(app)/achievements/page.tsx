"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useDashboardAnimation } from "@/lib/dashboard-animation-context"
import { cn } from "@/lib/utils"
import { useRecordings, useCheckInSessions } from "@/hooks/use-storage"
import { useAllSuggestions } from "@/hooks/use-storage"
import { useAchievements } from "@/hooks/use-achievements"
import { DailyAchievementCard, CelebrationToastQueue } from "@/components/achievements"
import { PageHeader } from "@/components/dashboard/page-header"
import { Deck } from "@/components/dashboard/deck"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { getDateLabel } from "@/lib/date-utils"
import { useTimeZone } from "@/lib/timezone-context"
import { getDailyAchievementAction, getDailyAchievementProgress } from "@/lib/achievements"
import { getMilestoneBadgeIcon } from "@/components/achievements/achievement-icons"

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
    todayCounts,
    achievementsToday,
    history,
    milestoneBadges,
    celebrationQueue,
    milestoneCelebrationQueue,
    dayCompletion,
    ensureToday,
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

  const progressThisLevel = progress.totalPoints % 100
  const progressToNextLevel = 100 - progressThisLevel
  const levelProgressPct = (progressThisLevel / 100) * 100
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

  const currentStreak = progress.currentDailyCompletionStreak ?? 0
  const longestStreak = progress.longestDailyCompletionStreak ?? 0
  const nextMilestone = [7, 30, 60, 90].find((d) => d > currentStreak) ?? null

  return (
    <div data-demo-id="demo-achievements-page" className="min-h-screen bg-transparent relative overflow-hidden">
      <main className="px-4 md:px-8 lg:px-12 pt-[calc(env(safe-area-inset-top)+4rem)] md:pt-24 pb-[calc(env(safe-area-inset-bottom)+2rem)] relative z-10 overflow-x-hidden">
        {/* Header */}
        <div
          className={cn(
            "mb-8 transition-all duration-1000 delay-100",
            visible ? "opacity-100 translate-y-0" : "opacity-95 translate-y-12"
          )}
        >
          <PageHeader
            title="Your"
            titleAccent="achievements"
            subtitle="Milestones you've earned on your wellness journey. Achievements are personalized based on your progress."
          />
        </div>

        {/* Achievements Showcase */}
        <div
          className={cn(
            "transition-all duration-1000 delay-200",
            visible ? "opacity-100 translate-y-0" : "opacity-95 translate-y-8"
          )}
        >
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Today */}
              <Deck data-demo-id="demo-daily-challenges" className="lg:col-span-2 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Today&apos;s Focus</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Complete your daily set and keep your streak alive.
                  </p>
                </div>
                <div className="text-sm text-muted-foreground sm:text-right">
                  <div>
                    Daily:{" "}
                    <span className="font-medium text-foreground">
                      {dayCompletion.completedCount}/{dayCompletion.totalCount}
                    </span>
                  </div>
                  <div>
                    Suggestions:{" "}
                    <span className="font-medium text-foreground">
                      {dayCompletion.recommendedActionsCompleted}/{dayCompletion.recommendedActionsRequired}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Progress value={dailyProgressPct} />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground min-w-0">
                  <span>{dayCompletion.isComplete ? "Day complete" : "Auto-tracked"}</span>
                  <span className="ml-auto text-right">{progressToNextLevel} pts to next level</span>
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive mt-3">
                  {error}
                </p>
              )}

              <div className="grid gap-4 mt-6 md:grid-cols-2">
                {achievementsToday.length === 0 ? (
                  <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                      {loading
                        ? "Generating today’s achievements…"
                        : error
                          ? "Couldn’t generate today’s achievements."
                          : "Generating today’s achievements automatically…"}
                    </div>
                    {!loading && error && (
                      <Button variant="outline" size="sm" onClick={() => void ensureToday()}>
                        Retry
                      </Button>
                    )}
                  </div>
                ) : (
                  achievementsToday.map((achievement) => {
                    const tracking = achievement.type === "challenge" ? achievement.tracking : undefined
                    const action = tracking ? getDailyAchievementAction(tracking.key) : null
                    const trackingProgress = tracking
                      ? getDailyAchievementProgress({ tracking, counts: todayCounts })
                      : null

                    const current = trackingProgress ? Math.min(trackingProgress.current, trackingProgress.target) : 0
                    const target = trackingProgress?.target ?? 0
                    const pct = target > 0 ? (current / target) * 100 : 0

                    return (
                      <div key={achievement.id} className="space-y-2">
                        <DailyAchievementCard achievement={achievement} variant="full" showNewIndicator />

                        {achievement.type === "challenge" && !achievement.completed && !achievement.expired && tracking && action && trackingProgress && (
                          <div className="rounded-xl border border-border/60 bg-background/35 px-3 py-3">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span className="truncate">{trackingProgress.label}</span>
                                  <span className="tabular-nums text-foreground">
                                    {current}/{target}
                                  </span>
                                </div>
                                <Progress value={pct} className="mt-2 h-1.5" />
                              </div>
                              <Button asChild size="sm" className="w-full sm:w-auto shrink-0 bg-accent text-accent-foreground hover:bg-accent/90">
                                <Link href={action.href}>{action.label}</Link>
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground/80 mt-2">
                              Completes automatically when you do it.
                            </p>
                          </div>
                        )}

                        {achievement.type === "challenge" && achievement.expired && (
                          <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-3">
                            <p className="text-xs text-muted-foreground">
                              This challenge expired after the carry-over window.
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </Deck>

            {/* Progress + Streak */}
            <div className="space-y-4">
              <Deck className="p-4 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-muted-foreground">Level</h3>
                    <p className="text-lg font-semibold truncate">
                      {progress.level} • {progress.levelTitle}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {progress.totalPoints} total points
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-xl border border-accent/25 bg-accent/10 flex items-center justify-center text-sm font-semibold text-accent tabular-nums">
                    {progress.level}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <Progress value={levelProgressPct} />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground min-w-0">
                    <span className="tabular-nums">{progressThisLevel}/100</span>
                    <span className="ml-auto text-right">{progressToNextLevel} pts to level {progress.level + 1}</span>
                  </div>
                </div>
              </Deck>

              <Deck className="p-4 sm:p-6">
                <h3 className="text-sm font-medium text-muted-foreground">Streak</h3>
                <div className="mt-2 flex items-baseline justify-between gap-3">
                  <p className="text-2xl font-semibold tabular-nums">
                    {currentStreak}d
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Best: <span className="tabular-nums text-foreground">{longestStreak}d</span>
                  </p>
                </div>
                <div className="mt-3 rounded-xl border border-border/60 bg-background/25 px-3 py-3">
                  <p className="text-xs text-muted-foreground">
                    {nextMilestone
                      ? `Next milestone at ${nextMilestone} days.`
                      : "All milestones unlocked — keep going."}
                  </p>
                </div>
                <div className="mt-3">
                  <Button asChild variant="outline" size="sm" className="w-full">
                     <Link href="/check-ins?newCheckIn=true">New check-in</Link>
                  </Button>
                </div>
              </Deck>
            </div>
          </div>

          {/* Milestones */}
          <Deck className="mt-6 p-4 sm:p-6">
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
                        {(() => {
                          const { Icon, colorClass } = getMilestoneBadgeIcon(badge.type)
                          return <Icon className={cn("h-6 w-6", colorClass)} />
                        })()}
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
          </Deck>

          {/* History */}
          <Deck className="mt-6 p-4 sm:p-6">
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
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <h3 className="text-sm font-medium truncate min-w-0">
                          {getDateLabel(`${dateISO}T00:00:00.000Z`, timeZone)}
                        </h3>
                        <span className="text-xs text-muted-foreground shrink-0">
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
          </Deck>

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
