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

  return (
    <Float
      speed={isActive ? 0.6 : 0.3}
      rotationIntensity={isActive ? 0.03 : 0.01}
      floatIntensity={isActive ? 0.25 : 0.1}
    >
      <group position={position}>
        {/* React content floats freely - no solid background planes */}
        <Html
          transform
          distanceFactor={1.15}
          position={[0, 0, 0.01]}
          style={{
            pointerEvents: isActive ? "auto" : "none",
            opacity: isActive ? 1 : 0.15,
            transition: "opacity 0.5s ease-out",
          }}
        >
          <ContextBridge>
            <div
              className="w-[480px] pointer-events-auto"
              style={{
                // iOS Safari can mis-hit-test inputs inside nested transforms.
                // Avoid setting a no-op transform on the active panel.
                transform: isActive ? "none" : "scale(0.95)",
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
