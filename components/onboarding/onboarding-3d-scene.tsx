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
import { AdaptiveDpr, useContextBridge } from "@react-three/drei"
import { Starfield, AccentNebula, ShootingStars, FloatingGeometry } from "./floating-orbs"
import { CAMERA_DISTANCE, FlyingCamera, PANEL_POSITIONS } from "./flying-camera"
import { FloatingPanel } from "./floating-panel"
import { WelcomeParticles } from "./welcome-particles"
import { SCENE_COLORS } from "@/lib/constants"
import { SceneContext, useSceneMode } from "@/lib/scene-context"
import { getGraphicsProfile } from "@/lib/graphics/quality"
import { FrameLimiter } from "@/components/scene/frame-limiter"
import { useReducedMotion } from "framer-motion"

interface Onboarding3DSceneProps {
  currentStep: number
  totalSteps: number
  children: React.ReactNode
  showWelcome?: boolean
  onWelcomeComplete?: () => void
}

/**
 * SceneContent - all 3D elements including floating panels with step content
 */
function SceneContent({
  currentStep,
  children,
  showWelcome,
  onWelcomeComplete,
}: {
  currentStep: number
  children: React.ReactNode
  showWelcome?: boolean
  onWelcomeComplete?: () => void
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
      <ShootingStars accentColor={accentColor} />
      <FloatingGeometry accentColor={accentColor} />

      {/* Camera controller - flies between panel positions */}
      <FlyingCamera currentStep={currentStep} showWelcome={Boolean(showWelcome)} />

      {showWelcome && (
        <WelcomeParticles
          accentColor={accentColor}
          onComplete={onWelcomeComplete}
        />
      )}
      {/* All panels exist in 3D space */}
      {!showWelcome &&
        PANEL_POSITIONS.map((position, idx) => (
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
  totalSteps: _totalSteps,
  children,
  showWelcome,
  onWelcomeComplete,
}: Onboarding3DSceneProps) {
  // Bridge React context INTO the Canvas (required for Drei Html portals)
  // Source: Context7 - /pmndrs/drei docs - "useContextBridge"
  const ContextBridge = useContextBridge(SceneContext)
  const { graphicsQuality } = useSceneMode()
  const reducedMotion = useReducedMotion()
  const profile = getGraphicsProfile(graphicsQuality, { prefersReducedMotion: Boolean(reducedMotion) })
  const powerPreference: WebGLPowerPreference =
    profile.quality === "high" ? "high-performance" : "low-power"

  // Initial camera position.
  // If we're showing the welcome, we start a bit further back so the particle
  // formation has room to breathe.
  const initialPosition = PANEL_POSITIONS[0] || [0, 0, 0]
  const cameraPosition: [number, number, number] = showWelcome
    ? [0, 0, 5 + CAMERA_DISTANCE]
    : [initialPosition[0], initialPosition[1], initialPosition[2] + CAMERA_DISTANCE]

  return (
    <div className="fixed inset-0 z-0">
      <Canvas
        camera={{
          position: cameraPosition,
          fov: 50,
          near: 0.1,
          far: 150,
        }}
        dpr={profile.dpr}
        gl={{ antialias: profile.antialias, alpha: true, powerPreference }}
        frameloop={profile.maxFps === null && profile.animate ? "always" : "demand"}
      >
        <AdaptiveDpr />
        {profile.maxFps !== null ? <FrameLimiter maxFps={profile.maxFps} /> : null}
        <color attach="background" args={[SCENE_COLORS.background]} />
        <ContextBridge>
          <SceneContent
            currentStep={currentStep}
            showWelcome={showWelcome}
            onWelcomeComplete={onWelcomeComplete}
          >
            {children}
          </SceneContent>
        </ContextBridge>
      </Canvas>
    </div>
  )
}
