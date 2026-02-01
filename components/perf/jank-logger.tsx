"use client"

import { useEffect } from "react"

function isPerfDebugEnabled(): boolean {
  if (typeof window === "undefined") return false
  try {
    const url = new URL(window.location.href)
    if (url.searchParams.has("perf")) return true
  } catch {
    // ignore
  }

  try {
    return window.localStorage.getItem("kanari:perfDebug") === "true"
  } catch {
    return false
  }
}

export function JankLogger() {
  useEffect(() => {
    if (!isPerfDebugEnabled()) return

    const FRAME_GAP_WARN_MS = 140

    let rafId: number | null = null
    let lastFrameAt = performance.now()

    const tick = () => {
      const now = performance.now()
      const dt = now - lastFrameAt
      if (dt > FRAME_GAP_WARN_MS) {
        const dtRounded = Math.round(dt)
        const memory = (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory
        const usedMB = memory?.usedJSHeapSize ? Math.round(memory.usedJSHeapSize / (1024 * 1024)) : null
        console.warn(`[Perf] Frame gap ${dtRounded}ms`, {
          dtMs: dtRounded,
          hidden: typeof document !== "undefined" ? document.visibilityState === "hidden" : null,
          usedHeapMB: usedMB,
        })
      }
      lastFrameAt = now
      rafId = window.requestAnimationFrame(tick)
    }

    rafId = window.requestAnimationFrame(tick)

    let longTaskObserver: PerformanceObserver | null = null
    if (typeof PerformanceObserver !== "undefined") {
      try {
        longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            // Long Task API reports entries > 50ms.
            console.warn("[Perf] Long task", {
              name: entry.name,
              durationMs: Math.round(entry.duration),
              startTimeMs: Math.round(entry.startTime),
              entryType: entry.entryType,
            })
          }
        })

        // TS libdom doesn't include 'longtask' in all environments.
        longTaskObserver.observe({ type: "longtask", buffered: true } as unknown as PerformanceObserverInit)
      } catch {
        // Long Task API not supported (Safari/Firefox).
      }
    }

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
      }
      longTaskObserver?.disconnect()
    }
  }, [])

  return null
}
