"use client"

import { useEffect } from "react"
import { useSceneMode } from "@/lib/scene-context"
import { updateCSSVariables } from "@/lib/color-utils"

/**
 * Syncs accent color from SceneProvider context to CSS custom properties.
 * Must be mounted once inside SceneProvider (in providers.tsx).
 */
export function ColorSync() {
  const { accentColor } = useSceneMode()

  useEffect(() => {
    updateCSSVariables(accentColor)
  }, [accentColor])

  return null
}
