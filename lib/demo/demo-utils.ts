/**
 * Demo Mode Utilities
 *
 * Helper functions for the demo tour system.
 */

type DemoSafeAreas = {
  top: number
  bottom: number
}

export function isElementVisible(element: HTMLElement): boolean {
  if (typeof window === "undefined") return false

  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false

  let current: HTMLElement | null = element
  while (current) {
    const style = window.getComputedStyle(current)
    if (style.display === "none") return false
    if (style.visibility === "hidden") return false
    if (parseFloat(style.opacity || "1") <= 0) return false
    if (style.pointerEvents === "none") return false
    current = current.parentElement
  }

  return true
}

/**
 * Get "blocked" safe areas (px) for demo overlays.
 *
 * - `top`: max `rect.bottom` among elements marked with `data-demo-safe-top`
 * - `bottom`: max `(viewportHeight - rect.top)` among elements marked with `data-demo-safe-bottom`
 *
 * SSR-safe: returns zeros when `window` is undefined.
 */
export function getDemoSafeAreas(): DemoSafeAreas {
  if (typeof window === "undefined") return { top: 0, bottom: 0 }

  const viewportHeight = window.innerHeight

  const topElements = Array.from(document.querySelectorAll<HTMLElement>("[data-demo-safe-top]"))
  const bottomElements = Array.from(document.querySelectorAll<HTMLElement>("[data-demo-safe-bottom]"))

  const top = topElements.reduce((max, el) => {
    if (!isElementVisible(el)) return max
    const rect = el.getBoundingClientRect()
    if (rect.height <= 0 || rect.width <= 0) return max
    return Math.max(max, rect.bottom)
  }, 0)

  const bottom = bottomElements.reduce((max, el) => {
    if (!isElementVisible(el)) return max
    const rect = el.getBoundingClientRect()
    if (rect.height <= 0 || rect.width <= 0) return max
    return Math.max(max, viewportHeight - rect.top)
  }, 0)

  return { top, bottom }
}


/**
 * Find an element by its data-demo-id attribute
 */
export function findDemoElement(demoId: string): HTMLElement | null {
  if (typeof window === "undefined") return null

  const candidates = Array.from(document.querySelectorAll<HTMLElement>(`[data-demo-id="${demoId}"]`))
  if (candidates.length === 0) return null

  // Prefer visible candidates to avoid spotlighting hidden responsive duplicates.
  // See: docs/error-patterns/demo-highlight-selects-hidden-element.md
  const visibleCandidates = candidates.filter(isElementVisible)
  if (visibleCandidates.length === 0) return null
  if (visibleCandidates.length === 1) return visibleCandidates[0]

  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  const getIntersectionArea = (rect: DOMRect): number => {
    const left = Math.max(rect.left, 0)
    const top = Math.max(rect.top, 0)
    const right = Math.min(rect.right, viewportWidth)
    const bottom = Math.min(rect.bottom, viewportHeight)
    if (right <= left || bottom <= top) return 0
    return (right - left) * (bottom - top)
  }

  const scoredCandidates = visibleCandidates.map((candidate) => {
    const rect = candidate.getBoundingClientRect()
    return {
      candidate,
      rect,
      intersection: getIntersectionArea(rect),
      area: rect.width * rect.height,
    }
  })

  const inViewCandidates = scoredCandidates.filter((candidate) => candidate.intersection > 0)
  const pool = inViewCandidates.length > 0 ? inViewCandidates : scoredCandidates

  return pool.reduce((best, current) => {
    const currentScore = inViewCandidates.length > 0 ? current.intersection : current.area
    const bestScore = inViewCandidates.length > 0 ? best.intersection : best.area
    return currentScore > bestScore ? current : best
  }).candidate
}

/**
 * Wait for an element to appear in the DOM
 */
export function waitForElement(
  demoId: string,
  timeout = 5000
): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const element = findDemoElement(demoId)
    if (element) {
      resolve(element)
      return
    }

    const observer = new MutationObserver((_, obs) => {
      const el = findDemoElement(demoId)
      if (el) {
        obs.disconnect()
        resolve(el)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "data-demo-id"],
    })

    // Timeout fallback
    setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeout)
  })
}

/**
 * Scroll an element into view with configurable behavior
 */
export function scrollToElement(
  element: HTMLElement,
  behavior: "none" | "center" | "top" = "center"
): boolean {
  if (behavior === "none") return false

  const { top: safeTopRaw, bottom: safeBottomRaw } = getDemoSafeAreas()
  const safeMargin = 12
  const safeTop = safeTopRaw + safeMargin
  const safeBottom = safeBottomRaw + safeMargin
  const viewportHeight = window.innerHeight
  const rect = element.getBoundingClientRect()

  const maxVisibleTop = safeTop
  const maxVisibleBottom = viewportHeight - safeBottom
  const isFullyVisible = rect.top >= maxVisibleTop && rect.bottom <= maxVisibleBottom
  if (isFullyVisible) return false

  const safeHeight = Math.max(0, viewportHeight - safeTop - safeBottom)
  if (safeHeight <= 0) {
    element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" })
    return true
  }

  let targetTop = window.scrollY

  if (behavior === "center") {
    const offset = Math.max(0, (safeHeight - rect.height) / 2)
    targetTop = window.scrollY + rect.top - (safeTop + offset)
  } else {
    targetTop = window.scrollY + rect.top - safeTop
  }

  const delta = Math.abs(targetTop - window.scrollY)
  if (delta < 8) return false

  window.scrollTo({
    top: Math.max(0, targetTop),
    behavior: "smooth",
  })

  return true
}

export function waitForScrollEnd(timeoutMs = 1000): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()

  type ScrollWindow = {
    scrollY: number
    addEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: AddEventListenerOptions | boolean
    ) => void
    removeEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: EventListenerOptions | boolean
    ) => void
    setTimeout: typeof setTimeout
    clearTimeout: typeof clearTimeout
  }

  const win = window as unknown as ScrollWindow

  return new Promise((resolve) => {
    if ("onscrollend" in win) {
      const handleScrollEnd = () => {
        win.removeEventListener("scrollend", handleScrollEnd)
        resolve()
      }
      win.addEventListener("scrollend", handleScrollEnd, { once: true })
      win.setTimeout(() => {
        win.removeEventListener("scrollend", handleScrollEnd)
        resolve()
      }, timeoutMs)
      return
    }

    let lastScrollY = win.scrollY
    let stopCheckId: ReturnType<typeof setTimeout> | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const checkIfStopped = () => {
      const currentScrollY = win.scrollY
      if (currentScrollY === lastScrollY) {
        if (stopCheckId != null) win.clearTimeout(stopCheckId)
        if (timeoutId != null) win.clearTimeout(timeoutId)
        resolve()
        return
      }
      lastScrollY = currentScrollY
      stopCheckId = win.setTimeout(checkIfStopped, 120)
    }

    stopCheckId = win.setTimeout(checkIfStopped, 120)
    timeoutId = win.setTimeout(() => {
      if (stopCheckId != null) win.clearTimeout(stopCheckId)
      resolve()
    }, timeoutMs)
  })
}

/**
 * Get the bounding rect of an element with page offset
 */
export function getElementRect(element: HTMLElement): DOMRect {
  return element.getBoundingClientRect()
}

/**
 * Calculate tooltip position relative to target element
 */
export function calculateTooltipPosition(
  targetRect: DOMRect,
  position: "top" | "bottom" | "left" | "right",
  tooltipWidth = 320,
  tooltipHeight = 150,
  offset = 16
): { x: number; y: number } {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  let x: number
  let y: number

  switch (position) {
    case "top":
      x = targetRect.left + targetRect.width / 2 - tooltipWidth / 2
      y = targetRect.top - tooltipHeight - offset
      break
    case "bottom":
      x = targetRect.left + targetRect.width / 2 - tooltipWidth / 2
      y = targetRect.bottom + offset
      break
    case "left":
      x = targetRect.left - tooltipWidth - offset
      y = targetRect.top + targetRect.height / 2 - tooltipHeight / 2
      break
    case "right":
      x = targetRect.right + offset
      y = targetRect.top + targetRect.height / 2 - tooltipHeight / 2
      break
  }

  // Keep within viewport bounds
  x = Math.max(16, Math.min(x, viewportWidth - tooltipWidth - 16))
  y = Math.max(16, Math.min(y, viewportHeight - tooltipHeight - 16))

  return { x, y }
}

/**
 * Calculate optimal position for tooltip (auto-select best position)
 */
export function calculateOptimalPosition(
  targetRect: DOMRect,
  tooltipWidth = 320,
  tooltipHeight = 150,
  offset = 16
): "top" | "bottom" | "left" | "right" {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  // Check available space in each direction
  const spaceAbove = targetRect.top
  const spaceBelow = viewportHeight - targetRect.bottom
  const spaceLeft = targetRect.left
  const spaceRight = viewportWidth - targetRect.right

  const requiredVertical = tooltipHeight + offset
  const requiredHorizontal = tooltipWidth + offset

  // Prefer bottom, then top, then right, then left
  if (spaceBelow >= requiredVertical) return "bottom"
  if (spaceAbove >= requiredVertical) return "top"
  if (spaceRight >= requiredHorizontal) return "right"
  if (spaceLeft >= requiredHorizontal) return "left"

  // Default to bottom if nothing fits well
  return "bottom"
}

/**
 * Add highlight styling to an element
 */
export function addHighlight(element: HTMLElement, accentColor: string): void {
  element.style.outline = `2px solid ${accentColor}`
  element.style.outlineOffset = "4px"
  element.style.borderRadius = "8px"
  element.style.transition = "outline 0.3s ease, outline-offset 0.3s ease"
}

/**
 * Remove highlight styling from an element
 */
export function removeHighlight(element: HTMLElement): void {
  element.style.outline = ""
  element.style.outlineOffset = ""
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

/**
 * Format time remaining in seconds to MM:SS
 */
export function formatTimeRemaining(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

/**
 * Get phase label for display
 */
export function getPhaseLabel(
  phase: string
): string {
  const labels: Record<string, string> = {
    landing: "Landing Page",
    onboarding: "Onboarding",
    dashboard: "Overview",
    checkin: "Check-ins",
    analytics: "Analytics",
    achievements: "Achievements",
    complete: "Complete",
  }
  return labels[phase] || phase
}
