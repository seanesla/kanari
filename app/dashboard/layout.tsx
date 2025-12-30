"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { useSceneMode } from "@/lib/scene-context"

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
      <div className="relative" data-dashboard>
        {children}
      </div>
    </DashboardAnimationContext.Provider>
  )
}
