"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { useSceneMode } from "@/lib/scene-context"
import { useOnboardingGuard } from "@/hooks/use-onboarding"
import { useDailyReminder } from "@/hooks/use-daily-reminder"

const DashboardAnimationContext = createContext({ shouldAnimate: false })
export const useDashboardAnimation = () => useContext(DashboardAnimationContext)

function DashboardAnimationProvider({
  children,
  isReady,
}: {
  children: React.ReactNode
  isReady: boolean
}) {
  const [shouldAnimate, setShouldAnimate] = useState(true) // fresh mount = animate

  // Turn off animation window after first 150ms
  useEffect(() => {
    if (!isReady) return
    const timer = setTimeout(() => setShouldAnimate(false), 150)
    return () => clearTimeout(timer)
  }, [isReady])

  return (
    <DashboardAnimationContext.Provider value={{ shouldAnimate }}>
      {children}
    </DashboardAnimationContext.Provider>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { setMode } = useSceneMode()
  const { isReady } = useOnboardingGuard()
  const pathname = usePathname()

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
    // Keyed by pathname so each dashboard route gets a fresh animation window.
    // See docs/error-patterns/dashboard-animation.md
    <DashboardAnimationProvider key={pathname} isReady={isReady}>
      <div className="relative" data-dashboard>
        {children}
      </div>
    </DashboardAnimationProvider>
  )
}
