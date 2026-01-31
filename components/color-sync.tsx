"use client"

import { useEffect } from "react"
import { useSceneMode } from "@/lib/scene-context"
import { DEFAULT_ACCENT, updateCSSVariables } from "@/lib/color-utils"
import { updateFavicon } from "@/lib/favicon-utils"

/**
 * Syncs accent color from SceneProvider context to:
 * 1. CSS custom properties (--accent, --accent-light, --muted-foreground, etc.)
 * 2. Favicon (dynamically generated SVG with user's color)
 * Must be mounted once inside SceneProvider (in providers.tsx).
 */
export function ColorSync() {
  const { accentColor } = useSceneMode()

  useEffect(() => {
    const normalize = (input: string | null | undefined): string | null => {
      if (typeof input !== "string") return null
      const value = input.trim()
      if (!value.startsWith("#")) return null
      const hex = value.slice(1)
      if (hex.length === 3) {
        const [r, g, b] = hex.split("")
        if (!r || !g || !b) return null
        return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
      }
      if (hex.length === 6) return `#${hex}`.toLowerCase()
      return null
    }

    const getCookie = (name: string): string | null => {
      try {
        const raw = typeof document !== "undefined" ? document.cookie : ""
        const parts = raw.split(";")
        for (const part of parts) {
          const trimmed = part.trim()
          if (!trimmed) continue
          const idx = trimmed.indexOf("=")
          if (idx === -1) continue
          const key = trimmed.slice(0, idx)
          if (key !== name) continue
          const value = trimmed.slice(idx + 1)
          return decodeURIComponent(value)
        }
        return null
      } catch {
        return null
      }
    }

    const getPersistedAccent = (): string | null => {
      try {
        const stored = localStorage.getItem("kanari:accentColor")
        const normalized = normalize(stored)
        if (normalized) return normalized
      } catch {
        // ignore
      }

      const cookie = getCookie("kanari-accent")
      return normalize(cookie)
    }

    // Avoid a startup flicker:
    // - Startup script can pre-apply the user's accent via CSS variables.
    // - SceneProvider's initial accentColor defaults to DEFAULT_ACCENT until IndexedDB loads.
    // - If we blindly sync DEFAULT_ACCENT on mount, we overwrite the startup color.
    const normalizedAccent = normalize(accentColor) ?? DEFAULT_ACCENT
    const persisted = getPersistedAccent()
    const shouldPreferPersistedOnMount =
      normalizedAccent === normalize(DEFAULT_ACCENT) &&
      !!persisted &&
      persisted !== normalize(DEFAULT_ACCENT)

    const resolved = shouldPreferPersistedOnMount ? persisted : normalizedAccent

    updateCSSVariables(resolved)
    updateFavicon(resolved)
  }, [accentColor])

  return null
}
