"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { findDemoElement, getDemoSafeAreas, getElementRect } from "@/lib/demo/demo-utils"

type ViewportSize = {
  width: number
  height: number
}

type DemoSafeAreas = {
  top: number
  bottom: number
}

interface DemoPositionState {
  targetRect: DOMRect | null
  viewport: ViewportSize
  safeAreas: DemoSafeAreas
  isScrolling: boolean
}

interface UseDemoPositionOptions {
  targetId: string | null
  enabled: boolean
}

const SCROLL_STOP_DELAY_MS = 140
const TRACKING_FPS_MS = 16

const emptyViewport: ViewportSize = { width: 0, height: 0 }
const emptySafeAreas: DemoSafeAreas = { top: 0, bottom: 0 }

function roundToDpr(value: number): number {
  if (typeof window === "undefined") return value
  const dpr = window.devicePixelRatio || 1
  return Math.round(value * dpr) / dpr
}

function roundRectToDpr(rect: DOMRect): DOMRect {
  return new DOMRect(
    roundToDpr(rect.x),
    roundToDpr(rect.y),
    roundToDpr(rect.width),
    roundToDpr(rect.height)
  )
}

function isSameRect(a: DOMRect | null, b: DOMRect | null): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

function isSameViewport(a: ViewportSize, b: ViewportSize): boolean {
  return a.width === b.width && a.height === b.height
}

function isSameSafeAreas(a: DemoSafeAreas, b: DemoSafeAreas): boolean {
  return a.top === b.top && a.bottom === b.bottom
}

export function useDemoPosition({ targetId, enabled }: UseDemoPositionOptions): DemoPositionState {
  const [state, setState] = useState<DemoPositionState>(() => ({
    targetRect: null,
    viewport: emptyViewport,
    safeAreas: emptySafeAreas,
    isScrolling: false,
  }))

  const rafIdRef = useRef<number | null>(null)
  const scrollTimeoutRef = useRef<number | null>(null)
  const isScrollingRef = useRef(false)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const observedElementRef = useRef<HTMLElement | null>(null)

  const requestFrame = useCallback((cb: FrameRequestCallback) => {
    if (typeof window.requestAnimationFrame === "function") {
      return window.requestAnimationFrame(cb)
    }
    return window.setTimeout(() => cb(Date.now()), TRACKING_FPS_MS)
  }, [])

  const cancelFrame = useCallback((id: number) => {
    if (typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(id)
      return
    }
    window.clearTimeout(id)
  }, [])

  const updateObservedElement = useCallback((element: HTMLElement | null) => {
    if (!resizeObserverRef.current) return
    if (observedElementRef.current === element) return
    if (observedElementRef.current) {
      resizeObserverRef.current.unobserve(observedElementRef.current)
    }
    if (element) {
      resizeObserverRef.current.observe(element)
    }
    observedElementRef.current = element
  }, [])

  const updatePositionNow = useCallback(() => {
    if (!enabled || typeof window === "undefined") return

    const nextViewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    }
    const nextSafeAreas = getDemoSafeAreas()
    const element = targetId ? findDemoElement(targetId) : null
    const nextRect = element ? roundRectToDpr(getElementRect(element)) : null

    updateObservedElement(element)

    setState((prev) => {
      if (
        isSameRect(prev.targetRect, nextRect) &&
        isSameViewport(prev.viewport, nextViewport) &&
        isSameSafeAreas(prev.safeAreas, nextSafeAreas) &&
        prev.isScrolling === isScrollingRef.current
      ) {
        return prev
      }

      return {
        targetRect: nextRect,
        viewport: nextViewport,
        safeAreas: nextSafeAreas,
        isScrolling: isScrollingRef.current,
      }
    })
  }, [enabled, targetId, updateObservedElement])

  const scheduleUpdate = useCallback(() => {
    if (!enabled || rafIdRef.current != null) return
    rafIdRef.current = requestFrame(() => {
      rafIdRef.current = null
      updatePositionNow()
    })
  }, [enabled, requestFrame, updatePositionNow])

  const stopScrolling = useCallback(() => {
    if (!isScrollingRef.current) return
    isScrollingRef.current = false
    scheduleUpdate()
  }, [scheduleUpdate])

  const handleScroll = useCallback(() => {
    if (!enabled) return

    if (!isScrollingRef.current) {
      isScrollingRef.current = true
    }

    scheduleUpdate()

    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current)
    }
    scrollTimeoutRef.current = window.setTimeout(() => {
      stopScrolling()
    }, SCROLL_STOP_DELAY_MS)
  }, [enabled, scheduleUpdate, stopScrolling])

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return

    if (typeof ResizeObserver !== "undefined") {
      resizeObserverRef.current = new ResizeObserver(() => scheduleUpdate())
    }

    scheduleUpdate()

    window.addEventListener("resize", scheduleUpdate)
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true })

    if ("onscrollend" in window) {
      window.addEventListener("scrollend", stopScrolling, { passive: true })
    }

    const mutationObserver = new MutationObserver(() => scheduleUpdate())
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "data-demo-id"],
    })

    return () => {
      window.removeEventListener("resize", scheduleUpdate)
      window.removeEventListener("scroll", handleScroll, true)
      if ("onscrollend" in window) {
        window.removeEventListener("scrollend", stopScrolling)
      }
      mutationObserver.disconnect()
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect()
      }
      if (rafIdRef.current != null) {
        cancelFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current)
        scrollTimeoutRef.current = null
      }
      observedElementRef.current = null
      resizeObserverRef.current = null
    }
  }, [enabled, scheduleUpdate, handleScroll, stopScrolling, cancelFrame])

  useEffect(() => {
    if (!enabled) return
    scheduleUpdate()
  }, [enabled, targetId, scheduleUpdate])

  return state
}
