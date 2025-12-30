"use client"

import { DecorativeGrid } from "@/components/ui/decorative-grid"
import { cn } from "@/lib/utils"

interface DashboardHeroProps {
  visible: boolean
}

/**
 * Hero section for the dashboard with animated title and decorative grid
 */
export function DashboardHero({ visible }: DashboardHeroProps) {
  return (
    <div className="relative mb-12 overflow-hidden rounded-lg p-6">
      <DecorativeGrid />
      <div
        className={cn(
          "relative transition-all duration-1000 delay-100",
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        )}
      >
        <h1 className="text-3xl md:text-4xl font-serif leading-[0.95] mb-3">
          Your <span className="text-accent">dashboard</span>
        </h1>
        <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-xl">
          Schedule recovery activities and track your wellness journey at a glance.
        </p>
      </div>
    </div>
  )
}
