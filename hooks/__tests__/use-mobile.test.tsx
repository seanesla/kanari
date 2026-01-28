/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { BREAKPOINTS } from "@/lib/constants"

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    configurable: true,
    writable: true,
  })
}

describe("useIsMobile", () => {
  beforeEach(() => {
    const registry = new Map<string, { listeners: Set<() => void>; mql: MediaQueryList & { dispatch: () => void } }>()

    vi.stubGlobal("matchMedia", vi.fn().mockImplementation((query: string) => {
      const existing = registry.get(query)
      if (existing) return existing.mql

      const listeners = new Set<() => void>()
      const mql = {
        get matches() {
          if (query.includes("max-width")) return window.innerWidth < BREAKPOINTS.mobile
          return false
        },
        media: query,
        addEventListener: (_: string, cb: () => void) => listeners.add(cb),
        removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
        dispatch: () => listeners.forEach((cb) => cb()),
      } as unknown as MediaQueryList & { dispatch: () => void }

      registry.set(query, { listeners, mql })
      return mql
    }))
  })

  it("returns true on initial render for small screens", async () => {
    setViewportWidth(375)
    const { useIsMobile } = await import("../use-mobile")
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it("updates when crossing the breakpoint", async () => {
    setViewportWidth(375)
    const { useIsMobile } = await import("../use-mobile")
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)

    act(() => {
      setViewportWidth(1200)
      ;(window.matchMedia(`(max-width: ${BREAKPOINTS.mobile - 1}px)`) as unknown as { dispatch: () => void }).dispatch()
    })

    expect(result.current).toBe(false)
  })
})
