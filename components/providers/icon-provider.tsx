"use client"

import type { ReactNode } from "react"
import { IconoirProvider } from "iconoir-react"

export function IconProvider({ children }: { children: ReactNode }) {
  return (
    <IconoirProvider
      iconProps={{
        strokeWidth: 1.5,
        width: "1em",
        height: "1em",
      }}
    >
      {children}
    </IconoirProvider>
  )
}
