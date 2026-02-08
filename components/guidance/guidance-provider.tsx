"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/storage/db"
import { patchSettings } from "@/lib/settings/patch-settings"
import { isDemoWorkspace } from "@/lib/workspace"
import type { UserSettings } from "@/lib/types"
import { getStepsForGuide } from "./guidance-steps"
import type { GuidanceType, GuidanceStep } from "./guidance-steps"

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

interface GuidanceContextValue {
  /** Which guide is currently active, or null if none */
  activeGuide: GuidanceType | null
  /** The current step being shown (null when no guide is active) */
  currentStep: GuidanceStep | null
  /** Zero-based index of the current step */
  currentStepIndex: number
  /** Total steps in the active guide */
  totalSteps: number
  /** Go to the next step (completes if on last step) */
  next: () => void
  /** Go to the previous step */
  prev: () => void
  /** Skip the guide entirely */
  skip: () => void
  /** Manually start a specific guide (used by Settings replay) */
  startGuide: (type: GuidanceType) => void
}

const GuidanceContext = createContext<GuidanceContextValue | null>(null)

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGuidance(): GuidanceContextValue {
  const ctx = useContext(GuidanceContext)
  if (!ctx) {
    throw new Error("useGuidance must be used inside <GuidanceProvider>")
  }
  return ctx
}

// ---------------------------------------------------------------------------
// Sentinel for Dexie loading state
// ---------------------------------------------------------------------------

const LOADING = Symbol("guidance-loading")

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function GuidanceProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  // ----- Settings from IndexedDB (reactive) -----
  const dbSettings = useLiveQuery(
    () => db.settings.get("default"),
    [],
    LOADING
  ) as unknown as UserSettings | undefined | typeof LOADING

  const isLoading = dbSettings === LOADING
  const settings = dbSettings === LOADING ? null : dbSettings ?? null

  // ----- Local state -----
  const [activeGuide, setActiveGuide] = useState<GuidanceType | null>(null)
  const [stepIndex, setStepIndex] = useState(0)

  // Track whether the demo guide has already auto-started this app session.
  // We use a ref so it survives re-renders but resets on page reload (new session).
  const demoGuideStartedThisSession = useRef(false)

  // Track whether the first-time guide auto-start has been evaluated.
  const firstTimeAutoStartEvaluated = useRef(false)

  // ----- Derived -----
  const steps = activeGuide ? getStepsForGuide(activeGuide) : []
  const currentStep = steps[stepIndex] ?? null
  const totalSteps = steps.length

  // ----- Actions -----

  const completeGuide = useCallback(async (type: GuidanceType) => {
    setActiveGuide(null)
    setStepIndex(0)

    // Persist completion for first-time guide so it only auto-starts once
    if (type === "first-time") {
      await patchSettings({
        hasCompletedFirstTimeGuide: true,
        firstTimeGuideCompletedAt: new Date().toISOString(),
      })
    }
  }, [])

  const next = useCallback(() => {
    if (!activeGuide) return
    if (stepIndex >= totalSteps - 1) {
      // Last step -> complete
      completeGuide(activeGuide)
    } else {
      setStepIndex((i) => i + 1)
    }
  }, [activeGuide, stepIndex, totalSteps, completeGuide])

  const prev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1))
  }, [])

  const skip = useCallback(() => {
    if (!activeGuide) return
    completeGuide(activeGuide)
  }, [activeGuide, completeGuide])

  const startGuide = useCallback((type: GuidanceType) => {
    setStepIndex(0)
    setActiveGuide(type)
  }, [])

  // ----- Auto-start logic -----

  useEffect(() => {
    if (isLoading || !settings) return
    // Only auto-start when user is on /overview
    if (pathname !== "/overview") return
    // Don't interrupt an already-active guide
    if (activeGuide) return

    const onboardingComplete = settings.hasCompletedOnboarding === true
    if (!onboardingComplete) return

    const isDemo = isDemoWorkspace()

    // --- Demo guide: auto-start once per app session ---
    if (isDemo && !demoGuideStartedThisSession.current) {
      demoGuideStartedThisSession.current = true
      startGuide("demo")
      return
    }

    // --- First-time guide: auto-start once ever ---
    if (
      !isDemo &&
      !settings.hasCompletedFirstTimeGuide &&
      !firstTimeAutoStartEvaluated.current
    ) {
      firstTimeAutoStartEvaluated.current = true
      startGuide("first-time")
    }
  }, [isLoading, settings, pathname, activeGuide, startGuide])

  // ----- Context value (memoized) -----

  const value = useMemo<GuidanceContextValue>(
    () => ({
      activeGuide,
      currentStep,
      currentStepIndex: stepIndex,
      totalSteps,
      next,
      prev,
      skip,
      startGuide,
    }),
    [activeGuide, currentStep, stepIndex, totalSteps, next, prev, skip, startGuide]
  )

  return (
    <GuidanceContext.Provider value={value}>{children}</GuidanceContext.Provider>
  )
}
