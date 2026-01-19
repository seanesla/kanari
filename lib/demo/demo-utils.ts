/**
 * Demo Mode Utilities
 *
 * Helper functions for the demo tour system.
 */

/**
 * Find an element by its data-demo-id attribute
 */
export function findDemoElement(demoId: string): HTMLElement | null {
  return document.querySelector(`[data-demo-id="${demoId}"]`)
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
): void {
  if (behavior === "none") return

  const options: ScrollIntoViewOptions = {
    behavior: "smooth",
    block: behavior === "center" ? "center" : "start",
    inline: "nearest",
  }

  element.scrollIntoView(options)
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
    dashboard: "Dashboard",
    checkin: "Check-ins",
    analytics: "Analytics",
    achievements: "Achievements",
    complete: "Complete",
  }
  return labels[phase] || phase
}
