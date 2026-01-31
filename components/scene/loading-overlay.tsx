"use client"

import { AnimatedLogo } from "@/components/animated-logo"

interface LoadingOverlayProps {
  visible: boolean
  onAnimationComplete?: () => void
}

export function LoadingOverlay({ visible, onAnimationComplete }: LoadingOverlayProps) {
  return (
    <div
      data-startup-overlay="true"
      className={`fixed inset-0 z-50 bg-[#0a0908] flex items-center justify-center transition-opacity duration-700 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <AnimatedLogo size={280} onComplete={onAnimationComplete} />
    </div>
  )
}
