"use client"

import { useEffect, useRef, type MutableRefObject } from "react"
import { useFrame } from "@react-three/fiber"
import { MeshTransmissionMaterial } from "@react-three/drei"
import * as THREE from "three"
import type { SceneMode } from "@/lib/types"
import { useSceneMode } from "@/lib/scene-context"
import { ORBITAL_RINGS } from "./constants"

interface KanariCoreProps {
  scrollProgressRef: MutableRefObject<number>
  mode: SceneMode
}

export function KanariCore({ scrollProgressRef, mode }: KanariCoreProps) {
  const { accentColor } = useSceneMode()
  const groupRef = useRef<THREE.Group>(null)
  const innerRef = useRef<THREE.Mesh>(null)
  const middleRef = useRef<THREE.Mesh>(null)
  const outerRef = useRef<THREE.Mesh>(null)
  const ringRefs = useRef<(THREE.Mesh | null)[]>([])
  const opacityRef = useRef(1)

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

  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime
    const scrollProgress = scrollProgressRef.current

    // Fade out during transition and dashboard
    const targetOpacity = mode === "landing" ? 1 : 0
    opacityRef.current = THREE.MathUtils.lerp(opacityRef.current, targetOpacity, 0.0417)

    // Only hide when fading OUT and nearly invisible (not when fading IN)
    const isFadingOut = targetOpacity === 0
    if (isFadingOut && opacityRef.current < 0.01) {
      groupRef.current.visible = false
      return
    }
    groupRef.current.visible = true

    // Slow rotation that responds to scroll
    groupRef.current.rotation.y = t * 0.1 + scrollProgress * Math.PI
    groupRef.current.rotation.x = Math.sin(t * 0.15) * 0.15 + scrollProgress * 0.5

    // Each layer rotates independently
    if (innerRef.current) {
      innerRef.current.rotation.x = t * 0.4
      innerRef.current.rotation.z = t * 0.3
      const material = innerRef.current.material
      if (material && !Array.isArray(material)) material.opacity = opacityRef.current
    }
    if (middleRef.current) {
      middleRef.current.rotation.y = -t * 0.2
      middleRef.current.rotation.x = t * 0.15
      const material = middleRef.current.material
      if (material && !Array.isArray(material)) material.opacity = opacityRef.current * 0.6
    }
    if (outerRef.current) {
      outerRef.current.rotation.z = t * 0.08
      outerRef.current.rotation.y = -t * 0.05
    }
    // Update ring opacity dynamically (not just at render time)
    ringRefs.current.forEach((ring) => {
      if (ring?.material) {
        (ring.material as THREE.MeshStandardMaterial).opacity = opacityRef.current
      }
    })

    // Subtle breathing scale
    const breathe = 1 + Math.sin(t * 0.8) * 0.03
    groupRef.current.scale.setScalar(breathe * opacityRef.current)

    // Calculate target positions based on mode - always lerp to prevent jumps
    let targetY: number
    let targetZ: number
    let lerpSpeed = 0.05

    if (mode === "transitioning") {
      // Dive forward during transition
      targetY = -5
      targetZ = -15
      lerpSpeed = 0.0667
    } else if (mode === "dashboard") {
      // Hidden position for dashboard
      targetY = -10
      targetZ = -20
      lerpSpeed = 0.0167
    } else {
      // Landing mode - scroll-based position
      targetY = 1 - scrollProgress * 6
      targetZ = -2 - scrollProgress * 8
      lerpSpeed = 0.0667
    }

    // Always lerp to target position to prevent jumps
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetY, lerpSpeed)
    groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, targetZ, lerpSpeed)
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
          samples={8}
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
        <mesh key={i} ref={(el) => { ringRefs.current[i] = el }} rotation={[Math.PI / 2 + i * 0.4, i * 0.3, 0]} scale={1}>
          <torusGeometry args={[radius, 0.015, 16, 100]} />
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
