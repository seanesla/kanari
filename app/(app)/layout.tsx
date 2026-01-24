"use client"

import { useEffect, type ReactNode } from "react"
import { useSceneMode } from "@/lib/scene-context"
import { useOnboardingGuard } from "@/hooks/use-onboarding"
import { useDailyReminder } from "@/hooks/use-daily-reminder"
import { DashboardAnimationProvider } from "@/lib/dashboard-animation-context"
import { AppSpaceBackground } from "@/components/dashboard/app-space-background"

export default function AppLayout({ children }: { children: ReactNode }) {
  const { setMode } = useSceneMode()
  const { isReady } = useOnboardingGuard()

  useDailyReminder({ enabled: isReady })

  // Ensure scene mode stays in dashboard
  useEffect(() => {
    setMode("dashboard")
  }, [setMode])

  // Show loading state while checking onboarding status
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <DashboardAnimationProvider isReady={isReady}>
      <div className="relative min-h-screen" data-dashboard>
        <AppSpaceBackground />
        {children}
      </div>
    </DashboardAnimationProvider>
  )
}
