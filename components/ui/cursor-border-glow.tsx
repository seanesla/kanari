"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface CursorBorderGlowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Approximate glow size (px). */
  size?: number
  /** Strength hint (kept for backwards compatibility). */
  borderWidth?: number
}

export function CursorBorderGlow({
  className,
  size = 220,
  borderWidth = 1,
  style,
  ...props
}: CursorBorderGlowProps) {
  // Thickness of the glow "ring" (in px). Larger values = more diffusion.
  // Keep it comfortably thick so it reads as a border bloom, not a dot.
  const glowRing = Math.max(16, borderWidth * 10)
  const traceRing = Math.max(2, borderWidth)
  const blurPx = Math.max(22, Math.round(glowRing * 1.25))

  const gradient = `radial-gradient(var(--glow-rx, ${size}px) var(--glow-ry, ${size}px) at var(--glow-x, 50%) var(--glow-y, 50%), color-mix(in srgb, var(--accent) 60%, transparent) 0%, color-mix(in srgb, var(--accent) 30%, transparent) 45%, transparent 100%)`
  const ringMask = "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)"

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit]",
        className
      )}
      style={style}
      {...props}
    >
      <div
        className="absolute inset-0 rounded-[inherit]"
        style={{
          filter: `blur(${blurPx}px)`,
          opacity: 0.75,
          mixBlendMode: "screen",
        }}
      >
        <div
          className="absolute rounded-[inherit]"
          style={{
            inset: 0,
            padding: glowRing,
            background: gradient,
            WebkitMask: ringMask,
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />
      </div>
      <div
        className="absolute inset-0 rounded-[inherit]"
        style={{
          opacity: 0.45,
          mixBlendMode: "screen",
        }}
      >
        <div
          className="absolute inset-0 rounded-[inherit]"
          style={{
            padding: traceRing,
            background: gradient,
            WebkitMask: ringMask,
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />
      </div>
    </div>
  )
}
