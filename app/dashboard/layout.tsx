"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
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
  pathname,
}: {
  children: React.ReactNode
  isReady: boolean
  pathname: string
}) {
  const lastPathnameRef = useRef<string | null>(null)
  const shouldAnimateThisRender = isReady && lastPathnameRef.current !== pathname

  // Update immediately so children see shouldAnimate=true on the first render of a new route.
  if (shouldAnimateThisRender) {
    lastPathnameRef.current = pathname
  }

  const [shouldAnimate, setShouldAnimate] = useState(true)

  // Turn off the animation window after 150ms.
  // Re-open the window when the pathname changes.
  useEffect(() => {
    if (!isReady) return

    setShouldAnimate(true)
    const timer = setTimeout(() => setShouldAnimate(false), 150)
    return () => clearTimeout(timer)
  }, [isReady, pathname])

  return (
    <DashboardAnimationContext.Provider value={{ shouldAnimate: shouldAnimateThisRender || shouldAnimate }}>
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
    <DashboardAnimationProvider isReady={isReady} pathname={pathname}>
      <div className="relative" data-dashboard>
        {children}
      </div>
    </DashboardAnimationProvider>
  )
}
