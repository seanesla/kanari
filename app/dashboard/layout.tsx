"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { useSceneMode } from "@/lib/scene-context"
import { DecorativeGrid } from "@/components/ui/decorative-grid"

const DashboardAnimationContext = createContext({ shouldAnimate: false })
export const useDashboardAnimation = () => useContext(DashboardAnimationContext)

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { setMode } = useSceneMode()
  const hasEnteredRef = useRef(false)
  const [shouldAnimate, setShouldAnimate] = useState(() => !hasEnteredRef.current)

  useEffect(() => {
    setMode("dashboard")
    if (!hasEnteredRef.current) {
      hasEnteredRef.current = true
      // Allow animation to trigger, then disable for future navigations
      const timer = setTimeout(() => setShouldAnimate(false), 150)
      return () => clearTimeout(timer)
    }
  }, [setMode])

  return (
    <DashboardAnimationContext.Provider value={{ shouldAnimate }}>
      <div className="relative">
        {/* Background grid - scrolls with content */}
        <div className="absolute top-0 left-0 right-0 h-[420px] pointer-events-none z-0 overflow-hidden">
          {/* Offset for navbar + page padding */}
          <div className="relative w-full h-full px-8 md:px-16 lg:px-20 pt-14">
            <DecorativeGrid />
          </div>
        </div>
        {/* Page content */}
        {children}
      </div>
    </DashboardAnimationContext.Provider>
  )
}
