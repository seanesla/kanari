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
 * Bug pattern: docs/error-patterns/float-orbiting-by-parent-rotation.md
 * Source: Context7 - /pmndrs/drei docs - "Html transform", "Float", "useContextBridge"
 */

import { Html, Float, useContextBridge } from "@react-three/drei"
import { useCallback, useMemo, useRef, useState } from "react"
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


  const floatDelay = useMemo(() => {
    // Stable, deterministic phase offset per panel (same amplitude, different phase).
    const [x, y, z] = position
    const seed = Math.abs(x * 13.37 + y * 7.77 + z * 3.33)
    const duration = 9.5
    return -((seed % duration))
  }, [position])

  return (
    <Float
      position={position}
      // Rotate in 3D, but keep the card's motion in a 2D plane (handled via CSS).
      // This avoids the "elevator" up/down feel while still feeling spatial.
      speed={isActive && isInteracting ? 0 : 1.2}
      rotationIntensity={0.18}
      floatIntensity={0}
    >
      {/* React content floats freely - no solid background planes */}
      <Html
        // Inputs/selection UI are fragile inside CSS3D `matrix3d(...)` transforms (e.g. iOS Safari paste).
        // Render the active, interactive panel in 2D (no CSS3D transform) to keep hit-testing stable.
        transform={!isActive}
        center
        // In non-transform mode, Drei scales the element by `objectScale * distanceFactor`.
        // 1.15 is tuned for transform mode; bump it for the active panel so it doesn't appear "far away".
        distanceFactor={isActive ? 3.25 : 1.15}
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
              data-floating-paused={String(isActive && isInteracting)}
              onFocusCapture={handleFocusCapture}
              onBlurCapture={handleBlurCapture}
              className="w-[min(480px,calc(100vw-2rem))] pointer-events-auto"
              style={{
                // iOS Safari can mis-hit-test inputs inside nested transforms.
                // Avoid setting a no-op transform on the active panel.
                transform: isActive ? "none" : "scale(0.95)",
                transition: "transform 0.5s ease-out",
              }}
            >
              <div className="onboarding-float-plane-x" style={{ animationDelay: `${floatDelay}s` }}>
                <div className="onboarding-float-plane-y" style={{ animationDelay: `${floatDelay * 1.37}s` }}>
                  <div className="onboarding-float-plane-rot" style={{ animationDelay: `${floatDelay * 0.73}s` }}>
                    {children}
                  </div>
                </div>
              </div>
            </div>
          </ContextBridge>
        </Html>
      </Float>
    )
}
