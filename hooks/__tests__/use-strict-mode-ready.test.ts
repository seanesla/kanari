/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"

describe("useStrictModeReady", () => {
  it("returns true when disabled", async () => {
    vi.resetModules()
    const { useStrictModeReady } = await import("../use-strict-mode-ready")

    const { result } = renderHook(() => useStrictModeReady(false))
    expect(result.current).toBe(true)
  })

  it("becomes true after the fallback delay on a single dev mount", async () => {
    vi.useFakeTimers()
    vi.resetModules()
    const { useStrictModeReady } = await import("../use-strict-mode-ready")

    const { result } = renderHook(() => useStrictModeReady(true, 50))
    expect(result.current).toBe(false)

    await act(async () => {
      vi.advanceTimersByTime(50)
    })

    expect(result.current).toBe(true)
    vi.useRealTimers()
  })

  it("becomes true immediately on the second mount (StrictMode probe)", async () => {
    vi.useFakeTimers()
    vi.resetModules()
    const { useStrictModeReady } = await import("../use-strict-mode-ready")

    const first = renderHook(() => useStrictModeReady(true, 10_000))
    expect(first.result.current).toBe(false)
    first.unmount()

    const second = renderHook(() => useStrictModeReady(true, 10_000))
    expect(second.result.current).toBe(true)
    second.unmount()

    vi.useRealTimers()
  })
})

