"use client"

import { useEffect, useState } from "react"
import { useDashboardAnimation } from "@/lib/dashboard-animation-context"
import { cn } from "@/lib/utils"
import { SettingsContent } from "@/components/dashboard/settings-content"
import { PageHeader } from "@/components/dashboard/page-header"

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
      <main className="px-4 md:px-8 lg:px-12 pt-[calc(env(safe-area-inset-top)+4rem)] md:pt-20 pb-[calc(env(safe-area-inset-bottom)+2rem)] relative z-10">
        {/* Header */}
        <div
          className={cn(
            "mb-8 transition-all duration-1000 delay-100",
            visible ? "opacity-100 translate-y-0" : "opacity-95 translate-y-4"
          )}
        >
          <PageHeader
            title="Settings"
            subtitle="Configure check-in preferences, notifications, calendar integration, and privacy settings."
          />
        </div>

        {/* Settings Content */}
        <div
          className={cn(
            "relative transition-all duration-1000 delay-200",
            visible ? "opacity-100 translate-y-0" : "opacity-95 translate-y-4"
          )}
        >
          <SettingsContent />
        </div>
      </main>
    </div>
  )
}
