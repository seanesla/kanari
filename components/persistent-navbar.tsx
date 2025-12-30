"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { usePathname } from "next/navigation"
import { Link } from "next-view-transitions"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X } from "lucide-react"
import { useSceneMode } from "@/lib/scene-context"
import { useNavbar, ONBOARDING_STEPS } from "@/lib/navbar-context"
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
  { id: "dashboard", href: "/dashboard", label: "Dashboard", exact: true },
  { id: "history", href: "/dashboard/history", label: "Sessions", exact: false },
  { id: "analytics", href: "/dashboard/analytics", label: "Analytics", exact: false },
  { id: "settings", href: "/dashboard/settings", label: "Settings", exact: true },
]

// Glass styling for mobile menu dropdown
const mobileMenuGlassStyle = {
  backdropFilter: "blur(24px) saturate(200%)",
  WebkitBackdropFilter: "blur(24px) saturate(200%)",
  background: "rgba(255, 255, 255, 0.02)",
  border: "1px solid rgba(255, 255, 255, 0.05)",
  boxShadow: `
    inset 0 1px 0 0 rgba(255, 255, 255, 0.06),
    inset 0 -1px 0 0 rgba(0, 0, 0, 0.02),
    0 8px 32px rgba(0, 0, 0, 0.25),
    0 2px 8px rgba(0, 0, 0, 0.1)
  `,
} as const

// Reusable mobile nav link with staggered animation
function MobileNavLink({
  href,
  label,
  index,
  onClick,
}: {
  href: string
  label: string
  index: number
  onClick: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: 0.1 + index * 0.05 }}
    >
      <Link
        href={href}
        onClick={onClick}
        className="block text-sm text-muted-foreground hover:text-foreground px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors"
      >
        {label}
      </Link>
    </motion.div>
  )
}

// Mobile onboarding step link with disabled future steps
function MobileOnboardingLink({
  label,
  index,
  stepIndex,
  currentStep,
  highestStepReached,
  onClick,
}: {
  label: string
  index: number
  stepIndex: number
  currentStep: number
  highestStepReached: number
  onClick: () => void
}) {
  const isActive = stepIndex === currentStep
  // Use highestStepReached so visited steps stay accessible when going back
  const isVisited = stepIndex <= highestStepReached
  const isFuture = stepIndex > highestStepReached
  const isClickable = isVisited

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: 0.1 + index * 0.05 }}
    >
      <button
        onClick={() => isClickable && onClick()}
        disabled={isFuture}
        className={cn(
          "block w-full text-left text-sm px-3 py-2.5 rounded-lg transition-colors",
          isActive && "text-foreground bg-white/5",
          isVisited && !isActive && "text-muted-foreground hover:text-foreground hover:bg-white/5 cursor-pointer",
          isFuture && "text-muted-foreground/40 cursor-not-allowed"
        )}
      >
        {label}
      </button>
    </motion.div>
  )
}

interface NavLinkProps {
  href: string
  label: string
  isActive: boolean
}

function NavLink({ href, label, isActive }: NavLinkProps) {
  return (
    <Link
      href={href}
      prefetch={true}
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

function OnboardingNavLinks() {
  const { onboardingStep, setOnboardingStep, highestStepReached } = useNavbar()

  return (
    <motion.nav
      className="flex items-center gap-1"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      {ONBOARDING_STEPS.map((step, index) => {
        const isActive = index === onboardingStep
        // Use highestStepReached so visited steps stay accessible when going back
        const isVisited = index <= highestStepReached
        const isFuture = index > highestStepReached
        const isClickable = isVisited

        return (
          <button
            key={step.id}
            onClick={() => isClickable && setOnboardingStep(index)}
            disabled={isFuture}
            className={cn(
              "relative text-sm transition-colors px-2.5 py-1",
              isActive && "text-foreground",
              isVisited && !isActive && "text-muted-foreground hover:text-foreground cursor-pointer",
              isFuture && "text-muted-foreground/40 cursor-not-allowed"
            )}
          >
            {step.label}
            {isActive && (
              <motion.div
                layoutId="nav-indicator"
                className="absolute -bottom-1 left-0 right-0 h-0.5 bg-accent rounded-full"
                initial={false}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        )
      })}
    </motion.nav>
  )
}

export function PersistentNavbar() {
  const pathname = usePathname()
  const { isLoading } = useSceneMode()
  const { navbarMode, onboardingStep, setOnboardingStep, highestStepReached } = useNavbar()
  const [visible, setVisible] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const hasAppeared = useRef(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const hamburgerRef = useRef<HTMLButtonElement>(null)

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

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)")
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileMenuOpen(false)
    }
    mediaQuery.addEventListener("change", handler)
    return () => mediaQuery.removeEventListener("change", handler)
  }, [])

  // Close mobile menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [mobileMenuOpen])

  // Close mobile menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        mobileMenuOpen &&
        mobileMenuRef.current &&
        hamburgerRef.current &&
        !mobileMenuRef.current.contains(e.target as Node) &&
        !hamburgerRef.current.contains(e.target as Node)
      ) {
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [mobileMenuOpen])

  // Close mobile menu when navigating
  const handleMobileNavClick = useCallback(() => {
    setMobileMenuOpen(false)
  }, [])

  return (
    <>
      {/* Desktop: Glass navbar pill - crossfades with mobile */}
      <div
        className={cn(
          "pointer-events-none opacity-0 md:pointer-events-auto md:opacity-100",
          "transition-opacity duration-300 ease-in-out"
        )}
      >
        <LiquidGlassNavbar
          className={cn(
            "transition-all duration-1000",
            visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
          )}
        >
          <Link
            href="/"
            className="flex items-center gap-2 text-accent hover:text-accent-light transition-colors"
          >
            <Logo className="h-7 w-auto" />
          </Link>

          <div className="flex items-center gap-6">
            <AnimatePresence mode="wait">
              {navbarMode === "landing" ? (
                <LandingNavLinks key="landing" />
              ) : navbarMode === "dashboard" ? (
                <DashboardNavLinks key="dashboard" />
              ) : (
                <OnboardingNavLinks key="onboarding" />
              )}
            </AnimatePresence>
          </div>
        </LiquidGlassNavbar>
      </div>

      {/* Mobile: Simple full-width header - crossfades with desktop */}
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50",
          "transition-all duration-300 ease-in-out",
          // Hide on desktop
          "md:opacity-0 md:pointer-events-none",
          // Page load animation
          visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
        )}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-accent hover:text-accent-light transition-colors"
          >
            <Logo className="h-10 w-auto" />
          </Link>

          <button
            ref={hamburgerRef}
            className="p-2 text-foreground/80 hover:text-foreground transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            <AnimatePresence mode="wait" initial={false}>
              {mobileMenuOpen ? (
                <motion.div
                  key="close"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <X className="h-9 w-9" />
                </motion.div>
              ) : (
                <motion.div
                  key="menu"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Menu className="h-9 w-9" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        </div>

        {/* Mobile menu dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              ref={mobileMenuRef}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden mx-4 mb-4 rounded-2xl md:hidden"
              style={mobileMenuGlassStyle}
            >
              <motion.nav
                className="flex flex-col gap-1 p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, delay: 0.1 }}
              >
                {navbarMode === "landing" ? (
                  <>
                    {landingLinks.map((link, index) => (
                      <MobileNavLink
                        key={link.id}
                        href={link.href}
                        label={link.label}
                        index={index}
                        onClick={handleMobileNavClick}
                      />
                    ))}
                    <motion.div
                      className="pt-2 px-3"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: 0.1 + landingLinks.length * 0.05 }}
                    >
                      <EnterButton variant="nav" />
                    </motion.div>
                  </>
                ) : navbarMode === "dashboard" ? (
                  dashboardLinks.map((link, index) => (
                    <MobileNavLink
                      key={link.id}
                      href={link.href}
                      label={link.label}
                      index={index}
                      onClick={handleMobileNavClick}
                    />
                  ))
                ) : (
                  ONBOARDING_STEPS.map((step, index) => (
                    <MobileOnboardingLink
                      key={step.id}
                      label={step.label}
                      index={index}
                      stepIndex={index}
                      currentStep={onboardingStep}
                      highestStepReached={highestStepReached}
                      onClick={() => {
                        setOnboardingStep(index)
                        handleMobileNavClick()
                      }}
                    />
                  ))
                )}
              </motion.nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  )
}
