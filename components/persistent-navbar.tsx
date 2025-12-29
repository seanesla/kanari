"use client"

import { useRef, useEffect, useState } from "react"
import { Link } from "next-view-transitions"
import { motion, AnimatePresence } from "framer-motion"
import { useSceneMode } from "@/lib/scene-context"
import { useNavbar } from "@/lib/navbar-context"
import { LiquidGlassNavbar } from "@/components/liquid-glass-navbar"
import { Logo } from "@/components/logo"
import { EnterButton } from "@/components/enter-button"
import { cn } from "@/lib/utils"

// Link configurations for each mode
const landingLinks = [
  { id: "features", href: "#features", label: "Features" },
  { id: "how-it-works", href: "#how-it-works", label: "How It Works" },
]

const dashboardLinks = [
  { id: "overview", href: "/dashboard", label: "Overview", exact: true },
  { id: "record", href: "/dashboard/record", label: "Record", exact: true },
  { id: "history", href: "/dashboard/history", label: "History", exact: false },
  { id: "suggestions", href: "/dashboard/suggestions", label: "Suggestions", exact: false },
  { id: "settings", href: "/dashboard/settings", label: "Settings", exact: true },
]

interface NavLinkProps {
  href: string
  label: string
  isActive: boolean
}

function NavLink({ href, label, isActive }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "relative text-sm transition-colors px-3 py-1",
        isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
      {isActive && (
        <motion.div
          layoutId="nav-indicator"
          className="absolute -bottom-1 left-0 right-0 h-0.5 bg-accent rounded-full"
          initial={false}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      )}
    </Link>
  )
}

function LandingNavLinks() {
  const { activeSection } = useNavbar()

  return (
    <motion.div
      className="flex items-center gap-2"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      {landingLinks.map((link) => (
        <NavLink
          key={link.id}
          href={link.href}
          label={link.label}
          isActive={activeSection === link.id}
        />
      ))}
      <div className="ml-2">
        <EnterButton variant="nav" />
      </div>
    </motion.div>
  )
}

function DashboardNavLinks() {
  const { activeDashboardRoute } = useNavbar()

  const isLinkActive = (href: string, exact: boolean) => {
    if (!activeDashboardRoute) return false
    if (exact) return activeDashboardRoute === href
    return activeDashboardRoute.startsWith(href)
  }

  return (
    <motion.nav
      className="flex items-center gap-2"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
    >
      {dashboardLinks.map((link) => (
        <NavLink
          key={link.id}
          href={link.href}
          label={link.label}
          isActive={isLinkActive(link.href, link.exact)}
        />
      ))}
    </motion.nav>
  )
}

export function PersistentNavbar() {
  const { isLoading } = useSceneMode()
  const { navbarMode } = useNavbar()
  const [visible, setVisible] = useState(false)
  const hasAppeared = useRef(false)

  // Trigger visibility after loading completes (with delay matching landing page)
  useEffect(() => {
    if (!isLoading && !hasAppeared.current) {
      const timer = setTimeout(() => {
        setVisible(true)
        hasAppeared.current = true
      }, 600) // Match landing page navbar delay
      return () => clearTimeout(timer)
    }
    // If already appeared, keep visible
    if (hasAppeared.current) {
      setVisible(true)
    }
  }, [isLoading])

  return (
    <LiquidGlassNavbar
      className={cn(
        "transition-all duration-1000",
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
      )}
    >
      {/* Logo - always links to landing */}
      <Link
        href="/"
        className="flex items-center gap-2 text-accent hover:text-[#e0b080] transition-colors"
      >
        <Logo className="h-7 w-auto" />
      </Link>

      {/* Links - morph between landing and dashboard sets */}
      <div className="hidden md:flex items-center gap-6">
        <AnimatePresence mode="wait">
          {navbarMode === "landing" ? (
            <LandingNavLinks key="landing" />
          ) : (
            <DashboardNavLinks key="dashboard" />
          )}
        </AnimatePresence>
      </div>
    </LiquidGlassNavbar>
  )
}
