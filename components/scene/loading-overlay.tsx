"use client"

import { useState, useEffect } from "react"
import { useSceneMode } from "@/lib/scene-context"

interface LoadingOverlayProps {
  visible: boolean
  onAnimationComplete?: () => void
}

export function LoadingOverlay({ visible, onAnimationComplete }: LoadingOverlayProps) {
  const { accentColor } = useSceneMode()

  // Dynamically import to avoid SSR issues with framer-motion
  const [AnimatedLogo, setAnimatedLogo] = useState<React.ComponentType<{
    onComplete?: () => void
    size?: number
  }> | null>(null)

  useEffect(() => {
    import("../animated-logo").then((mod) => setAnimatedLogo(() => mod.AnimatedLogo))
  }, [])

  return (
    <div
      className={`fixed inset-0 z-50 bg-[#0a0908] flex items-center justify-center transition-opacity duration-700 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {AnimatedLogo ? (
        <AnimatedLogo size={280} onComplete={onAnimationComplete} />
      ) : (
        // Fallback spinner while AnimatedLogo loads
        <div className="relative">
          <div
            className="w-20 h-20 border rounded-full animate-spin"
            style={{
              borderColor: `${accentColor}4d`,
              borderTopColor: accentColor,
            }}
          />
        </div>
      )}
    </div>
  )
}
