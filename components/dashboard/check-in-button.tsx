"use client"

/**
 * Check-in Button Component
 *
 * This is the main entry point for the unified check-in feature.
 * It navigates to the sessions page and auto-opens the CheckInDrawer.
 *
 * Features:
 * - Uses the user's custom accent color from SceneContext
 * - Navigates to /dashboard/history with ?newCheckIn=true query param
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

export function CheckInButton() {
  const router = useRouter()

  // Get the user's custom accent color from the global scene context
  // This color is persisted in IndexedDB and can be changed in settings
  const { accentColor } = useSceneMode()

  return (
    <Button
      size="default"
      className="gap-2"
      style={{
        backgroundColor: accentColor,
        color: "white",
      }}
      onClick={() => router.push("/dashboard/history?newCheckIn=true")}
    >
      <Mic className="h-4 w-4" />
      <span className="hidden sm:inline">Check in</span>
    </Button>
  )
}
