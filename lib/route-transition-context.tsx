"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { isAppRoute } from "@/lib/app-routes"

type RouteGroup = "landing" | "app" | "onboarding" | "demo"

type TransitionPlan = {
  visible: boolean
  startedAt: number
  fromPathname: string
  /** Used only for diagnostics; redirects may not match. */
  toPathname?: string
  /** The pathname we observed as the actual arrival (used to avoid rescheduling). */
  arrivalPathname?: string
  enterMs: number
  exitMs: number
  minTotalMs: number
  auto: boolean
}

type RouteTransitionContextValue = {
  visible: boolean
  enterMs: number
  exitMs: number
  begin: (href: string) => void
}

const RouteTransitionContext = createContext<RouteTransitionContextValue | null>(null)

function getRouteGroup(pathname: string | null | undefined): RouteGroup {
  if (!pathname) return "landing"
  if (pathname === "/demo" || pathname.startsWith("/demo/")) return "demo"
  if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) return "onboarding"
  if (isAppRoute(pathname)) return "app"
  return "landing"
}

function stripPathname(href: string): string | null {
  // Ignore same-page anchors
  if (href.startsWith("#")) return null

  // Ignore external links
  if (/^https?:\/\//i.test(href)) return null

  const q = href.indexOf("?")
  const h = href.indexOf("#")
  const cut = q === -1 ? h : h === -1 ? q : Math.min(q, h)
  const raw = (cut === -1 ? href : href.slice(0, cut)).trim()
  if (!raw.startsWith("/")) return null
  return raw.length ? raw : "/"
}

function shouldAnimateRouteChange(fromGroup: RouteGroup, toGroup: RouteGroup): boolean {
  // App-to-app already animates inside app/(app)/layout.tsx.
  if (fromGroup === "app" && toGroup === "app") return false
  return fromGroup !== toGroup
}

const DEFAULT_PLAN = {
  enterMs: 160,
  exitMs: 520,
  minTotalMs: 1150,
}

const AUTO_PLAN = {
  enterMs: 140,
  exitMs: 420,
  minTotalMs: 900,
}

export function RouteTransitionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/"
  const lastPathnameRef = useRef<string | null>(null)
  const lastGroupRef = useRef<RouteGroup | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const [plan, setPlan] = useState<TransitionPlan | null>(null)

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t)
    timersRef.current = []
  }, [])

  const hide = useCallback(() => {
    setPlan((prev) => {
      if (!prev) return null
      return { ...prev, visible: false }
    })
  }, [])

  const scheduleHideAfterArrival = useCallback((arrivalAt: number, nextPathname: string) => {
    setPlan((prev) => {
      if (!prev) return prev
      if (!prev.visible) return prev

      // See docs/error-patterns/route-transition-overlay-lingers-after-navigation.md
      // If we've already handled this arrival, don't reschedule (avoids update loops).
      if (prev.arrivalPathname === nextPathname) return prev

      const startedAt = prev.startedAt
      const exitStartAt = Math.max(arrivalAt, startedAt + prev.minTotalMs - prev.exitMs)

      clearTimers()
      timersRef.current.push(
        setTimeout(() => {
          hide()
        }, Math.max(0, exitStartAt - performance.now()))
      )

      return { ...prev, arrivalPathname: nextPathname }
    })
  }, [clearTimers, hide])

  const begin = useCallback(
    (href: string) => {
      const toPath = stripPathname(href)
      if (!toPath) return
      if (toPath === pathname) return

      const fromGroup = getRouteGroup(pathname)
      const toGroup = getRouteGroup(toPath)
      if (!shouldAnimateRouteChange(fromGroup, toGroup)) return

      clearTimers()
      const startedAt = performance.now()

      setPlan({
        visible: true,
        startedAt,
        fromPathname: pathname,
        toPathname: toPath,
        ...DEFAULT_PLAN,
        auto: false,
      })

      // Fail-safe: never let the overlay get stuck if navigation stalls.
      timersRef.current.push(
        setTimeout(() => {
          hide()
        }, Math.max(0, 4000 - DEFAULT_PLAN.exitMs))
      )
    },
    [clearTimers, hide, pathname]
  )

  // Auto-start fallback for route changes we didn't initiate (back/forward, redirects, etc.)
  useEffect(() => {
    const nextGroup = getRouteGroup(pathname)

    if (lastPathnameRef.current === null) {
      lastPathnameRef.current = pathname
      lastGroupRef.current = nextGroup
      return
    }

    const lastPathname = lastPathnameRef.current
    const lastGroup = lastGroupRef.current

    lastPathnameRef.current = pathname
    lastGroupRef.current = nextGroup

    if (lastPathname === pathname) return

    // If a transition is already active, treat this as the arrival.
    if (plan?.visible && plan.fromPathname !== pathname) {
      scheduleHideAfterArrival(performance.now(), pathname)
      return
    }

    // Otherwise, optionally run a shorter auto transition for cross-group changes.
    if (lastGroup && shouldAnimateRouteChange(lastGroup, nextGroup)) {
      clearTimers()
      const startedAt = performance.now()
      setPlan({
        visible: true,
        startedAt,
        fromPathname: lastPathname,
        toPathname: pathname,
        ...AUTO_PLAN,
        auto: true,
      })

      // In auto mode, we don't know when the next route mounts; still honor minTotal.
      timersRef.current.push(
        setTimeout(() => {
          hide()
        }, Math.max(0, AUTO_PLAN.minTotalMs - AUTO_PLAN.exitMs))
      )
    }
  }, [pathname, plan?.visible, plan?.fromPathname, clearTimers, hide, scheduleHideAfterArrival])

  // When we start a managed transition, wait until the route actually changes, then schedule exit.
  useEffect(() => {
    if (!plan?.visible) return
    if (plan.auto) return
    if (pathname === plan.fromPathname) return
    scheduleHideAfterArrival(performance.now(), pathname)
  }, [pathname, plan?.visible, plan?.auto, plan?.fromPathname, plan?.toPathname, scheduleHideAfterArrival])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [clearTimers])

  const value = useMemo<RouteTransitionContextValue>(() => {
    return {
      visible: Boolean(plan?.visible),
      enterMs: plan?.enterMs ?? DEFAULT_PLAN.enterMs,
      exitMs: plan?.exitMs ?? DEFAULT_PLAN.exitMs,
      begin,
    }
  }, [plan?.visible, plan?.enterMs, plan?.exitMs, begin])

  return <RouteTransitionContext.Provider value={value}>{children}</RouteTransitionContext.Provider>
}

export function useRouteTransition() {
  const ctx = useContext(RouteTransitionContext)
  if (!ctx) throw new Error("useRouteTransition must be used within a RouteTransitionProvider")
  return ctx
}
