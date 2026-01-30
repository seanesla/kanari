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
  [0, 0, 0],       // Intro
  [6, 1.5, -14],   // Graphics
  [-5, -1, -28],   // API Key
  [4, 2, -42],     // Coach
  [0, 0, -56],     // Preferences
  [0, 0, -70],     // Complete
]

// Welcome staging position (camera starts here).
// The welcome text/particles live around world origin, but we want the camera
// slightly offset to give depth before flying to step 0.
export const WELCOME_POSITION: [number, number, number] = [0, 0, 5]

// Camera sits in front of each panel (closer = more intimate feel)
export const CAMERA_DISTANCE = 3.5

interface FlyingCameraProps {
  currentStep: number
  showWelcome?: boolean
}

export function FlyingCamera({ currentStep, showWelcome = false }: FlyingCameraProps) {
  const { camera } = useThree()
  const targetPos = useRef(new THREE.Vector3())
  const lookAtTarget = useRef(new THREE.Vector3())
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0))

  useFrame(() => {
    const panelPos = showWelcome ? WELCOME_POSITION : (PANEL_POSITIONS[currentStep] || PANEL_POSITIONS[0])

    // Camera position: directly in front of the panel
    targetPos.current.set(
      panelPos[0],
      panelPos[1],
      panelPos[2] + CAMERA_DISTANCE
    )

    // Look at the current target.
    // For the welcome stage, we look toward world origin where the text forms.
    if (showWelcome) {
      lookAtTarget.current.set(0, 0, 0)
    } else {
      lookAtTarget.current.set(panelPos[0], panelPos[1], panelPos[2])
    }

    // Smooth camera position interpolation (0.025 = ~40 frame travel)
    camera.position.lerp(targetPos.current, 0.025)

    // Smooth look-at interpolation for natural head movement
    currentLookAt.current.lerp(lookAtTarget.current, 0.03)
    camera.lookAt(currentLookAt.current)
  })

  return null
}
