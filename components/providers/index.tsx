"use client"

import "temporal-polyfill/global"

import { useEffect } from "react"
import type { ReactNode } from "react"
import { MotionConfig } from "framer-motion"
import { SceneProvider } from "@/lib/scene-context"
import { NavbarProvider } from "@/lib/navbar-context"
import { TimeZoneProvider } from "@/lib/timezone-context"
import { CheckInSessionsProvider } from "@/lib/check-in-sessions-context"
import { applySafariViewTransitionFix } from "@/lib/utils"
import SceneBackground from "@/components/scene"
import { PersistentNavbar } from "@/components/persistent-navbar"
import { RequireUserName } from "@/components/require-user-name"
import { ColorSync } from "@/components/color-sync"
import { JankLogger } from "@/components/perf/jank-logger"
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
      <MotionConfig reducedMotion="user">
        <JankLogger />
        <DataPreloader>
          <CheckInSessionsProvider>
            <SceneProvider>
              <TimeZoneProvider>
                <ColorSync />
                <DemoProvider>
                  <NavbarProvider>
                    <SceneBackground />
                    <PersistentNavbar />
                    <RouteTransitionOverlay />
                    <RequireUserName />
                    {children}
                    <DemoOverlay />
                  </NavbarProvider>
                </DemoProvider>
              </TimeZoneProvider>
            </SceneProvider>
          </CheckInSessionsProvider>
        </DataPreloader>
      </MotionConfig>
    </IconProvider>
  )
}
