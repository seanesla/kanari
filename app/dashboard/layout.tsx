"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { useSceneMode } from "@/lib/scene-context"

const DashboardAnimationContext = createContext({ shouldAnimate: false })
export const useDashboardAnimation = () => useContext(DashboardAnimationContext)

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { setMode } = useSceneMode()
  const hasEnteredRef = useRef(false)
  const [shouldAnimate] = useState(() => !hasEnteredRef.current)

  useEffect(() => {
    setMode("dashboard")
    hasEnteredRef.current = true
  }, [setMode])

  return (
    <DashboardAnimationContext.Provider value={{ shouldAnimate }}>
      {children}
    </DashboardAnimationContext.Provider>
  )
}
