"use client"

import { createContext, useContext, useState, useCallback, useRef, useMemo, useEffect, type ReactNode, type MutableRefObject } from "react"
import { db } from "@/lib/storage/db"
import { DEFAULT_ACCENT } from "@/lib/color-utils"
import { DEFAULT_SANS, DEFAULT_SERIF, updateFontVariable, getFontCssFamily } from "@/lib/font-utils"
import type { FontFamily, GraphicsQuality, SerifFamily } from "@/lib/types"
import { normalizeGraphicsQuality } from "@/lib/graphics/quality"
import { patchSettings } from "@/lib/settings/patch-settings"

export type SceneMode = "landing" | "transitioning" | "dashboard"

// localStorage key for instant (synchronous) access to animation preference
const DISABLE_ANIMATION_KEY = "kanari:disableStartupAnimation"
const ACCENT_COLOR_KEY = "kanari:accentColor"
const GRAPHICS_QUALITY_KEY = "kanari:graphicsQuality"
const ACCENT_COLOR_COOKIE = "kanari-accent"

/**
 * Read the animation preference from localStorage synchronously.
 * This must be instant so we can initialize isLoading correctly before first render.
 */
function getDisableStartupAnimation(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem(DISABLE_ANIMATION_KEY) === "true"
  } catch {
    return false
  }
}

function getAccentColorSync(): string | null {
  if (typeof window === "undefined") return null
  try {
    const stored = localStorage.getItem(ACCENT_COLOR_KEY)
    if (!stored) return null
    // Expect a hex color (what we persist today).
    if (!/^#[0-9a-fA-F]{6}$/.test(stored)) return null
    return stored
  } catch {
    return null
  }
}

function setAccentColorSync(color: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(ACCENT_COLOR_KEY, color)
  } catch {
    // localStorage not available, ignore
  }
}

function getGraphicsQualitySync(): GraphicsQuality | null {
  if (typeof window === "undefined") return null
  try {
    const stored = localStorage.getItem(GRAPHICS_QUALITY_KEY)
    if (!stored) return null
    return normalizeGraphicsQuality(stored)
  } catch {
    return null
  }
}

function setGraphicsQualitySync(quality: GraphicsQuality): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(GRAPHICS_QUALITY_KEY, quality)
  } catch {
    // localStorage not available, ignore
  }
}

/**
 * Save the animation preference to localStorage for instant access on next load.
 */
export function setDisableStartupAnimationSync(disabled: boolean): void {
  if (typeof window === "undefined") return
  try {
    if (disabled) {
      localStorage.setItem(DISABLE_ANIMATION_KEY, "true")
    } else {
      localStorage.removeItem(DISABLE_ANIMATION_KEY)
    }
  } catch {
    // localStorage not available, ignore
  }
}

function persistAccentColorSync(color: string): void {
  if (typeof window === "undefined") return
  setAccentColorSync(color)

  try {
    // Keep it lax + long-lived; this is non-sensitive UI preference.
    const maxAge = 60 * 60 * 24 * 365 // 1 year
    document.cookie = `${ACCENT_COLOR_COOKIE}=${encodeURIComponent(color)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`
  } catch {
    // ignore
  }
}

interface SceneContextValue {
  mode: SceneMode
  setMode: (mode: SceneMode) => void
  scrollProgressRef: MutableRefObject<number>
  resetToLanding: () => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  accentColor: string
  /** Update accent color in-memory only (no IndexedDB write). */
  previewAccentColor: (color: string) => void
  /** Update accent color and persist to IndexedDB. */
  setAccentColor: (color: string) => void
  graphicsQuality: GraphicsQuality
  /** Update graphics quality in-memory only (no IndexedDB write). */
  previewGraphicsQuality: (quality: GraphicsQuality) => void
  /** Update graphics quality and persist to IndexedDB. */
  setGraphicsQuality: (quality: GraphicsQuality) => void
  selectedSansFont: string
  /** Update dashboard font in-memory only (no IndexedDB write). */
  previewSansFont: (font: string) => void
  /** Update dashboard font and persist to IndexedDB. */
  setSansFont: (font: string) => void
  selectedSerifFont: string
  /** Update dashboard font in-memory only (no IndexedDB write). */
  previewSerifFont: (font: string) => void
  /** Update dashboard font and persist to IndexedDB. */
  setSerifFont: (font: string) => void
  resetFontsToDefault: () => void
}

// Exported for useContextBridge in 3D scenes (Drei Html portals)
export const SceneContext = createContext<SceneContextValue | null>(null)

export function SceneProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<SceneMode>("landing")
  const scrollProgressRef = useRef(0)
  // Keep SSR + client hydration consistent.
  // Startup animation suppression is handled by an early inline script (app/layout.tsx)
  // that sets a data attribute for CSS to hide the overlay before hydration.
  const [isLoading, setIsLoading] = useState(true)
  const [accentColor, setAccentColorState] = useState(() => getAccentColorSync() ?? DEFAULT_ACCENT)
  const [graphicsQuality, setGraphicsQualityState] = useState<GraphicsQuality>(() => getGraphicsQualitySync() ?? "auto")
  const [selectedSansFont, setSelectedSansFontState] = useState(DEFAULT_SANS)
  const [selectedSerifFont, setSelectedSerifFontState] = useState(DEFAULT_SERIF)

  // Apply localStorage preference after mount.
  // This avoids hydration mismatches while still honoring the user's setting.
  useEffect(() => {
    if (getDisableStartupAnimation()) {
      setIsLoading(false)
    }
  }, [])

  // Load saved settings (accent color and fonts) from IndexedDB on mount
  // Note: disableStartupAnimation is read from localStorage synchronously (see useState above)
  useEffect(() => {
    db.settings.get("default").then((settings) => {
      if (settings?.accentColor) {
        setAccentColorState(settings.accentColor)
        persistAccentColorSync(settings.accentColor)
      }
      if (settings?.graphicsQuality) {
        const raw = (settings as { graphicsQuality?: unknown }).graphicsQuality
        const normalized = normalizeGraphicsQuality(raw)
        setGraphicsQualityState(normalized)

        setGraphicsQualitySync(normalized)

        // Migrate legacy stored value ("static" -> "medium") once.
        if (raw === "static") {
          void patchSettings({ graphicsQuality: normalized }).catch((error) => {
            if (process.env.NODE_ENV === "development") {
              console.warn("[SceneProvider] Failed to migrate graphics quality:", error)
            }
          })
        }
      }
      if (settings?.selectedSansFont) {
        setSelectedSansFontState(settings.selectedSansFont)
        updateFontVariable("--font-sans", getFontCssFamily(settings.selectedSansFont, "sans"))
      }
      if (settings?.selectedSerifFont) {
        setSelectedSerifFontState(settings.selectedSerifFont)
        updateFontVariable("--font-serif", getFontCssFamily(settings.selectedSerifFont, "serif"))
      }
      // Sync animation preference from IndexedDB to localStorage (for users who had it saved before)
      if (settings?.disableStartupAnimation !== undefined) {
        setDisableStartupAnimationSync(settings.disableStartupAnimation)
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

  const previewAccentColor = useCallback((color: string) => {
    setAccentColorState(color)
  }, [])

  const previewGraphicsQuality = useCallback((quality: GraphicsQuality) => {
    setGraphicsQualityState(quality)
  }, [])

  const setAccentColor = useCallback((color: string) => {
    setAccentColorState(color)
    persistAccentColorSync(color)
    // Persist to IndexedDB (race-safe; avoids wiping other fields)
    void patchSettings({ accentColor: color }).catch((error) => {
      if (process.env.NODE_ENV === "development") {
        console.warn("[SceneProvider] Failed to save accent color:", error)
      }
    })
  }, [])

  const setGraphicsQuality = useCallback((quality: GraphicsQuality) => {
    setGraphicsQualityState(quality)
    setGraphicsQualitySync(quality)
    void patchSettings({ graphicsQuality: quality }).catch((error) => {
      if (process.env.NODE_ENV === "development") {
        console.warn("[SceneProvider] Failed to save graphics quality:", error)
      }
    })
  }, [])

  const setSansFont = useCallback((font: string) => {
    setSelectedSansFontState(font)
    updateFontVariable("--font-sans", getFontCssFamily(font, "sans"))
    // Persist to IndexedDB (race-safe; avoids wiping other fields)
    void patchSettings({ selectedSansFont: font as FontFamily }).catch((error) => {
      if (process.env.NODE_ENV === "development") {
        console.warn("[SceneProvider] Failed to save sans font:", error)
      }
    })
  }, [])

  const previewSansFont = useCallback((font: string) => {
    setSelectedSansFontState(font)
    updateFontVariable("--font-sans", getFontCssFamily(font, "sans"))
  }, [])

  const setSerifFont = useCallback((font: string) => {
    setSelectedSerifFontState(font)
    updateFontVariable("--font-serif", getFontCssFamily(font, "serif"))
    // Persist to IndexedDB (race-safe; avoids wiping other fields)
    void patchSettings({ selectedSerifFont: font as SerifFamily }).catch((error) => {
      if (process.env.NODE_ENV === "development") {
        console.warn("[SceneProvider] Failed to save serif font:", error)
      }
    })
  }, [])

  const previewSerifFont = useCallback((font: string) => {
    setSelectedSerifFontState(font)
    updateFontVariable("--font-serif", getFontCssFamily(font, "serif"))
  }, [])

  const resetFontsToDefault = useCallback(() => {
    previewSansFont(DEFAULT_SANS)
    previewSerifFont(DEFAULT_SERIF)
  }, [previewSansFont, previewSerifFont])

  const contextValue = useMemo(() => ({
    mode,
    setMode,
    scrollProgressRef,
    resetToLanding,
    isLoading,
    setIsLoading,
    accentColor,
    previewAccentColor,
    setAccentColor,
    graphicsQuality,
    previewGraphicsQuality,
    setGraphicsQuality,
    selectedSansFont,
    previewSansFont,
    setSansFont,
    selectedSerifFont,
    previewSerifFont,
    setSerifFont,
    resetFontsToDefault,
  }), [mode, isLoading, accentColor, graphicsQuality, selectedSansFont, selectedSerifFont, setMode, resetToLanding, previewAccentColor, setAccentColor, previewGraphicsQuality, setGraphicsQuality, previewSansFont, setSansFont, previewSerifFont, setSerifFont, resetFontsToDefault])

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
