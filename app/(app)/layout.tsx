"use client"

import { useEffect, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useSceneMode } from "@/lib/scene-context"
import { useOnboardingGuard } from "@/hooks/use-onboarding"
import { useDailyReminder } from "@/hooks/use-daily-reminder"
import { DashboardAnimationProvider } from "@/lib/dashboard-animation-context"
import { AppSpaceBackground } from "@/components/dashboard/app-space-background"

export default function AppLayout({ children }: { children: ReactNode }) {
  const { setMode } = useSceneMode()
  const { isReady } = useOnboardingGuard()
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()

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
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, filter: "blur(10px)" }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(8px)" }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 0.35, ease: [0.22, 1, 0.36, 1] }
            }
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </DashboardAnimationProvider>
  )
}
