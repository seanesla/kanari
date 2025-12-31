"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface CursorBorderGlowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Glow radius in px (diameter-like feel). */
  size?: number
  /** Thickness of the glowing border ring (px). */
  borderWidth?: number
}

export function CursorBorderGlow({
  className,
  size = 220,
  borderWidth = 1,
  style,
  ...props
}: CursorBorderGlowProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 rounded-[inherit]", className)}
      style={
        {
          padding: `${borderWidth}px`,
          background: `radial-gradient(${size}px circle at var(--glow-x, 50%) var(--glow-y, 50%), color-mix(in srgb, var(--accent) 65%, transparent), transparent 70%)`,
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

