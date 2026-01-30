"use client"

import dynamic from "next/dynamic"
import { useMemo } from "react"

const AppSpaceBackground3D = dynamic(
  () => import("./app-space-background-3d").then((mod) => mod.AppSpaceBackground3D),
  { ssr: false }
)

export function AppSpaceBackground() {
  const vignetteStyle = useMemo(
    () => ({
      background:
        "radial-gradient(1200px 800px at 50% 20%, transparent 0%, rgba(0,0,0,0.18) 55%, rgba(0,0,0,0.46) 100%)",
    }),
    []
  )

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 bg-background">
      <div className="absolute inset-0">
        <AppSpaceBackground3D />
      </div>

      {/* Soft vignette for readability (CSS, not glass). */}
      <div aria-hidden="true" className="absolute inset-0" style={vignetteStyle} />
    </div>
  )
}
