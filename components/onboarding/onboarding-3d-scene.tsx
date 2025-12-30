"use client"

/**
 * Onboarding 3D Scene
 *
 * Full 3D experience where step content floats as panels in space.
 * Camera flies between panels when navigating steps.
 * Uses useContextBridge to pass React context into Drei Html portals.
 *
 * Source: Context7 - /pmndrs/drei docs - "useContextBridge"
 */

import React from "react"
import { Canvas } from "@react-three/fiber"
import { useContextBridge } from "@react-three/drei"
import { Starfield, AccentNebula, FloatingGeometry } from "./floating-orbs"
import { FlyingCamera, PANEL_POSITIONS } from "./flying-camera"
import { FloatingPanel } from "./floating-panel"
import { SCENE_COLORS } from "@/lib/constants"
import { SceneContext, useSceneMode } from "@/lib/scene-context"

interface Onboarding3DSceneProps {
  currentStep: number
  totalSteps: number
  children: React.ReactNode
}

/**
 * SceneContent - all 3D elements including floating panels with step content
 */
function SceneContent({
  currentStep,
  children,
}: {
  currentStep: number
  children: React.ReactNode
}) {
  const { accentColor } = useSceneMode()
  const stepComponents = React.Children.toArray(children)

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.2} />
      <pointLight
        position={[10, 10, 10]}
        intensity={0.5}
        color={accentColor}
      />
      <pointLight
        position={[-10, -5, 5]}
        intensity={0.25}
        color="#ffffff"
      />

      {/* Atmospheric fog for depth - distant panels fade */}
      <fog attach="fog" args={[SCENE_COLORS.background, 8, 70]} />

      {/* Background elements */}
      <Starfield />
      <AccentNebula accentColor={accentColor} />
      <FloatingGeometry accentColor={accentColor} />

      {/* Camera controller - flies between panel positions */}
      <FlyingCamera currentStep={currentStep} />

      {/* All panels exist in 3D space */}
      {PANEL_POSITIONS.map((position, idx) => (
        <FloatingPanel
          key={idx}
          position={position}
          isActive={idx === currentStep}
        >
          {stepComponents[idx] || null}
        </FloatingPanel>
      ))}
    </>
  )
}

/**
 * Onboarding3DScene - Canvas wrapper with context bridging
 * Children are step components that get rendered inside 3D floating panels
 */
export function Onboarding3DScene({
  currentStep,
  totalSteps,
  children,
}: Onboarding3DSceneProps) {
  // Bridge React context INTO the Canvas (required for Drei Html portals)
  // Source: Context7 - /pmndrs/drei docs - "useContextBridge"
  const ContextBridge = useContextBridge(SceneContext)

  // Initial camera position (in front of first panel)
  const initialPosition = PANEL_POSITIONS[0] || [0, 0, 0]
  const cameraPosition: [number, number, number] = [
    initialPosition[0],
    initialPosition[1],
    initialPosition[2] + 5,
  ]

  return (
    <div className="fixed inset-0 z-0">
      <Canvas
        camera={{
          position: cameraPosition,
          fov: 50,
          near: 0.1,
          far: 150,
        }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={[SCENE_COLORS.background]} />
        <ContextBridge>
          <SceneContent currentStep={currentStep}>
            {children}
          </SceneContent>
        </ContextBridge>
      </Canvas>
    </div>
  )
}
