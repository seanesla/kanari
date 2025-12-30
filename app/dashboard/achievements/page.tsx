"use client"

import { useEffect, useState } from "react"
import { useDashboardAnimation } from "../layout"
import { cn } from "@/lib/utils"
import { useAchievements, useAchievementCooldown } from "@/hooks/use-achievements"
import { AchievementsShowcase } from "@/components/achievements/achievements-showcase"
import { DecorativeGrid } from "@/components/ui/decorative-grid"

export default function AchievementsPage() {
  const { shouldAnimate } = useDashboardAnimation()
  const [visible, setVisible] = useState(!shouldAnimate)

  const {
    achievements,
    countByRarity,
    loading,
    generateAchievements,
  } = useAchievements()

  const { canCheck, markChecked } = useAchievementCooldown()

  // Trigger entry animation
  useEffect(() => {
    if (shouldAnimate) {
      const timer = setTimeout(() => setVisible(true), 100)
      return () => clearTimeout(timer)
    }
  }, [shouldAnimate])

  // Handle generate with cooldown
  const handleGenerate = async () => {
    if (!canCheck) return
    await generateAchievements()
    markChecked()
  }

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
          <AchievementsShowcase
            achievements={achievements}
            countByRarity={countByRarity}
            loading={loading}
            onGenerate={canCheck ? handleGenerate : undefined}
          />

          {!canCheck && achievements.length > 0 && (
            <p className="text-xs text-muted-foreground mt-4 text-center">
              You can check for new achievements once every 24 hours.
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
