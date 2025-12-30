"use client"

/**
 * Onboarding Layout Component
 *
 * Provides the visual structure for onboarding steps.
 * Includes step indicator, navigation, and content area.
 */

import { motion, AnimatePresence } from "framer-motion"
import { Link } from "next-view-transitions"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/logo"
import { FloatingOrbs } from "@/components/onboarding/floating-orbs"

interface OnboardingLayoutProps {
  /** Current step (0-indexed) */
  currentStep: number
  /** Total number of steps */
  totalSteps: number
  /** Step content */
  children: React.ReactNode
  /** Additional class names */
  className?: string
}

export function OnboardingLayout({
  currentStep,
  totalSteps,
  children,
  className,
}: OnboardingLayoutProps) {
  return (
    <div className={cn("min-h-screen flex flex-col relative overflow-hidden", className)}>
      {/* Animated background */}
      <FloatingOrbs />

      {/* Header with logo and progress */}
      <header className="relative z-10 px-6 py-4 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="text-accent hover:text-accent/80 transition-all duration-300 hover:scale-105"
            title="Back to home"
          >
            <Logo className="h-10 w-auto" />
          </Link>

          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  i === currentStep
                    ? "w-8 bg-accent"
                    : i < currentStep
                      ? "w-2 bg-accent/50"
                      : "w-2 bg-border"
                )}
              />
            ))}
          </div>
        </div>
      </header>

      {/* Content area */}
      <main className="relative z-10 flex-1 px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
