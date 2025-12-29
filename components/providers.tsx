"use client"

import type { ReactNode } from "react"
import { ViewTransitions } from "next-view-transitions"
import { SceneProvider } from "@/lib/scene-context"
import { NavbarProvider } from "@/lib/navbar-context"
import SceneBackground from "@/components/scene"
import { PersistentNavbar } from "@/components/persistent-navbar"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ViewTransitions>
      <SceneProvider>
        <NavbarProvider>
          <SceneBackground />
          <PersistentNavbar />
          {children}
        </NavbarProvider>
      </SceneProvider>
    </ViewTransitions>
  )
}
