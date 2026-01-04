"use client"

import { useEffect, useState } from "react"

/**
 * Returns `true` once a client component instance is "stable" in development.
 *
 * In React StrictMode (dev), React intentionally mounts, unmounts, and re-mounts
 * components to help detect side effects. If a user clicks a "Start" button
 * during that probe window, async initialization can be aborted by the forced
 * unmount and the click appears to do nothing.
 *
 * Pattern doc: docs/error-patterns/strictmode-start-click-eaten.md
 *
 * This hook keeps an interaction disabled during the first mount in dev.
 * - In StrictMode: the second mount becomes ready immediately.
 * - Without StrictMode (or in unusual envs): a fallback timer enables readiness.
 */

const isProd = process.env.NODE_ENV === "production"

let devProbeSeen = false
let devReady = isProd

export function useStrictModeReady(enabled: boolean, fallbackMs: number = 250): boolean {
  const [ready, setReady] = useState(() => (enabled ? devReady : true))

  useEffect(() => {
    if (!enabled) {
      setReady(true)
      return
    }

    if (devReady) {
      setReady(true)
      return
    }

    // Second mount after the StrictMode probe: allow interactions immediately.
    if (devProbeSeen) {
      devReady = true
      setReady(true)
      return
    }

    // First mount in dev: hold off. If StrictMode is enabled, React will unmount
    // this instance before the timer fires. If not, the timer is a safe fallback.
    devProbeSeen = true
    const id = setTimeout(() => {
      devReady = true
      setReady(true)
    }, fallbackMs)

    return () => clearTimeout(id)
  }, [enabled, fallbackMs])

  return ready
}
