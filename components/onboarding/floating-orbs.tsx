"use client"

/**
 * Space Background for Onboarding
 *
 * A 3D space-themed background using React Three Fiber + Drei.
 * Features:
 * - Starfield: distant white stars slowly rotating
 * - AccentNebula: Sparkles in the accent color for brand consistency
 * - FloatingGeometry: distant geometric shapes with Float animation
 *
 * Source: Context7 - /pmndrs/drei docs - "Sparkles", "Float"
 */

import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Sparkles, Float } from "@react-three/drei"
import * as THREE from "three"
import { useSceneMode } from "@/lib/scene-context"
import { SCENE_COLORS } from "@/lib/constants"

/**
 * Starfield - distant twinkling stars in a sphere around the camera
 * Exported for reuse in onboarding 3D scene
 */
export function Starfield() {
  const starsRef = useRef<THREE.Points>(null)

  // Generate random star positions distributed in a sphere
  const positions = useMemo(() => {
    const count = 800
    const pos = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      // Distribute stars in a spherical shell
      const radius = 25 + Math.random() * 35
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = radius * Math.cos(phi)
    }

    return pos
  }, [])

  // Very slow rotation - stars are distant, move slower than foreground (parallax)
  // Source: Context7 - /pmndrs/react-three-fiber docs - "useFrame & depth"
  useFrame((state) => {
    if (!starsRef.current) return
    starsRef.current.rotation.y = state.clock.elapsedTime * 0.003
  })

  return (
    <points ref={starsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        color="#ffffff"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  )
}

/**
 * AccentNebula - floating particles in the accent color
 * Uses Drei Sparkles for GPU-optimized particle animation
 * Exported for reuse in onboarding 3D scene
 */
export function AccentNebula({ accentColor }: { accentColor: string }) {
  const nebulaRef = useRef<THREE.Group>(null)

  // Faster rotation than stars - particles are closer (parallax depth cue)
  // Source: Context7 - /pmndrs/react-three-fiber docs - "useFrame & depth"
  useFrame((state) => {
    if (!nebulaRef.current) return
    nebulaRef.current.rotation.y = state.clock.elapsedTime * 0.01
  })

  return (
    <group ref={nebulaRef}>
      {/* Primary layer - scattered accent particles */}
      <Sparkles
        count={60}
        speed={0.2}
        opacity={0.6}
        color={accentColor}
        size={2}
        scale={[18, 18, 12]}
        noise={[0.4, 0.4, 0.4]}
      />

      {/* Secondary layer - larger, slower, more diffuse */}
      <Sparkles
        count={30}
        speed={0.08}
        opacity={0.3}
        color={accentColor}
        size={4}
        scale={[25, 25, 18]}
        noise={[0.2, 0.2, 0.2]}
      />
    </group>
  )
}

/**
 * FloatingGeometry - distant geometric shapes that drift gently
 * Matches the aesthetic of truth-core and section-accent
 * Exported for reuse in onboarding 3D scene
 */
export function FloatingGeometry({ accentColor }: { accentColor: string }) {
  // Positions for geometric accents - spread out in the background
  const shapes = useMemo(
    () => [
      { pos: [-12, 6, -15] as [number, number, number], scale: 0.4, type: "octahedron" },
      { pos: [14, -4, -18] as [number, number, number], scale: 0.35, type: "icosahedron" },
      { pos: [-8, -8, -20] as [number, number, number], scale: 0.3, type: "tetrahedron" },
      { pos: [10, 8, -22] as [number, number, number], scale: 0.25, type: "dodecahedron" },
      { pos: [0, -10, -25] as [number, number, number], scale: 0.2, type: "octahedron" },
    ],
    []
  )

  return (
    <>
      {shapes.map((shape, i) => (
        <Float
          key={i}
          speed={0.5 + i * 0.1}
          rotationIntensity={0.3}
          floatIntensity={0.4}
        >
          <mesh position={shape.pos} scale={shape.scale}>
            {shape.type === "octahedron" && <octahedronGeometry args={[1, 0]} />}
            {shape.type === "icosahedron" && <icosahedronGeometry args={[1, 0]} />}
            {shape.type === "tetrahedron" && <tetrahedronGeometry args={[1, 0]} />}
            {shape.type === "dodecahedron" && <dodecahedronGeometry args={[1, 0]} />}
            <meshStandardMaterial
              color={accentColor}
              emissive={accentColor}
              emissiveIntensity={0.4}
              metalness={0.8}
              roughness={0.2}
              transparent
              opacity={0.5}
              wireframe={i % 2 === 0}
            />
          </mesh>
        </Float>
      ))}
    </>
  )
}

/**
 * OnboardingScene - combines all background elements
 */
function OnboardingScene() {
  const { accentColor } = useSceneMode()

  return (
    <>
      {/* Lighting for geometric shapes */}
      <ambientLight intensity={0.15} />
      <pointLight position={[10, 10, 10]} intensity={0.3} color={accentColor} />

      {/* Layer 1: Distant starfield */}
      <Starfield />

      {/* Layer 2: Accent-colored nebula particles */}
      <AccentNebula accentColor={accentColor} />

      {/* Layer 3: Floating geometric accents */}
      <FloatingGeometry accentColor={accentColor} />
    </>
  )
}

/**
 * FloatingOrbs - main exported component
 * Wraps the 3D scene in a Canvas with appropriate settings
 */
export function FloatingOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={[SCENE_COLORS.background]} />
        <OnboardingScene />
      </Canvas>
    </div>
  )
}
