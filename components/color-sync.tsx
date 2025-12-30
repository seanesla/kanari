"use client"

import { useEffect } from "react"
import { useSceneMode } from "@/lib/scene-context"
import { updateCSSVariables } from "@/lib/color-utils"
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
    updateCSSVariables(accentColor)
    updateFavicon(accentColor)
  }, [accentColor])

  return null
}
