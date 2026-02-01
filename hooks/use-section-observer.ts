"use client"

import { useEffect } from "react"
import { useNavbar, type ActiveSection } from "@/lib/navbar-context"

// Section IDs that map to navbar links
const OBSERVED_SECTIONS = ["features", "trust", "feature-tour"] as const

export function useSectionObserver() {
  const { navbarMode, setActiveSection } = useNavbar()

  useEffect(() => {
    // Only observe on landing page
    if (navbarMode !== "landing") return

    const observerOptions: IntersectionObserverInit = {
      root: null, // viewport
      rootMargin: "-40% 0px -40% 0px", // Trigger when section is in middle 20% of viewport
      threshold: 0,
    }

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      // Find the most visible section
      const visibleEntry = entries.find((entry) => entry.isIntersecting)
      if (visibleEntry) {
        setActiveSection(visibleEntry.target.id as ActiveSection)
      }
    }

    const observer = new IntersectionObserver(handleIntersection, observerOptions)

    // Observe each section
    OBSERVED_SECTIONS.forEach((sectionId) => {
      const element = document.getElementById(sectionId)
      if (element) observer.observe(element)
    })

    // Initial check - set hero if at top
    const handleScroll = () => {
      if (window.scrollY < 200) {
        setActiveSection("hero")
      }
    }
    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener("scroll", handleScroll)
    }
  }, [navbarMode, setActiveSection])
}
