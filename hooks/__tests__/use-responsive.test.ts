/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useResponsive } from "../use-responsive"

describe("useResponsive", () => {
  const originalInnerWidth = window.innerWidth
  let resizeListeners: (() => void)[] = []

  beforeEach(() => {
    vi.useFakeTimers()
    resizeListeners = []

    // Mock window.addEventListener to capture resize listeners
    vi.spyOn(window, "addEventListener").mockImplementation((event, handler) => {
      if (event === "resize" && typeof handler === "function") {
        resizeListeners.push(handler)
      }
    })

    vi.spyOn(window, "removeEventListener").mockImplementation((event, handler) => {
      if (event === "resize" && typeof handler === "function") {
        resizeListeners = resizeListeners.filter((h) => h !== handler)
      }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    Object.defineProperty(window, "innerWidth", {
      value: originalInnerWidth,
      writable: true,
    })
  })

  function setWindowWidth(width: number) {
    Object.defineProperty(window, "innerWidth", {
      value: width,
      writable: true,
      configurable: true,
    })
  }

  function triggerResize() {
    resizeListeners.forEach((listener) => listener())
  }

  it("returns isMobile: false for desktop width (default breakpoint 1024)", () => {
    setWindowWidth(1200)
    const { result } = renderHook(() => useResponsive())
    expect(result.current.isMobile).toBe(false)
  })

  it("returns isMobile: true for mobile width", () => {
    setWindowWidth(800)
    const { result } = renderHook(() => useResponsive())
    expect(result.current.isMobile).toBe(true)
  })

  it("returns isMobile: false at exactly breakpoint width", () => {
    setWindowWidth(1024)
    const { result } = renderHook(() => useResponsive())
    expect(result.current.isMobile).toBe(false)
  })

  it("returns isMobile: true just below breakpoint", () => {
    setWindowWidth(1023)
    const { result } = renderHook(() => useResponsive())
    expect(result.current.isMobile).toBe(true)
  })

  it("respects custom breakpoint parameter", () => {
    setWindowWidth(600)
    const { result } = renderHook(() => useResponsive(768))
    expect(result.current.isMobile).toBe(true)

    setWindowWidth(800)
    const { result: result2 } = renderHook(() => useResponsive(768))
    expect(result2.current.isMobile).toBe(false)
  })

  it("debounces resize events (waits 150ms)", () => {
    setWindowWidth(1200)
    const { result } = renderHook(() => useResponsive())
    expect(result.current.isMobile).toBe(false)

    // Change to mobile width
    setWindowWidth(800)
    triggerResize()

    // Should not update immediately due to debounce
    expect(result.current.isMobile).toBe(false)

    // Fast-forward 100ms (still debouncing)
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current.isMobile).toBe(false)

    // Fast-forward remaining 50ms (debounce complete)
    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(result.current.isMobile).toBe(true)
  })

  it("cancels pending debounce on rapid resize", () => {
    setWindowWidth(1200)
    const { result } = renderHook(() => useResponsive())

    // First resize to mobile
    setWindowWidth(800)
    triggerResize()

    // After 100ms, resize back to desktop
    act(() => {
      vi.advanceTimersByTime(100)
    })
    setWindowWidth(1200)
    triggerResize()

    // After another 150ms, should be desktop (second resize wins)
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(result.current.isMobile).toBe(false)
  })

  it("cleans up event listener and timeout on unmount", () => {
    setWindowWidth(1200)
    const { unmount } = renderHook(() => useResponsive())

    expect(resizeListeners.length).toBe(1)

    unmount()

    expect(resizeListeners.length).toBe(0)
  })
})
