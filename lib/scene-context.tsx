"use client"

import { createContext, useContext, useState, useCallback, useRef, useMemo, useEffect, type ReactNode, type MutableRefObject } from "react"
import { db } from "@/lib/storage/db"
import { DEFAULT_ACCENT } from "@/lib/color-utils"

export type SceneMode = "landing" | "transitioning" | "dashboard"

interface SceneContextValue {
  mode: SceneMode
  setMode: (mode: SceneMode) => void
  scrollProgressRef: MutableRefObject<number>
  resetToLanding: () => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  accentColor: string
  setAccentColor: (color: string) => void
}

const SceneContext = createContext<SceneContextValue | null>(null)

export function SceneProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<SceneMode>("landing")
  const scrollProgressRef = useRef(0)
  const [isLoading, setIsLoading] = useState(true)
  const [accentColor, setAccentColorState] = useState(DEFAULT_ACCENT)

  // Load saved accent color from IndexedDB on mount
  useEffect(() => {
    db.settings.get("default").then((settings) => {
      if (settings?.accentColor) {
        setAccentColorState(settings.accentColor)
      }
    }).catch(() => {
      // IndexedDB not available or error, use default
    })
  }, [])

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

  const setAccentColor = useCallback((color: string) => {
    setAccentColorState(color)
    // Persist to IndexedDB
    db.settings.update("default", { accentColor: color }).catch(() => {
      // If no default settings exist, create them
      db.settings.put({
        id: "default",
        defaultRecordingDuration: 30,
        enableVAD: true,
        enableNotifications: true,
        calendarConnected: false,
        autoScheduleRecovery: false,
        preferredRecoveryTimes: [],
        localStorageOnly: true,
        accentColor: color,
      }).catch(() => {
        // IndexedDB not available
      })
    })
  }, [])

  const contextValue = useMemo(() => ({
    mode,
    setMode,
    scrollProgressRef,
    resetToLanding,
    isLoading,
    setIsLoading,
    accentColor,
    setAccentColor,
  }), [mode, isLoading, accentColor, setMode, resetToLanding, setAccentColor])

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
