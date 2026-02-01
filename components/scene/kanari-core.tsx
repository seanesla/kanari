"use client"

import { useEffect, useRef, type MutableRefObject } from "react"
import { useFrame } from "@react-three/fiber"
import { MeshTransmissionMaterial } from "@react-three/drei"
import * as THREE from "three"
import { useReducedMotion } from "framer-motion"
import type { SceneMode } from "@/lib/types"
import { useSceneMode } from "@/lib/scene-context"
import { getGraphicsProfile } from "@/lib/graphics/quality"
import { ORBITAL_RINGS } from "./constants"

const HIDE_WHEN_BELOW_OPACITY = 0.01

// Convert the old fixed lerp factors into frame-rate independent smoothing.
// Higher values approach the target faster.
const OPACITY_DAMPING = 2.6
const POSITION_DAMPING = {
  landing: 4.1,
  transitioning: 4.1,
  dashboard: 1.0,
} satisfies Record<SceneMode, number>

function damp(current: number, target: number, lambda: number, deltaSeconds: number): number {
  return THREE.MathUtils.damp(current, target, lambda, deltaSeconds)
}

function setMaterialOpacity(
  material: THREE.Material | THREE.Material[] | null | undefined,
  opacity: number
): void {
  if (!material) return

  if (Array.isArray(material)) {
    material.forEach((m) => {
      m.transparent = true
      m.opacity = opacity
    })
    return
  }

  material.transparent = true
  material.opacity = opacity
}

function getTargetOpacity(mode: SceneMode): number {
  // Fade out during the transition and dashboard.
  return mode === "landing" ? 1 : 0
}

function getTargetPosition(mode: SceneMode, scrollProgress: number): { y: number; z: number } {
  if (mode === "transitioning") {
    // Dive forward during transition.
    return { y: -5, z: -15 }
  }

  if (mode === "dashboard") {
    // Hidden position for dashboard.
    return { y: -10, z: -20 }
  }

  // Landing mode: scroll-based position.
  return {
    y: 1 - scrollProgress * 6,
    z: -2 - scrollProgress * 8,
  }
}

interface KanariCoreProps {
  scrollProgressRef: MutableRefObject<number>
  mode: SceneMode
}

export function KanariCore({ scrollProgressRef, mode }: KanariCoreProps) {
  const { accentColor, graphicsQuality } = useSceneMode()
  const reducedMotion = useReducedMotion()
  const profile = getGraphicsProfile(graphicsQuality, { prefersReducedMotion: Boolean(reducedMotion) })
  const groupRef = useRef<THREE.Group | null>(null)
  const innerRef = useRef<THREE.Mesh | null>(null)
  const middleRef = useRef<THREE.Mesh | null>(null)
  const outerRef = useRef<THREE.Mesh | null>(null)
  const ringRefs = useRef<Array<THREE.Mesh | null>>([])
  const opacityRef = useRef(1)
  const ringSegments = profile.quality === "high" ? 128 : profile.quality === "medium" ? 96 : 64

  useEffect(() => {
    const disposeMaterial = (material: THREE.Material | THREE.Material[]) => {
      if (Array.isArray(material)) {
        material.forEach((m) => m.dispose())
        return
      }
      material.dispose()
    }

    const disposeMesh = (mesh: THREE.Mesh | null) => {
      if (!mesh) return
      mesh.geometry?.dispose?.()
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (material) disposeMaterial(material)
    }

    return () => {
      disposeMesh(innerRef.current)
      disposeMesh(middleRef.current)
      disposeMesh(outerRef.current)
      ringRefs.current.forEach(disposeMesh)
    }
  }, [])

  useFrame((state, deltaSeconds) => {
    const group = groupRef.current
    if (!group) return

    const t = state.clock.elapsedTime
    const scrollProgress = scrollProgressRef.current

    const targetOpacity = getTargetOpacity(mode)
    opacityRef.current = damp(opacityRef.current, targetOpacity, OPACITY_DAMPING, deltaSeconds)

    // Only hide once we are effectively invisible while fading out.
    if (targetOpacity === 0 && opacityRef.current < HIDE_WHEN_BELOW_OPACITY) {
      group.visible = false
      return
    }
    group.visible = true

    // Slow rotation that responds to scroll.
    group.rotation.y = t * 0.1 + scrollProgress * Math.PI
    group.rotation.x = Math.sin(t * 0.15) * 0.15 + scrollProgress * 0.5

    // Each layer rotates independently.
    const inner = innerRef.current
    if (inner) {
      inner.rotation.x = t * 0.4
      inner.rotation.z = t * 0.3
      setMaterialOpacity(inner.material, opacityRef.current)
    }

    const middle = middleRef.current
    if (middle) {
      middle.rotation.y = -t * 0.2
      middle.rotation.x = t * 0.15
      setMaterialOpacity(middle.material, opacityRef.current * 0.6)
    }

    const outer = outerRef.current
    if (outer) {
      outer.rotation.z = t * 0.08
      outer.rotation.y = -t * 0.05
      setMaterialOpacity(outer.material, opacityRef.current)
    }

    // Update ring opacity dynamically (not just at render time).
    ringRefs.current.forEach((ring) => {
      if (!ring) return
      setMaterialOpacity(ring.material, opacityRef.current)
    })

    // Subtle breathing scale.
    const breathe = 1 + Math.sin(t * 0.8) * 0.03
    group.scale.setScalar(breathe * opacityRef.current)

    const target = getTargetPosition(mode, scrollProgress)
    const positionLambda = POSITION_DAMPING[mode]
    group.position.y = damp(group.position.y, target.y, positionLambda, deltaSeconds)
    group.position.z = damp(group.position.z, target.z, positionLambda, deltaSeconds)
  })

  return (
    <group ref={groupRef} position={[0, 1, -2]}>
      {/* Innermost - glowing core */}
      <mesh ref={innerRef} scale={0.6}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={1.5}
          metalness={0.9}
          roughness={0.1}
          transparent
        />
      </mesh>

      {/* Middle layer - wireframe icosahedron */}
      <mesh ref={middleRef} scale={1.3}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={0.3}
          wireframe
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Outer layer - glass dodecahedron */}
      <mesh ref={outerRef} scale={2}>
        <dodecahedronGeometry args={[1, 0]} />
        <MeshTransmissionMaterial
          backside
          samples={profile.orbSamples}
          thickness={0.4}
          chromaticAberration={0.3}
          anisotropy={0.3}
          distortion={0.1}
          distortionScale={0.2}
          temporalDistortion={0.1}
          metalness={0.1}
          roughness={0}
          color={accentColor}
          transmission={0.9}
        />
      </mesh>

      {/* Orbital rings */}
      {ORBITAL_RINGS.map((radius, i) => (
        <mesh
          key={i}
          ref={(el) => {
            ringRefs.current[i] = el
          }}
          rotation={[Math.PI / 2 + i * 0.4, i * 0.3, 0]}
          scale={1}
        >
          <torusGeometry args={[radius, 0.015, 16, ringSegments]} />
          <meshStandardMaterial
            color={accentColor}
            emissive={accentColor}
            emissiveIntensity={0.5 - i * 0.1}
            metalness={0.9}
            roughness={0.1}
            transparent
            opacity={1}
          />
        </mesh>
      ))}
    </group>
  )
}
