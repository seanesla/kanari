"use client"

import dynamic from "next/dynamic"
import { useMemo } from "react"
import { useIsMobile } from "@/hooks/use-mobile"

const AppSpaceBackground3D = dynamic(
  () => import("./app-space-background-3d").then((mod) => mod.AppSpaceBackground3D),
  { ssr: false }
)

export function AppSpaceBackground() {
  const isMobile = useIsMobile()

  const vignetteStyle = useMemo(
    () => ({
      background:
        "radial-gradient(1200px 800px at 50% 20%, transparent 0%, rgba(0,0,0,0.18) 55%, rgba(0,0,0,0.46) 100%)",
    }),
    []
  )

  const mobileBackdropStyle = useMemo(
    () => ({
      background:
        "radial-gradient(900px 620px at 55% 18%, rgba(255,255,255,0.05) 0%, rgba(10,9,8,0.0) 45%, rgba(10,9,8,0.55) 100%)",
    }),
    []
  )

  if (isMobile) {
    return (
      <div className="pointer-events-none fixed inset-0 -z-10 bg-background">
        <div aria-hidden="true" className="absolute inset-0" style={mobileBackdropStyle} />
        <div aria-hidden="true" className="absolute inset-0" style={vignetteStyle} />
      </div>
    )
  }

  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0">
        <AppSpaceBackground3D />
      </div>

      {/* Soft vignette for readability (CSS, not glass). */}
      <div aria-hidden="true" className="absolute inset-0" style={vignetteStyle} />
    </div>
  )
}

