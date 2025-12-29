"use client"

import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from "react"
import { usePathname } from "next/navigation"

export type NavbarMode = "landing" | "dashboard"
export type ActiveSection = "hero" | "features" | "how-it-works" | null

interface NavbarContextValue {
  navbarMode: NavbarMode
  activeSection: ActiveSection
  setActiveSection: (section: ActiveSection) => void
  activeDashboardRoute: string | null
}

const NavbarContext = createContext<NavbarContextValue | null>(null)

export function NavbarProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [activeSection, setActiveSection] = useState<ActiveSection>(null)

  // Derive navbar mode from pathname
  const navbarMode: NavbarMode = pathname.startsWith("/dashboard") ? "dashboard" : "landing"

  // Derive active dashboard route
  const activeDashboardRoute = navbarMode === "dashboard" ? pathname : null

  // Reset active section when leaving landing
  useEffect(() => {
    if (navbarMode !== "landing") {
      setActiveSection(null)
    }
  }, [navbarMode])

  const value = useMemo(
    () => ({
      navbarMode,
      activeSection,
      setActiveSection,
      activeDashboardRoute,
    }),
    [navbarMode, activeSection, activeDashboardRoute]
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
