"use client"

import { createContext, useContext, useState, useCallback, useRef, useMemo, useEffect, type ReactNode, type MutableRefObject } from "react"
import { db, type DBSettings } from "@/lib/storage/db"
import { DEFAULT_ACCENT } from "@/lib/color-utils"
import { DEFAULT_SANS, DEFAULT_SERIF, updateFontVariable, getFontCssFamily } from "@/lib/font-utils"
import type { FontFamily, SerifFamily } from "@/lib/types"

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
  resetFontsToDefault: () => void
}

const SceneContext = createContext<SceneContextValue | null>(null)

// Helper to create default settings object - avoids DRY violation across callbacks
function createDefaultSettings(): DBSettings {
  return {
    id: "default",
    defaultRecordingDuration: 30,
    enableVAD: true,
    enableNotifications: true,
    calendarConnected: false,
    autoScheduleRecovery: false,
    preferredRecoveryTimes: [],
    localStorageOnly: true,
  }
}

export function SceneProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<SceneMode>("landing")
  const scrollProgressRef = useRef(0)
  const [isLoading, setIsLoading] = useState(true)
  const [accentColor, setAccentColorState] = useState(DEFAULT_ACCENT)
  const [selectedSansFont, setSelectedSansFontState] = useState(DEFAULT_SANS)
  const [selectedSerifFont, setSelectedSerifFontState] = useState(DEFAULT_SERIF)

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
    }).catch((error) => {
      // IndexedDB not available or error, use defaults
      if (process.env.NODE_ENV === "development") {
        console.warn("[SceneProvider] Failed to load settings from IndexedDB:", error)
      }
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
        return db.settings.put({ ...createDefaultSettings(), accentColor: color })
      }
    }).catch((error) => {
      if (process.env.NODE_ENV === "development") {
        console.warn("[SceneProvider] Failed to save accent color:", error)
      }
    })
  }, [])

  const setSansFont = useCallback((font: string) => {
    setSelectedSansFontState(font)
    updateFontVariable("--font-sans", getFontCssFamily(font, "sans"))
    // Persist to IndexedDB
    db.settings.update("default", { selectedSansFont: font as FontFamily }).then((updated) => {
      if (updated === 0) {
        // No record exists, create it
        return db.settings.put({ ...createDefaultSettings(), selectedSansFont: font as FontFamily })
      }
    }).catch((error) => {
      if (process.env.NODE_ENV === "development") {
        console.warn("[SceneProvider] Failed to save sans font:", error)
      }
    })
  }, [])

  const setSerifFont = useCallback((font: string) => {
    setSelectedSerifFontState(font)
    updateFontVariable("--font-serif", getFontCssFamily(font, "serif"))
    // Persist to IndexedDB
    db.settings.update("default", { selectedSerifFont: font as SerifFamily }).then((updated) => {
      if (updated === 0) {
        // No record exists, create it
        return db.settings.put({ ...createDefaultSettings(), selectedSerifFont: font as SerifFamily })
      }
    }).catch((error) => {
      if (process.env.NODE_ENV === "development") {
        console.warn("[SceneProvider] Failed to save serif font:", error)
      }
    })
  }, [])

  const resetFontsToDefault = useCallback(() => {
    setSansFont(DEFAULT_SANS)
    setSerifFont(DEFAULT_SERIF)
  }, [setSansFont, setSerifFont])

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
    resetFontsToDefault,
  }), [mode, isLoading, accentColor, selectedSansFont, selectedSerifFont, setMode, resetToLanding, setAccentColor, setSansFont, setSerifFont, resetFontsToDefault])

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
