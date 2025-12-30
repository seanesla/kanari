"use client"

import { createContext, useContext, useState, useCallback, useRef, useMemo, useEffect, type ReactNode, type MutableRefObject } from "react"
import { db } from "@/lib/storage/db"
import { DEFAULT_ACCENT } from "@/lib/color-utils"
import { DEFAULT_SANS, DEFAULT_SERIF, DEFAULT_MONO, updateFontVariable, getFontCssFamily } from "@/lib/font-utils"

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
  selectedSansFont: string
  setSansFont: (font: string) => void
  selectedSerifFont: string
  setSerifFont: (font: string) => void
  selectedMonoFont: string
  setMonoFont: (font: string) => void
}

const SceneContext = createContext<SceneContextValue | null>(null)

export function SceneProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<SceneMode>("landing")
  const scrollProgressRef = useRef(0)
  const [isLoading, setIsLoading] = useState(true)
  const [accentColor, setAccentColorState] = useState(DEFAULT_ACCENT)
  const [selectedSansFont, setSelectedSansFontState] = useState(DEFAULT_SANS)
  const [selectedSerifFont, setSelectedSerifFontState] = useState(DEFAULT_SERIF)
  const [selectedMonoFont, setSelectedMonoFontState] = useState(DEFAULT_MONO)

  // Load saved settings (accent color and fonts) from IndexedDB on mount
  useEffect(() => {
    db.settings.get("default").then((settings) => {
      if (settings?.accentColor) {
        setAccentColorState(settings.accentColor)
      }
      if (settings?.selectedSansFont) {
        setSelectedSansFontState(settings.selectedSansFont)
        updateFontVariable("--font-sans", getFontCssFamily(settings.selectedSansFont, "sans"))
      }
      if (settings?.selectedSerifFont) {
        setSelectedSerifFontState(settings.selectedSerifFont)
        updateFontVariable("--font-serif", getFontCssFamily(settings.selectedSerifFont, "serif"))
      }
      if (settings?.selectedMonoFont) {
        setSelectedMonoFontState(settings.selectedMonoFont)
        updateFontVariable("--font-mono", getFontCssFamily(settings.selectedMonoFont, "mono"))
      }
    }).catch(() => {
      // IndexedDB not available or error, use defaults
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
    db.settings.update("default", { accentColor: color }).then((updated) => {
      if (updated === 0) {
        // No record exists, create it
        return db.settings.put({
          id: "default",
          defaultRecordingDuration: 30,
          enableVAD: true,
          enableNotifications: true,
          calendarConnected: false,
          autoScheduleRecovery: false,
          preferredRecoveryTimes: [],
          localStorageOnly: true,
          accentColor: color,
        })
      }
    }).catch(() => {
      // IndexedDB not available
    })
  }, [])

  const setSansFont = useCallback((font: string) => {
    setSelectedSansFontState(font)
    updateFontVariable("--font-sans", getFontCssFamily(font, "sans"))
    // Persist to IndexedDB
    db.settings.update("default", { selectedSansFont: font }).then((updated) => {
      if (updated === 0) {
        // No record exists, create it
        return db.settings.put({
          id: "default",
          defaultRecordingDuration: 30,
          enableVAD: true,
          enableNotifications: true,
          calendarConnected: false,
          autoScheduleRecovery: false,
          preferredRecoveryTimes: [],
          localStorageOnly: true,
          selectedSansFont: font,
        })
      }
    }).catch(() => {
      // IndexedDB not available
    })
  }, [])

  const setSerifFont = useCallback((font: string) => {
    setSelectedSerifFontState(font)
    updateFontVariable("--font-serif", getFontCssFamily(font, "serif"))
    // Persist to IndexedDB
    db.settings.update("default", { selectedSerifFont: font }).then((updated) => {
      if (updated === 0) {
        // No record exists, create it
        return db.settings.put({
          id: "default",
          defaultRecordingDuration: 30,
          enableVAD: true,
          enableNotifications: true,
          calendarConnected: false,
          autoScheduleRecovery: false,
          preferredRecoveryTimes: [],
          localStorageOnly: true,
          selectedSerifFont: font,
        })
      }
    }).catch(() => {
      // IndexedDB not available
    })
  }, [])

  const setMonoFont = useCallback((font: string) => {
    setSelectedMonoFontState(font)
    updateFontVariable("--font-mono", getFontCssFamily(font, "mono"))
    // Persist to IndexedDB
    db.settings.update("default", { selectedMonoFont: font }).then((updated) => {
      if (updated === 0) {
        // No record exists, create it
        return db.settings.put({
          id: "default",
          defaultRecordingDuration: 30,
          enableVAD: true,
          enableNotifications: true,
          calendarConnected: false,
          autoScheduleRecovery: false,
          preferredRecoveryTimes: [],
          localStorageOnly: true,
          selectedMonoFont: font,
        })
      }
    }).catch(() => {
      // IndexedDB not available
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
    selectedSansFont,
    setSansFont,
    selectedSerifFont,
    setSerifFont,
    selectedMonoFont,
    setMonoFont,
  }), [mode, isLoading, accentColor, selectedSansFont, selectedSerifFont, selectedMonoFont, setMode, resetToLanding, setAccentColor, setSansFont, setSerifFont, setMonoFont])

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
