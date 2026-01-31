"use client"

/**
 * Check-in Button Component
 *
 * This is the main entry point for the unified check-in feature.
 * It navigates to the sessions page and auto-opens the CheckInDrawer.
 *
 * Features:
 * - Uses the user's custom accent color from SceneContext
 * - Navigates to /check-ins with ?newCheckIn=true query param
 * - Responsive: shows just icon on mobile, icon + text on desktop
 *
 * @example
 * // In metrics-header-bar.tsx:
 * <CheckInButton />
 */

import { useRouter } from "next/navigation"
import { Mic } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import { useSceneMode } from "@/lib/scene-context"

function normalizeHexColor(color: string): string | null {
  const value = color.trim()
  if (!value.startsWith("#")) return null
  const hex = value.slice(1)

  if (hex.length === 3) {
    const [r, g, b] = hex.split("")
    if (!r || !g || !b) return null
    return `#${r}${r}${g}${g}${b}${b}`
  }
  if (hex.length === 6) return `#${hex}`
  return null
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHexColor(hex)
  if (!normalized) return null
  const raw = normalized.slice(1)
  const r = Number.parseInt(raw.slice(0, 2), 16)
  const g = Number.parseInt(raw.slice(2, 4), 16)
  const b = Number.parseInt(raw.slice(4, 6), 16)
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null
  return { r, g, b }
}

export function CheckInButton() {
  const router = useRouter()

  // Get the user's custom accent color from the global scene context
  // This color is persisted in IndexedDB and can be changed in settings
  const { accentColor } = useSceneMode()

  const safeAccent = normalizeHexColor(accentColor) ?? "#22c55e"
  const rgb = hexToRgb(safeAccent)
  const tint = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.10)` : "rgba(255,255,255,0.04)"
  const border = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.36)` : "rgba(255,255,255,0.12)"
  const icon = rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : "hsl(var(--foreground))"

  return (
    <Button
      size="default"
      variant="outline"
      className={[
        "gap-2",
        "text-foreground",
        "border-white/10",
        "bg-[rgba(255,255,255,0.04)] backdrop-blur-xl",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_26px_rgba(0,0,0,0.25)]",
        "hover:bg-[rgba(255,255,255,0.06)]",
      ].join(" ")}
      style={{
        borderColor: border,
        backgroundColor: tint,
      }}
      onClick={() => router.push("/check-ins?newCheckIn=true")}
    >
      <Mic className="h-4 w-4" style={{ color: icon }} />
      <span className="hidden sm:inline">Check in</span>
    </Button>
  )
}
