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
import { useCallback, useRef, useState } from "react"
import type { FocusEvent } from "react"
import { SceneContext } from "@/lib/scene-context"

interface FloatingPanelProps {
  position: [number, number, number]
  children: React.ReactNode
  isActive: boolean
}

export function FloatingPanel({ position, children, isActive }: FloatingPanelProps) {
  // Bridge context INTO the Html portal (separate from Canvas bridge)
  const ContextBridge = useContextBridge(SceneContext)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [isInteracting, setIsInteracting] = useState(false)

  const isActiveElementInside = useCallback(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return false
    const activeEl = document.activeElement
    return !!(activeEl && wrapper.contains(activeEl))
  }, [])

  const handleFocusCapture = useCallback(() => {
    if (isActive) setIsInteracting(true)
  }, [isActive])

  const handleBlurCapture = useCallback(
    (e: FocusEvent<HTMLDivElement>) => {
      if (!isActive) return

      const next = e.relatedTarget as Node | null
      if (next && wrapperRef.current?.contains(next)) return
      if (isActiveElementInside()) return

      setIsInteracting(false)
    },
    [isActive, isActiveElementInside]
  )

  const handlePointerDownCapture = useCallback(() => {
    if (isActive) setIsInteracting(true)
  }, [isActive])

  const handlePointerUpOrCancelCapture = useCallback(() => {
    if (!isActive) return
    if (!isActiveElementInside()) setIsInteracting(false)
  }, [isActive, isActiveElementInside])

  return (
    <Float
      speed={isActive && isInteracting ? 0 : isActive ? 0.6 : 0.3}
      rotationIntensity={isActive ? 0.03 : 0.01}
      floatIntensity={isActive ? 0.25 : 0.1}
    >
      <group position={position}>
        {/* React content floats freely - no solid background planes */}
        <Html
          // Inputs/selection UI are fragile inside CSS3D `matrix3d(...)` transforms (e.g. iOS Safari paste).
          // Render the active, interactive panel in 2D (no CSS3D transform) to keep hit-testing stable.
          transform={!isActive}
          center
          distanceFactor={1.15}
          position={[0, 0, 0.01]}
          pointerEvents={isActive ? "auto" : "none"}
          style={{
            // `pointerEvents` prop only affects the internal wrapper in `transform` mode.
            // Keep `style.pointerEvents` too so it applies in non-transform mode.
            pointerEvents: isActive ? "auto" : "none",
            opacity: isActive ? 1 : 0.15,
            transition: "opacity 0.5s ease-out",
          }}
        >
          <ContextBridge>
            <div
              ref={wrapperRef}
              onFocusCapture={handleFocusCapture}
              onBlurCapture={handleBlurCapture}
              onPointerDownCapture={handlePointerDownCapture}
              onPointerUpCapture={handlePointerUpOrCancelCapture}
              onPointerCancelCapture={handlePointerUpOrCancelCapture}
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
