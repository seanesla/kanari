"use client"

import { createContext, useContext, useState, useCallback, useRef, useMemo, type ReactNode, type MutableRefObject } from "react"

export type SceneMode = "landing" | "transitioning" | "dashboard"

interface SceneContextValue {
  mode: SceneMode
  setMode: (mode: SceneMode) => void
  scrollProgressRef: MutableRefObject<number>
  resetToLanding: () => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
}

const SceneContext = createContext<SceneContextValue | null>(null)

export function SceneProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<SceneMode>("landing")
  const scrollProgressRef = useRef(0)
  const [isLoading, setIsLoading] = useState(true)

  const setMode = useCallback((newMode: SceneMode) => {
    setModeState(newMode)
  }, [])

  const resetToLanding = useCallback(() => {
    setModeState("landing")
    scrollProgressRef.current = 0
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior })
    }
  }, [])

  const contextValue = useMemo(() => ({
    mode,
    setMode,
    scrollProgressRef,
    resetToLanding,
    isLoading,
    setIsLoading,
  }), [mode, isLoading, setMode, resetToLanding])

  return (
    <SceneContext.Provider value={contextValue}>
      {children}
    </SceneContext.Provider>
  )
}

export function useSceneMode() {
  const context = useContext(SceneContext)
  if (!context) {
    throw new Error("useSceneMode must be used within a SceneProvider")
  }
  return context
}
