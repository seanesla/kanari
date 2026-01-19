"use client"
"use client"

import "temporal-polyfill/global"

import { useEffect, type ReactNode } from "react"
import { ViewTransitions } from "next-view-transitions"
import { SceneProvider } from "@/lib/scene-context"
import { applySafariViewTransitionFix } from "@/lib/utils"
import { NavbarProvider } from "@/lib/navbar-context"
import { TimeZoneProvider } from "@/lib/timezone-context"
import SceneBackground from "@/components/scene"
import { PersistentNavbar } from "@/components/persistent-navbar"
import { ColorSync } from "@/components/color-sync"
import { IconProvider } from "./icon-provider"
import { DataPreloader } from "./data-preloader"
import { DemoProvider, DemoOverlay } from "@/components/demo"

export function Providers({ children }: { children: ReactNode }) {
  // Safari (and some early implementations) can be unstable with View Transitions
  // + portal-heavy UIs (R3F Html/CSS3D). If we detect Safari, disable transitions.
  // Pattern doc: docs/error-patterns/safari-view-transition-timeout.md
  useEffect(() => {
    if (typeof document === "undefined") return
    const cleanupViewTransition = applySafariViewTransitionFix()

    const root = document.documentElement
    if (cleanupViewTransition) {
      root.classList.add("disable-view-transitions")
    }

    return () => {
      root.classList.remove("disable-view-transitions")
      cleanupViewTransition?.()
    }
  }, [])

  // next-view-transitions doesn't expose a "disabled" prop. Instead, we add a class
  // that prevents transitions via CSS when we're on Safari.
  return (
    <ViewTransitions>
      <IconProvider>
        <DataPreloader>
          <SceneProvider>
            <TimeZoneProvider>
              <ColorSync />
              <DemoProvider>
                <NavbarProvider>
                  <SceneBackground />
                  <PersistentNavbar />
                  {children}
                  <DemoOverlay />
                </NavbarProvider>
              </DemoProvider>
            </TimeZoneProvider>
          </SceneProvider>
        </DataPreloader>
      </IconProvider>
    </ViewTransitions>
  )
}
