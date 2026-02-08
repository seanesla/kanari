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
import { GuidanceProvider, GuidancePopup } from "@/components/guidance"
import { RouteTransitionOverlay } from "@/components/route-transition-overlay"
import { RouteTransitionProvider } from "@/lib/route-transition-context"

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
                  <GuidanceProvider>
                    <NavbarProvider>
                      <RouteTransitionProvider>
                        <SceneBackground />
                        <PersistentNavbar />
                        <RouteTransitionOverlay />
                        <RequireUserName />
                        {children}
                        <DemoOverlay />
                        <GuidancePopup />
                      </RouteTransitionProvider>
                    </NavbarProvider>
                  </GuidanceProvider>
                </DemoProvider>
              </TimeZoneProvider>
            </SceneProvider>
          </CheckInSessionsProvider>
        </DataPreloader>
      </MotionConfig>
    </IconProvider>
  )
}
