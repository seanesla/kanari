"use client"

/**
 * Check-in Button Component
 *
 * This is the main entry point for the unified check-in feature.
 * It replaces the separate "Record" and "Talk" buttons in the dashboard header.
 *
 * Features:
 * - Uses the user's custom accent color from SceneContext
 * - Opens the CheckInDrawer which contains both Voice Note and AI Chat modes
 * - Responsive: shows just icon on mobile, icon + text on desktop
 *
 * @example
 * // In metrics-header-bar.tsx:
 * <CheckInButton />
 */

import { useState } from "react"
import { Mic } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSceneMode } from "@/lib/scene-context"
import { CheckInDrawer } from "./check-in-drawer"

export function CheckInButton() {
  // Track whether the drawer is open or closed
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Get the user's custom accent color from the global scene context
  // This color is persisted in IndexedDB and can be changed in settings
  const { accentColor } = useSceneMode()

  return (
    <>
      {/*
        Main check-in button
        - size="default" makes it slightly larger than the old "sm" buttons
        - Uses inline style to apply the dynamic accent color
        - Hidden text on mobile (sm:inline) to save space
      */}
      <Button
        size="default"
        className="gap-2"
        style={{
          backgroundColor: accentColor,
          color: "white",
        }}
        onClick={() => setDrawerOpen(true)}
      >
        <Mic className="h-4 w-4" />
        <span className="hidden sm:inline">Check in</span>
      </Button>

      {/*
        The unified drawer containing both Voice Note and AI Chat modes
        Controlled component - we manage the open state here
      */}
      <CheckInDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  )
}
