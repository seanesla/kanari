"use client"

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"

const DashboardAnimationContext = createContext<{ shouldAnimate: boolean }>({ shouldAnimate: false })

export function useDashboardAnimation() {
  return useContext(DashboardAnimationContext)
}

export function DashboardAnimationProvider({
  children,
  isReady,
}: {
  children: ReactNode
  isReady: boolean
}) {
  const hasAnimatedRef = useRef(false)
  const shouldAnimateThisRender = isReady && !hasAnimatedRef.current

  // Mark immediately so children see shouldAnimate=true only on the first render.
  if (shouldAnimateThisRender) {
    hasAnimatedRef.current = true
  }

  const [shouldAnimate, setShouldAnimate] = useState(true)

  // Turn off the animation window after 150ms.
  useEffect(() => {
    if (!isReady) return

    setShouldAnimate(true)
    const timer = setTimeout(() => setShouldAnimate(false), 150)
    return () => clearTimeout(timer)
  }, [isReady])

  return (
    <DashboardAnimationContext.Provider value={{ shouldAnimate: shouldAnimateThisRender || shouldAnimate }}>
      {children}
    </DashboardAnimationContext.Provider>
  )
}
