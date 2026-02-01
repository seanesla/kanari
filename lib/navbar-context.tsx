"use client"

import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { isAppRoute } from "@/lib/app-routes"

export type NavbarMode = "landing" | "dashboard" | "onboarding"
export type ActiveSection = "hero" | "features" | "how-it-works" | "trust" | null

// Onboarding step configuration
export const ONBOARDING_STEPS = [
  { id: "intro", label: "Intro" },
  { id: "graphics", label: "Graphics" },
  { id: "api", label: "API" },
  { id: "coach", label: "Coach" },
  { id: "prefs", label: "Prefs" },
  { id: "done", label: "Done" },
] as const

export const TOTAL_ONBOARDING_STEPS = ONBOARDING_STEPS.length

interface NavbarContextValue {
  navbarMode: NavbarMode
  activeSection: ActiveSection
  setActiveSection: (section: ActiveSection) => void
  activeDashboardRoute: string | null
  // Onboarding navigation
  onboardingStep: number
  setOnboardingStep: (step: number) => void
  highestStepReached: number // Track furthest step visited (for back navigation)
}

const NavbarContext = createContext<NavbarContextValue | null>(null)

export function NavbarProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [activeSection, setActiveSection] = useState<ActiveSection>(null)
  const [onboardingStep, setOnboardingStep] = useState(0)
  const [highestStepReached, setHighestStepReached] = useState(0)

  // Derive navbar mode from pathname
  const navbarMode: NavbarMode = isAppRoute(pathname)
    ? "dashboard"
    : pathname === "/onboarding"
      ? "onboarding"
      : "landing"

  // Derive active dashboard route
  const activeDashboardRoute = navbarMode === "dashboard" ? pathname : null

  // Reset active section when leaving landing
  useEffect(() => {
    if (navbarMode !== "landing") {
      setActiveSection(null)
    }
  }, [navbarMode])

  // Reset onboarding step when leaving onboarding
  useEffect(() => {
    if (navbarMode !== "onboarding") {
      setOnboardingStep(0)
      setHighestStepReached(0)
    }
  }, [navbarMode])

  // Track highest step reached (so visited steps stay accessible when going back)
  useEffect(() => {
    if (onboardingStep > highestStepReached) {
      setHighestStepReached(onboardingStep)
    }
  }, [onboardingStep, highestStepReached])

  const value = useMemo(
    () => ({
      navbarMode,
      activeSection,
      setActiveSection,
      activeDashboardRoute,
      onboardingStep,
      setOnboardingStep,
      highestStepReached,
    }),
    [navbarMode, activeSection, activeDashboardRoute, onboardingStep, highestStepReached]
  )

  return <NavbarContext.Provider value={value}>{children}</NavbarContext.Provider>
}

export function useNavbar() {
  const context = useContext(NavbarContext)
  if (!context) {
    throw new Error("useNavbar must be used within NavbarProvider")
  }
  return context
}
