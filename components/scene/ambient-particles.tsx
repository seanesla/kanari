"use client"

import { useRef, useMemo, type MutableRefObject } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import type { SceneMode } from "@/lib/types"
import { SCENE_COLORS } from "@/lib/constants"
import { PARTICLES } from "./constants"

interface AmbientParticlesProps {
  scrollProgressRef: MutableRefObject<number>
  mode: SceneMode
}

export function AmbientParticles({ scrollProgressRef, mode }: AmbientParticlesProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const tempVec3 = useMemo(() => new THREE.Vector3(), [])
  const velocitiesRef = useRef<THREE.Vector3[]>([])
  const scaleMultipliersRef = useRef<number[]>([])
  const prevModeRef = useRef<SceneMode>(mode)

  // Different particle counts for different modes
  const targetCount = mode === "dashboard" ? PARTICLES.dashboard : PARTICLES.landing

  const particles = useMemo(() => {
    const arr = Array.from({ length: PARTICLES.landing }, (_, i) => ({
      position: new THREE.Vector3(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 20 - 10
      ),
      basePosition: new THREE.Vector3(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 20 - 10
      ),
      speed: Math.random() * 0.3 + 0.1,
      offset: Math.random() * Math.PI * 2,
      scale: 0.03 + Math.random() * 0.05,
    }))
    velocitiesRef.current = arr.map(() => new THREE.Vector3(0, 0, 0))
    scaleMultipliersRef.current = arr.map(() => 1)
    return arr
  }, [])

  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.elapsedTime

    // Detect mode change and reset velocities when leaving transitioning
    if (prevModeRef.current !== mode) {
      prevModeRef.current = mode
      if (mode !== "transitioning") {
        // Reset velocities when exiting transition mode
        velocitiesRef.current.forEach((v) => v.set(0, 0, 0))
      }
    }

    particles.forEach((p, i) => {
      // Lerp scale multiplier for smooth visibility transitions
      const targetScale = i < targetCount ? 1 : 0
      scaleMultipliersRef.current[i] = THREE.MathUtils.lerp(
        scaleMultipliersRef.current[i],
        targetScale,
        0.0417
      )

      if (mode === "transitioning") {
        // Scatter outward during transition with damping
        // Reuse tempVec3 to avoid GC pressure (was: p.position.clone().normalize())
        tempVec3.copy(p.position).normalize().multiplyScalar(0.02)
        velocitiesRef.current[i].add(tempVec3)
        // Apply damping to prevent runaway velocities
        velocitiesRef.current[i].multiplyScalar(0.98)
        p.position.add(velocitiesRef.current[i])
      } else if (mode === "dashboard") {
        // Lerp back toward base position first, then apply calm drift
        p.position.lerp(p.basePosition, 0.025)
        const x = p.basePosition.x + Math.sin(t * p.speed * 0.3 + p.offset) * 1
        const y = p.basePosition.y + Math.cos(t * p.speed * 0.2) * 0.5
        const z = p.basePosition.z
        // Lerp to target position for smooth transition
        p.position.x = THREE.MathUtils.lerp(p.position.x, x, 0.0417)
        p.position.y = THREE.MathUtils.lerp(p.position.y, y, 0.0417)
        p.position.z = THREE.MathUtils.lerp(p.position.z, z, 0.0417)
      } else {
        // Landing mode - lerp back toward base, then apply normal movement
        p.position.lerp(p.basePosition, 0.0167)
        const x = p.basePosition.x + Math.sin(t * p.speed + p.offset) * 2
        const y = p.basePosition.y + Math.cos(t * p.speed * 0.7) * 1.5 - scrollProgressRef.current * 15
        const z = p.basePosition.z
        // Lerp to target for smooth recovery from scattered positions
        p.position.x = THREE.MathUtils.lerp(p.position.x, x, 0.0667)
        p.position.y = THREE.MathUtils.lerp(p.position.y, y, 0.0667)
        p.position.z = THREE.MathUtils.lerp(p.position.z, z, 0.0667)
      }

      dummy.position.copy(p.position)
      dummy.scale.setScalar(p.scale * scaleMultipliersRef.current[i])
      dummy.updateMatrix()
      meshRef.current!.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, particles.length]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial
        color={SCENE_COLORS.accent}
        emissive={SCENE_COLORS.accent}
        emissiveIntensity={0.6}
        transparent
        opacity={0.8}
      />
    </instancedMesh>
  )
}
