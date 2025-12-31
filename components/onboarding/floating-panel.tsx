"use client"

/**
 * Floating Panel Component
 *
 * A minimal 3D panel that floats in space with React content inside.
 * Uses Drei's Html component with transform for true 3D positioning.
 *
 * Design: Ethereal/minimal - no solid background planes. Content floats
 * freely in space with just the glassmorphic card styling from step components.
 *
 * IMPORTANT: Html creates a React DOM portal outside the R3F reconciler.
 * We need useContextBridge to pass React context INTO the Html portal.
 * This is a separate bridge from the one wrapping the Canvas.
 *
 * Bug pattern: docs/error-patterns/portal-children-context.md
 * Source: Context7 - /pmndrs/drei docs - "Html transform", "Float", "useContextBridge"
 */

import { useEffect, useState } from "react"
import { Html, Float, useContextBridge } from "@react-three/drei"
import { SceneContext } from "@/lib/scene-context"

interface FloatingPanelProps {
  position: [number, number, number]
  children: React.ReactNode
  isActive: boolean
}

export function FloatingPanel({ position, children, isActive }: FloatingPanelProps) {
  // Bridge context INTO the Html portal (separate from Canvas bridge)
  const ContextBridge = useContextBridge(SceneContext)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    if (typeof navigator === "undefined") return
    const ua = navigator.userAgent || ""
    const isiOSDevice =
      /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    setIsIOS(isiOSDevice)
  }, [])
  // iOS Safari hit-testing/paste crashes with Drei Html matrix3d transforms.
  // Error pattern: docs/error-patterns/ios-drei-html-transform-inputs.md
  const useTransform = !isIOS
  const panelScale = isActive ? 1 : 0.95
  const htmlDistanceFactor = isIOS ? undefined : 1.15
  const panelTransform = isIOS
    ? `translate(-50%, -50%) scale(${panelScale})`
    : `scale(${panelScale})`
  const panelOpacity = isIOS ? (isActive ? 1 : 0) : isActive ? 1 : 0.15

  return (
    <Float
      speed={isActive ? 0.6 : 0.3}
      rotationIntensity={isActive ? 0.03 : 0.01}
      floatIntensity={isActive ? 0.25 : 0.1}
    >
      <group position={position}>
        {/* React content floats freely - no solid background planes */}
        <Html
          transform={useTransform}
          distanceFactor={htmlDistanceFactor}
          position={[0, 0, 0.01]}
          style={{
            pointerEvents: isActive ? "auto" : "none",
            opacity: panelOpacity,
            transition: "opacity 0.5s ease-out",
          }}
        >
          <ContextBridge>
            <div
              className="w-[480px] max-w-[calc(100vw-2rem)] pointer-events-auto"
              style={{
                transform: panelTransform,
                transition: "transform 0.5s ease-out",
              }}
            >
              {children}
            </div>
          </ContextBridge>
        </Html>
      </group>
    </Float>
  )
}
