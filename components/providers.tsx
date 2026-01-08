"use client"

import 'temporal-polyfill/global'

import type { ReactNode } from "react"
import { ViewTransitions } from "next-view-transitions"
import { SceneProvider } from "@/lib/scene-context"
import { NavbarProvider } from "@/lib/navbar-context"
import { TimeZoneProvider } from "@/lib/timezone-context"
import SceneBackground from "@/components/scene"
import { PersistentNavbar } from "@/components/persistent-navbar"
import { ColorSync } from "@/components/color-sync"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ViewTransitions>
      <SceneProvider>
        <TimeZoneProvider>
          <ColorSync />
          <NavbarProvider>
            <SceneBackground />
            <PersistentNavbar />
            {children}
          </NavbarProvider>
        </TimeZoneProvider>
      </SceneProvider>
    </ViewTransitions>
  )
}
