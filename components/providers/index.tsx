"use client"

import "temporal-polyfill/global"

import type { ReactNode } from "react"
import { ViewTransitions } from "next-view-transitions"
import { SceneProvider } from "@/lib/scene-context"
import { NavbarProvider } from "@/lib/navbar-context"
import { TimeZoneProvider } from "@/lib/timezone-context"
import SceneBackground from "@/components/scene"
import { PersistentNavbar } from "@/components/persistent-navbar"
import { ColorSync } from "@/components/color-sync"
import { IconProvider } from "./icon-provider"
import { DataPreloader } from "./data-preloader"
import { DemoProvider, DemoOverlay } from "@/components/demo"

export function Providers({ children }: { children: ReactNode }) {
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
