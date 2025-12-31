/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { usePrefer2DOnboarding } from "../use-prefer-2d-onboarding"

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    writable: true,
    configurable: true,
  })
  Object.defineProperty(window, "innerHeight", {
    value: height,
    writable: true,
    configurable: true,
  })
}

function mockMatchMedia({ coarsePointer }: { coarsePointer: boolean }) {
  Object.defineProperty(window, "matchMedia", {
    value: vi.fn().mockImplementation((query: string) => {
      const matches =
        query.includes("(pointer: coarse)") ? coarsePointer : false

      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }
    }),
    writable: true,
    configurable: true,
  })
}

describe("usePrefer2DOnboarding", () => {
  const originalInnerWidth = window.innerWidth
  const originalInnerHeight = window.innerHeight
  const originalMatchMedia = window.matchMedia

  beforeEach(() => {
    setViewport(1400, 800)
    mockMatchMedia({ coarsePointer: false })
  })

  afterEach(() => {
    Object.defineProperty(window, "innerWidth", {
      value: originalInnerWidth,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(window, "innerHeight", {
      value: originalInnerHeight,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(window, "matchMedia", {
      value: originalMatchMedia,
      writable: true,
      configurable: true,
    })
    vi.restoreAllMocks()
  })

  it("returns false on a wide, landscape, non-touch viewport", () => {
    setViewport(1400, 800)
    mockMatchMedia({ coarsePointer: false })

    const { result } = renderHook(() => usePrefer2DOnboarding())
    expect(result.current).toBe(false)
  })

  it("returns true on a narrow viewport", () => {
    setViewport(390, 844)
    mockMatchMedia({ coarsePointer: false })

    const { result } = renderHook(() => usePrefer2DOnboarding())
    expect(result.current).toBe(true)
  })

  it("returns true on a portrait-ish aspect ratio", () => {
    setViewport(1200, 1000) // aspect 1.2 < 4/3
    mockMatchMedia({ coarsePointer: false })

    const { result } = renderHook(() => usePrefer2DOnboarding())
    expect(result.current).toBe(true)
  })

  it("returns true on coarse pointer devices", () => {
    setViewport(1400, 800)
    mockMatchMedia({ coarsePointer: true })

    const { result } = renderHook(() => usePrefer2DOnboarding())
    expect(result.current).toBe(true)
  })
})

