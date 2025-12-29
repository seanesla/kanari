"use client"

import { useRef, useEffect, type MutableRefObject } from "react"
import { useFrame } from "@react-three/fiber"
import { MeshTransmissionMaterial, Float } from "@react-three/drei"
import * as THREE from "three"
import type { SceneMode } from "@/lib/types"
import { SCENE_COLORS } from "@/lib/constants"

export type SectionType = "stats" | "problem" | "how" | "cta"

interface SectionAccentProps {
  position: [number, number, number]
  scrollProgressRef: MutableRefObject<number>
  showAfter: number
  type: SectionType
  mode: SceneMode
}

export function SectionAccent({
  position,
  scrollProgressRef,
  showAfter,
  type,
  mode,
}: SectionAccentProps) {
  const ref = useRef<THREE.Group>(null)
  const visibilityRef = useRef(0)
  const modeMultiplierRef = useRef(mode === "landing" ? 1 : 0)
  const materialsRef = useRef<THREE.Material[]>([])
  const materialsCachedRef = useRef(false)

  // Cache material references once on mount (instead of traversing every frame)
  useEffect(() => {
    if (!ref.current || materialsCachedRef.current) return

    const materials: THREE.Material[] = []
    ref.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as THREE.Material
        if ('transparent' in mat && mat.transparent) {
          materials.push(mat)
        }
      }
    })
    materialsRef.current = materials
    materialsCachedRef.current = true
  })

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    const scrollProgress = scrollProgressRef.current

    // Smoothly interpolate mode multiplier for fade transitions
    const targetModeMultiplier = mode === "landing" ? 1 : 0
    modeMultiplierRef.current = THREE.MathUtils.lerp(
      modeMultiplierRef.current,
      targetModeMultiplier,
      0.08
    )

    // Calculate target visibility based on scroll position
    const scrollVisibility = Math.max(0, Math.min(1, (scrollProgress - showAfter) * 4))
    const targetVisibility = scrollVisibility * modeMultiplierRef.current

    // Lerp toward target visibility for smooth transitions
    visibilityRef.current = THREE.MathUtils.lerp(
      visibilityRef.current,
      targetVisibility,
      0.1
    )

    // Apply visibility to scale (never return null - let scale handle it)
    const scale = visibilityRef.current * (type === "cta" ? 1.5 : 1)
    ref.current.scale.setScalar(scale)
    ref.current.rotation.y = t * 0.2

    // Subtle float
    ref.current.position.y = position[1] + Math.sin(t * 0.5) * 0.2

    // Update cached material opacities (no more traverse every frame)
    const opacity = visibilityRef.current
    for (const mat of materialsRef.current) {
      if ('opacity' in mat) {
        (mat as THREE.MeshStandardMaterial).opacity = opacity
      }
    }
  })

  return (
    <group ref={ref} position={position}>
      {type === "stats" && <StatsAccent />}
      {type === "problem" && <ProblemAccent />}
      {type === "how" && <HowAccent />}
      {type === "cta" && <CtaAccent />}
    </group>
  )
}

function StatsAccent() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useRef(new THREE.Object3D()).current

  // Set up instance matrices once on mount
  useEffect(() => {
    if (!meshRef.current) return
    for (let i = 0; i < 16; i++) {
      dummy.position.set(
        ((i % 4) - 1.5) * 0.8,
        Math.floor(i / 4 - 1.5) * 0.8,
        0
      )
      dummy.scale.setScalar(0.2)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [dummy])

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 16]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={SCENE_COLORS.accent}
        emissive={SCENE_COLORS.accent}
        emissiveIntensity={0.5}
        metalness={0.9}
        roughness={0.1}
        transparent
        opacity={1}
      />
    </instancedMesh>
  )
}

function ProblemAccent() {
  return (
    <Float speed={2} rotationIntensity={0.3}>
      <group>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh
            key={i}
            position={[Math.sin(i * 1.2) * 1.5, Math.cos(i * 1.5) * 1, Math.sin(i * 0.8) * 0.5]}
            rotation={[i * 0.5, i * 0.3, i * 0.2]}
            scale={0.4 + i * 0.1}
          >
            <tetrahedronGeometry args={[1, 0]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? SCENE_COLORS.accent : SCENE_COLORS.accentDark}
              emissive={i % 2 === 0 ? SCENE_COLORS.accent : SCENE_COLORS.accentDark}
              emissiveIntensity={0.4}
              metalness={0.8}
              roughness={0.2}
              transparent
              opacity={1}
            />
          </mesh>
        ))}
      </group>
    </Float>
  )
}

function HowAccent() {
  const nodePositions: [number, number, number][] = [
    [0, 0, 0],
    [1.5, 0.5, 0],
    [3, 0, 0.5],
  ]

  return (
    <Float speed={1.5} rotationIntensity={0.2}>
      <group>
        {nodePositions.map((pos, i) => (
          <group key={i}>
            <mesh position={pos} scale={0.3}>
              <sphereGeometry args={[1, 16, 16]} />
              <meshStandardMaterial
                color={SCENE_COLORS.accent}
                emissive={SCENE_COLORS.accent}
                emissiveIntensity={0.6}
                metalness={0.9}
                roughness={0.1}
                transparent
                opacity={1}
              />
            </mesh>
            {i < 2 && (
              <mesh
                position={[pos[0] + 0.75 + i * 0.75, pos[1] + 0.25, pos[2] + 0.125]}
                rotation={[0, 0, -0.3 + i * 0.3]}
              >
                <cylinderGeometry args={[0.02, 0.02, 1.8, 8]} />
                <meshStandardMaterial
                  color={SCENE_COLORS.accent}
                  emissive={SCENE_COLORS.accent}
                  emissiveIntensity={0.3}
                  transparent
                  opacity={0.6}
                />
              </mesh>
            )}
          </group>
        ))}
      </group>
    </Float>
  )
}

function CtaAccent() {
  return (
    <Float speed={1} rotationIntensity={0.4}>
      <mesh scale={1.2}>
        <torusKnotGeometry args={[1, 0.3, 64, 16, 2, 3]} />
        <MeshTransmissionMaterial
          backside
          samples={4}
          resolution={256}
          thickness={0.3}
          chromaticAberration={0.3}
          anisotropy={0.3}
          distortion={0.2}
          distortionScale={0.3}
          temporalDistortion={0.1}
          metalness={0.1}
          roughness={0}
          color={SCENE_COLORS.accent}
          transmission={0.9}
        />
      </mesh>
    </Float>
  )
}
