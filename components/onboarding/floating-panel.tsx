"use client"

/**
 * Floating Panel Component
 *
 * A 3D panel that floats in space with React content inside.
 * Uses Drei's Html component with transform for true 3D positioning.
 *
 * IMPORTANT: Html creates a React DOM portal outside the R3F reconciler.
 * We need useContextBridge to pass React context INTO the Html portal.
 * This is a separate bridge from the one wrapping the Canvas.
 *
 * Bug pattern: docs/error-patterns/portal-children-context.md
 * Source: Context7 - /pmndrs/drei docs - "Html transform", "Float", "useContextBridge"
 */

import { Html, Float, useContextBridge } from "@react-three/drei"
import { useSceneMode, SceneContext } from "@/lib/scene-context"

interface FloatingPanelProps {
  position: [number, number, number]
  children: React.ReactNode
  isActive: boolean
}

export function FloatingPanel({ position, children, isActive }: FloatingPanelProps) {
  const { accentColor } = useSceneMode()
  // Bridge context INTO the Html portal (separate from Canvas bridge)
  const ContextBridge = useContextBridge(SceneContext)

  return (
    <Float
      speed={isActive ? 0.8 : 0.3}
      rotationIntensity={isActive ? 0.05 : 0.02}
      floatIntensity={isActive ? 0.4 : 0.2}
    >
      <group position={position}>
        {/* Glowing backdrop plane */}
        <mesh position={[0, 0, -0.05]}>
          <planeGeometry args={[5.5, 4.5]} />
          <meshStandardMaterial
            color={isActive ? "#1a1a2e" : "#0d0d15"}
            emissive={isActive ? accentColor : "#000000"}
            emissiveIntensity={isActive ? 0.15 : 0}
            transparent
            opacity={isActive ? 0.85 : 0.2}
          />
        </mesh>

        {/* Border glow for active panel */}
        {isActive && (
          <mesh position={[0, 0, -0.06]}>
            <planeGeometry args={[5.7, 4.7]} />
            <meshBasicMaterial
              color={accentColor}
              transparent
              opacity={0.3}
            />
          </mesh>
        )}

        {/* Actual React content - ContextBridge passes context into Html portal */}
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
                transform: isActive ? "scale(1)" : "scale(0.95)",
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
