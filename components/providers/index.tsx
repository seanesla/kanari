"use client"

import "temporal-polyfill/global"

import { useEffect } from "react"
import type { ReactNode } from "react"
import { SceneProvider } from "@/lib/scene-context"
import { NavbarProvider } from "@/lib/navbar-context"
import { TimeZoneProvider } from "@/lib/timezone-context"
import { applySafariViewTransitionFix } from "@/lib/utils"
import SceneBackground from "@/components/scene"
import { PersistentNavbar } from "@/components/persistent-navbar"
import { ColorSync } from "@/components/color-sync"
import { IconProvider } from "./icon-provider"
import { DataPreloader } from "./data-preloader"
import { DemoProvider, DemoOverlay } from "@/components/demo"
import { RouteTransitionOverlay } from "@/components/route-transition-overlay"

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    applySafariViewTransitionFix()
  }, [])

  return (
    <IconProvider>
      <DataPreloader>
        <SceneProvider>
          <TimeZoneProvider>
            <ColorSync />
            <DemoProvider>
              <NavbarProvider>
                <SceneBackground />
                <PersistentNavbar />
                <RouteTransitionOverlay />
                {children}
                <DemoOverlay />
              </NavbarProvider>
            </DemoProvider>
          </TimeZoneProvider>
        </SceneProvider>
      </DataPreloader>
    </IconProvider>
  )
}
