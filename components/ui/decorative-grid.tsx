"use client"

import { cn } from "@/lib/utils"
import { useSceneMode } from "@/lib/scene-context"

interface DecorativeGridProps {
  opacity?: "standard" | "light"
  className?: string
}

export function DecorativeGrid({
  opacity = "standard",
  className,
}: DecorativeGridProps) {
  const { accentColor: _accentColor } = useSceneMode()

  // Brightened for visibility; mask-fade-vertical still handles top/bottom fading
  const gridOpacity = opacity === "light" ? "#ffffff0a" : "#ffffff14"

  return (
    <div
      className={cn(
        "pointer-events-none absolute -top-14 -bottom-14 left-0 right-0",
        className
      )}
    >
      {/* Static grid layer */}
      <div
        className="absolute inset-0 mask-fade-vertical"
        style={{
          backgroundImage: `linear-gradient(to right, ${gridOpacity} 1px, transparent 1px), linear-gradient(to bottom, ${gridOpacity} 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
        }}
      />

      {/* Animated gradient sweep layer */}
      <div
        className="absolute inset-0 mask-fade-vertical animate-gradient-sweep"
        style={{
          backgroundImage: `linear-gradient(90deg, transparent 0%, oklch(from var(--accent) l calc(c * 1.2) h / 0.015) 20%, oklch(from var(--accent) l calc(c * 1.2) h / 0.03) 50%, oklch(from var(--accent) l calc(c * 1.2) h / 0.015) 80%, transparent 100%)`,
          backgroundSize: "200% 100%",
        }}
      />
    </div>
  )
}
