"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { useSceneMode } from "@/lib/scene-context"
import { useOnboardingGuard } from "@/hooks/use-onboarding"

const DashboardAnimationContext = createContext({ shouldAnimate: false })
export const useDashboardAnimation = () => useContext(DashboardAnimationContext)

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { setMode } = useSceneMode()
  const { isReady } = useOnboardingGuard()
  const hasEnteredRef = useRef(false)
  const [shouldAnimate, setShouldAnimate] = useState(() => !hasEnteredRef.current)

  useEffect(() => {
    setMode("dashboard")
    if (!hasEnteredRef.current) {
      hasEnteredRef.current = true
      // Allow animation to trigger, then disable for future navigations
      const timer = setTimeout(() => setShouldAnimate(false), 150)
      return () => clearTimeout(timer)
    }
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
    <DashboardAnimationContext.Provider value={{ shouldAnimate }}>
      <div className="relative" data-dashboard>
        {children}
      </div>
    </DashboardAnimationContext.Provider>
  )
}
