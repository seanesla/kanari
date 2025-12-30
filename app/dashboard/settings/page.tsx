"use client"

import { useEffect, useState } from "react"
import { useDashboardAnimation } from "../layout"
import { cn } from "@/lib/utils"
import { SettingsContent } from "@/components/dashboard/settings-content"

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
        {/* Header Section */}
        <div className="relative mb-32 md:mb-36">
          <div
            className={cn(
              "relative transition-all duration-1000 delay-100",
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Configuration</p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif leading-[0.95] mb-4">
              Settings
            </h1>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl">
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
