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
import { useEffect, useMemo, useRef } from "react"
import { SceneContext } from "@/lib/scene-context"

interface FloatingPanelProps {
  position: [number, number, number]
  children: React.ReactNode
  isActive: boolean
}

export function FloatingPanel({ position, children, isActive }: FloatingPanelProps) {
  // Bridge context INTO the Html portal (separate from Canvas bridge)
  const ContextBridge = useContextBridge(SceneContext)

  const floatDelay = useMemo(() => {
    // Stable, deterministic phase offset per panel.
    const [x, y, z] = position
    const seed = Math.abs(x * 13.37 + y * 7.77 + z * 3.33)
    const duration = 12.0
    return -((seed % duration))
  }, [position])

  const motionRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = motionRef.current
    if (!el) return

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
    if (reduceMotion) return

    let raf = 0

    const tick = () => {
      const t = performance.now() / 1000

      // Smooth, non-waypoint drift in a plane.
      // Keep it subtle: just enough to read as floating.
      const x =
        Math.sin((t + floatDelay) * 0.37) * 10 +
        Math.sin((t + floatDelay * 1.7) * 0.91) * 3

      const y =
        Math.cos((t + floatDelay * 0.9) * 0.29) * 8 +
        Math.sin((t + floatDelay * 1.13) * 0.57) * 4

      const r = Math.sin((t + floatDelay * 0.6) * 0.18) * 0.25

      el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${r.toFixed(3)}deg)`
      raf = window.requestAnimationFrame(tick)
    }

    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [floatDelay])

  return (
    <Float
      position={position}
      // Gentle 3D drift (this is smooth sine-based motion).
      // The planar drift is handled separately in the DOM to avoid the "waypoint" feel.
      speed={1.05}
      rotationIntensity={0.2}
      floatIntensity={0.45}
      floatingRange={[-0.06, 0.06]}
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
              data-testid="panel-wrapper"
              className="w-[min(480px,calc(100vw-2rem))] pointer-events-auto"
              style={{
                // iOS Safari can mis-hit-test inputs inside nested transforms.
                // Avoid setting a no-op transform on the active panel.
                transform: isActive ? "none" : "scale(0.95)",
                transition: "transform 0.5s ease-out",
              }}
            >
              <div ref={motionRef} style={{ willChange: "transform" }}>
                {children}
              </div>
            </div>
          </ContextBridge>
        </Html>
      </Float>
    )
}
