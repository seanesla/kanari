"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { useSceneMode } from "@/lib/scene-context"
import { useOnboardingGuard } from "@/hooks/use-onboarding"
import { useDailyReminder } from "@/hooks/use-daily-reminder"

const DashboardAnimationContext = createContext({ shouldAnimate: false })

export function useDashboardAnimation() {
  return useContext(DashboardAnimationContext)
}

function DashboardAnimationProvider({
  children,
  isReady,
}: {
  children: React.ReactNode
  isReady: boolean
}) {
  const hasAnimatedRef = useRef(false)
  const shouldAnimateThisRender = isReady && !hasAnimatedRef.current

  // Mark immediately so children see shouldAnimate=true only on the first render.
  if (shouldAnimateThisRender) {
    hasAnimatedRef.current = true
  }

  const [shouldAnimate, setShouldAnimate] = useState(true)

  // Turn off the animation window after 150ms.
  useEffect(() => {
    if (!isReady) return

    setShouldAnimate(true)
    const timer = setTimeout(() => setShouldAnimate(false), 150)
    return () => clearTimeout(timer)
  }, [isReady])

  return (
    <DashboardAnimationContext.Provider value={{ shouldAnimate: shouldAnimateThisRender || shouldAnimate }}>
      {children}
    </DashboardAnimationContext.Provider>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
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
      <div className="relative" data-dashboard>
        {children}
      </div>
    </DashboardAnimationProvider>
  )
}
