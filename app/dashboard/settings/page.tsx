"use client"

import { useEffect, useState } from "react"
import { useDashboardAnimation } from "../layout"
import { cn } from "@/lib/utils"
import { SettingsContent } from "@/components/dashboard/settings-content"
import { DecorativeGrid } from "@/components/ui/decorative-grid"

export default function SettingsPage() {
  const { shouldAnimate } = useDashboardAnimation()
  const [visible, setVisible] = useState(!shouldAnimate)

  // Trigger entry animation only on initial dashboard entry
  useEffect(() => {
    if (shouldAnimate) {
      const timer = setTimeout(() => setVisible(true), 100)
      return () => clearTimeout(timer)
    }
  }, [shouldAnimate])

  return (
    <div className="min-h-screen bg-transparent relative overflow-hidden">
      <main className="px-8 md:px-16 lg:px-20 pt-28 pb-12 relative z-10">
        {/* Header Section - min-h-[200px]: ensures consistent grid fade appearance across all dashboard pages */}
        <div className="relative mb-12 overflow-hidden rounded-lg p-6 min-h-[200px] flex items-center">
          <DecorativeGrid />
          <div
            className={cn(
              "relative transition-all duration-1000 delay-100",
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            <h1 className="text-3xl md:text-4xl font-serif leading-[0.95] mb-3">
              Settings
            </h1>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-xl">
              Configure recording preferences, notifications, calendar integration, and privacy settings.
            </p>
          </div>
        </div>

        {/* Settings Content */}
        <div
          className={cn(
            "relative transition-all duration-1000 delay-200",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
        >
          <SettingsContent />
        </div>
      </main>
    </div>
  )
}
