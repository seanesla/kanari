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
import { usePathname, useRouter } from "next/navigation"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/lib/storage/db"
import { findDemoElement, scrollToElement } from "@/lib/demo/demo-utils"
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
  /** Skip the current step (demo) or skip the guide (first-time) */
  skip: () => void
  /** Exit the active guide immediately */
  exitGuide: () => void
  /** Whether advancing is allowed for this step */
  canAdvance: boolean
  /** IDs of demo steps skipped during this run */
  skippedStepIds: string[]
  /** Manually start a specific guide (used by Settings replay) */
  startGuide: (type: GuidanceType, options?: { resume?: boolean }) => void
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

const DEMO_GUIDE_PROGRESS_KEY = "kanari_demo_guide_progress_v1"

type DemoGuideProgressV1 = {
  version: 1
  stepIndex: number
  skippedStepIds: string[]
}

function safeReadDemoGuideProgress(): DemoGuideProgressV1 | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(DEMO_GUIDE_PROGRESS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DemoGuideProgressV1
    if (parsed?.version !== 1) return null
    if (typeof parsed.stepIndex !== "number") return null
    if (!Array.isArray(parsed.skippedStepIds)) return null
    return parsed
  } catch {
    return null
  }
}

function safeWriteDemoGuideProgress(progress: DemoGuideProgressV1): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(DEMO_GUIDE_PROGRESS_KEY, JSON.stringify(progress))
  } catch {
    // Ignore localStorage failures.
  }
}

function safeClearDemoGuideProgress(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(DEMO_GUIDE_PROGRESS_KEY)
  } catch {
    // Ignore localStorage failures.
  }
}

function getRoutePathname(route: string): string {
  const fallback = route.split("?")[0] ?? route
  if (typeof window === "undefined") return fallback
  try {
    return new URL(route, window.location.origin).pathname
  } catch {
    return fallback
  }
}

function isVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function ensureMobileCheckInsSidebarOpen(): void {
  if (typeof window === "undefined") return
  if (window.innerWidth >= 768) return

  const alreadyOpen = document.querySelector('[data-slot="sheet-content"][data-mobile="true"]')
  if (alreadyOpen) return

  const triggers = Array.from(document.querySelectorAll<HTMLElement>('[data-sidebar="trigger"]'))
  const trigger = triggers.find(isVisible)
  if (trigger) {
    trigger.click()
  }
}

function getDemoElementById(demoId: string): HTMLElement | null {
  if (typeof window === "undefined") return null
  return document.querySelector<HTMLElement>(`[data-demo-id="${demoId}"]`)
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function GuidanceProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

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
  const [skippedStepIds, setSkippedStepIds] = useState<string[]>([])
  const [canAdvance, setCanAdvance] = useState(true)

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
    setCanAdvance(true)

    // Persist completion for first-time guide so it only auto-starts once
    if (type === "first-time") {
      await patchSettings({
        hasCompletedFirstTimeGuide: true,
        firstTimeGuideCompletedAt: new Date().toISOString(),
      })
      return
    }

    if (type === "demo") {
      safeClearDemoGuideProgress()
      setSkippedStepIds([])
    }
  }, [])

  const enforceDemoStepContext = useCallback((step: GuidanceStep) => {
    if (typeof window === "undefined") return

    if (step.route) {
      const expectedPath = getRoutePathname(step.route)
      if (pathname !== expectedPath) {
        router.push(step.route)
        return
      }
    }

    if (step.autoOpen === "checkins-mobile-sidebar") {
      ensureMobileCheckInsSidebarOpen()
    }

    if (!step.target) return

    const target = findDemoElement(step.target)
    if (target) {
      scrollToElement(target, "center")
      return
    }

    // A step route can carry UI context (for example /overview?view=trends).
    // If the target is missing, re-apply route context instead of letting the
    // user continue on the wrong screen.
    // See: docs/error-patterns/demo-guide-step-route-context-not-enforced.md
    if (step.route) {
      router.push(step.route)
    }
  }, [pathname, router])

  const next = useCallback(() => {
    if (!activeGuide) return
    if (activeGuide === "demo" && !canAdvance) {
      if (currentStep) {
        enforceDemoStepContext(currentStep)
      }
      return
    }
    if (stepIndex >= totalSteps - 1) {
      // Last step -> complete
      void completeGuide(activeGuide)
    } else {
      setStepIndex((i) => i + 1)
    }
  }, [activeGuide, canAdvance, currentStep, enforceDemoStepContext, stepIndex, totalSteps, completeGuide])

  const prev = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1))
  }, [])

  const skip = useCallback(() => {
    if (!activeGuide) return
    if (activeGuide === "demo") {
      const currentStepId = currentStep?.id
      if (currentStepId) {
        setSkippedStepIds((prev) => {
          if (prev.includes(currentStepId)) return prev
          return [...prev, currentStepId]
        })
      }

      if (stepIndex >= totalSteps - 1) {
        void completeGuide("demo")
      } else {
        setStepIndex((i) => i + 1)
      }
      return
    }

    void completeGuide(activeGuide)
  }, [activeGuide, currentStep?.id, stepIndex, totalSteps, completeGuide])

  const exitGuide = useCallback(() => {
    if (!activeGuide) return
    void completeGuide(activeGuide)
  }, [activeGuide, completeGuide])

  const startGuide = useCallback((type: GuidanceType, options?: { resume?: boolean }) => {
    const shouldResume = options?.resume === true

    if (type === "demo" && shouldResume) {
      const saved = safeReadDemoGuideProgress()
      const maxIndex = Math.max(0, getStepsForGuide("demo").length - 1)
      const resumedIndex = saved ? Math.max(0, Math.min(saved.stepIndex, maxIndex)) : 0
      const resumedSkipped = saved
        ? Array.from(new Set(saved.skippedStepIds.filter((id): id is string => typeof id === "string" && id.length > 0)))
        : []

      setStepIndex(resumedIndex)
      setSkippedStepIds(resumedSkipped)
    } else {
      setStepIndex(0)
      setSkippedStepIds([])
    }

    setActiveGuide(type)
  }, [])

  useEffect(() => {
    if (activeGuide !== "demo" || !currentStep) {
      setCanAdvance(true)
      return
    }

    if (!currentStep.completionTarget) {
      setCanAdvance(true)
      return
    }

    const updateCompletion = () => {
      setCanAdvance(!!getDemoElementById(currentStep.completionTarget!))
    }

    updateCompletion()

    const observer = new MutationObserver(() => updateCompletion())
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "data-demo-id"],
    })

    return () => observer.disconnect()
  }, [activeGuide, currentStep?.id, currentStep?.completionTarget, pathname])

  useEffect(() => {
    if (activeGuide !== "demo") return

    safeWriteDemoGuideProgress({
      version: 1,
      stepIndex,
      skippedStepIds,
    })
  }, [activeGuide, stepIndex, skippedStepIds])

  useEffect(() => {
    if (activeGuide !== "demo" || !currentStep) return
    enforceDemoStepContext(currentStep)
  }, [activeGuide, currentStep?.id, pathname, enforceDemoStepContext])

  useEffect(() => {
    if (activeGuide !== "demo" || !currentStep) return

    const onClickCapture = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return

      if (target.closest("[data-guidance-demo-popup]")) return

      const primaryTarget = currentStep.target ? findDemoElement(currentStep.target) : null
      if (primaryTarget && primaryTarget.contains(target)) return

      const completionTarget = currentStep.completionTarget
        ? getDemoElementById(currentStep.completionTarget)
        : null
      if (completionTarget && completionTarget.contains(target)) return

      if (target.closest("[data-guidance-allow]")) return

      event.preventDefault()
      event.stopPropagation()
      enforceDemoStepContext(currentStep)
    }

    document.addEventListener("click", onClickCapture, true)
    return () => {
      document.removeEventListener("click", onClickCapture, true)
    }
  }, [activeGuide, currentStep?.id, currentStep?.target, currentStep?.completionTarget, enforceDemoStepContext])

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
      startGuide("demo", { resume: true })
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
      exitGuide,
      canAdvance,
      skippedStepIds,
      startGuide,
    }),
    [activeGuide, currentStep, stepIndex, totalSteps, next, prev, skip, exitGuide, canAdvance, skippedStepIds, startGuide]
  )

  return (
    <GuidanceContext.Provider value={value}>{children}</GuidanceContext.Provider>
  )
}
