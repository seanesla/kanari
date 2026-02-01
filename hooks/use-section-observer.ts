"use client"

import { useEffect } from "react"
import { useNavbar, type ActiveSection } from "@/lib/navbar-context"

// Section IDs that map to navbar links
const OBSERVED_SECTIONS = ["problem", "features", "walkthrough", "trust"] as const

export function useSectionObserver() {
  const { navbarMode, setActiveSection } = useNavbar()

  useEffect(() => {
    // Only observe on landing page
    if (navbarMode !== "landing") return

    // Use a lightweight scroll-based heuristic instead of IntersectionObserver.
    // This is more reliable with smooth scrolling and nested anchors.
    let rafId: number | null = null
    let lastActive: ActiveSection = null

    const computeActiveSection = (): ActiveSection => {
      if (window.scrollY < 200) return "hero"

      // Use a "reading line" and pick the last anchor whose top has crossed it.
      // This behaves like a typical docs sidebar: you stay in a section until the next
      // section actually scrolls past the reading line.
      const targetY = window.innerHeight * 0.34

      let active: ActiveSection = null
      let activeTop = Number.NEGATIVE_INFINITY

      for (const id of OBSERVED_SECTIONS) {
        const el = document.getElementById(id)
        if (!el) continue
        const rect = el.getBoundingClientRect()

        // Only consider anchors that have reached the reading line.
        if (rect.top <= targetY && rect.top > activeTop) {
          activeTop = rect.top
          active = id as ActiveSection
        }
      }

      return active ?? "hero"
    }

    const update = () => {
      rafId = null
      const next = computeActiveSection()
      if (next !== lastActive) {
        lastActive = next
        setActiveSection(next)
      }
    }

    const schedule = () => {
      if (rafId !== null) return
      rafId = window.requestAnimationFrame(update)
    }

    // Initial pass + keep in sync during scrolling and hash jumps.
    schedule()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    window.addEventListener("hashchange", schedule)

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId)
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
      window.removeEventListener("hashchange", schedule)
    }
  }, [navbarMode, setActiveSection])
}
