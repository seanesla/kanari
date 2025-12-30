"use client"

/**
 * Flying Camera Controller
 *
 * Smoothly animates the camera between panel positions in 3D space.
 * Creates the "flying through space" effect for onboarding.
 *
 * Source: Context7 - /pmndrs/react-three-fiber docs - "useFrame camera control"
 */

import { useFrame, useThree } from "@react-three/fiber"
import { useRef } from "react"
import * as THREE from "three"

// Panel positions in 3D space - spread along Z axis with varied X/Y
export const PANEL_POSITIONS: [number, number, number][] = [
  [0, 0, 0],       // Welcome
  [6, 1.5, -14],   // Theme
  [-5, -1, -28],   // API Key
  [4, 2, -42],     // Preferences
  [0, 0, -56],     // Complete
]

// Camera sits in front of each panel
const CAMERA_DISTANCE = 5

interface FlyingCameraProps {
  currentStep: number
}

export function FlyingCamera({ currentStep }: FlyingCameraProps) {
  const { camera } = useThree()
  const targetPos = useRef(new THREE.Vector3())
  const lookAtTarget = useRef(new THREE.Vector3())
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0))

  useFrame(() => {
    const panelPos = PANEL_POSITIONS[currentStep] || PANEL_POSITIONS[0]

    // Camera position: directly in front of the panel
    targetPos.current.set(
      panelPos[0],
      panelPos[1],
      panelPos[2] + CAMERA_DISTANCE
    )

    // Look at the panel center
    lookAtTarget.current.set(panelPos[0], panelPos[1], panelPos[2])

    // Smooth camera position interpolation (0.025 = ~40 frame travel)
    camera.position.lerp(targetPos.current, 0.025)

    // Smooth look-at interpolation for natural head movement
    currentLookAt.current.lerp(lookAtTarget.current, 0.03)
    camera.lookAt(currentLookAt.current)
  })

  return null
}
