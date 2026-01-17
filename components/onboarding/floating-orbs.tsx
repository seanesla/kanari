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

import { useMemo } from "react"
import { Canvas } from "@react-three/fiber"
import { Sparkles, Float } from "@react-three/drei"
import { useSceneMode } from "@/lib/scene-context"
import { SCENE_COLORS } from "@/lib/constants"

/**
 * Starfield - distant twinkling stars spanning the entire onboarding journey
 * Exported for reuse in onboarding 3D scene
 *
 * Camera travels from Z=0 to Z=-56, so stars span Z=+10 to Z=-70
 */
export function Starfield() {
  // Generate random star positions in an elongated volume along the journey path
  const positions = useMemo(() => {
    const count = 1200 // More stars to fill the larger volume
    const pos = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      // Distribute stars in a cylinder/tube around the camera path
      // X and Y spread out to create surrounding starfield
      const angle = Math.random() * Math.PI * 2
      const radius = 15 + Math.random() * 40 // Distance from center axis

      pos[i * 3] = Math.cos(angle) * radius     // X: circular spread
      pos[i * 3 + 1] = Math.sin(angle) * radius // Y: circular spread
      pos[i * 3 + 2] = 10 - Math.random() * 80  // Z: from +10 to -70
    }

    return pos
  }, [])

  // Stars remain static - camera movement provides all needed parallax

  return (
    <points>
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
 *
 * Extended to span the entire onboarding journey (Z=+10 to Z=-70)
 * No group rotation - relies on Sparkles' built-in gentle drift for natural motion
 */
export function AccentNebula({ accentColor }: { accentColor: string }) {
  return (
    // Position at center of journey (Z=-28) so particles span equally in both directions
    <group position={[0, 0, -28]}>
      {/* Primary layer - scattered accent particles spanning the journey */}
      <Sparkles
        count={100}
        speed={0.15}
        opacity={0.6}
        color={accentColor}
        size={2}
        scale={[20, 20, 75]} // Extended Z to cover Z=+10 to Z=-66
        noise={[0.4, 0.4, 0.3]}
      />

      {/* Secondary layer - larger, slower, more diffuse */}
      <Sparkles
        count={50}
        speed={0.08}
        opacity={0.3}
        color={accentColor}
        size={4}
        scale={[28, 28, 85]} // Wider and longer for ambient glow
        noise={[0.2, 0.2, 0.2]}
      />
    </group>
  )
}

/**
 * FloatingGeometry - distant geometric shapes that drift gently
 * Matches the aesthetic of truth-core and section-accent
 * Exported for reuse in onboarding 3D scene
 *
 * Shapes spread across the entire journey path (Z=0 to Z=-60)
 */
export function FloatingGeometry({ accentColor }: { accentColor: string }) {
  // Positions for geometric accents - spread along the entire journey path
  const shapes = useMemo(
    () => [
      // Near welcome (Z=0)
      { pos: [-10, 5, -5] as [number, number, number], scale: 0.35, type: "octahedron" },
      { pos: [12, -3, -8] as [number, number, number], scale: 0.3, type: "icosahedron" },
      // Near theme (Z=-14)
      { pos: [-8, -6, -18] as [number, number, number], scale: 0.4, type: "tetrahedron" },
      { pos: [10, 7, -22] as [number, number, number], scale: 0.25, type: "dodecahedron" },
      // Near API key (Z=-28)
      { pos: [-12, 4, -32] as [number, number, number], scale: 0.35, type: "octahedron" },
      { pos: [14, -5, -35] as [number, number, number], scale: 0.3, type: "icosahedron" },
      // Near preferences (Z=-42)
      { pos: [-9, -7, -46] as [number, number, number], scale: 0.4, type: "tetrahedron" },
      { pos: [11, 6, -50] as [number, number, number], scale: 0.25, type: "dodecahedron" },
      // Near complete (Z=-56)
      { pos: [-10, 5, -60] as [number, number, number], scale: 0.35, type: "octahedron" },
      { pos: [8, -8, -64] as [number, number, number], scale: 0.3, type: "icosahedron" },
    ],
    []
  )

  return (
    <>
      {shapes.map((shape, i) => (
        <Float
          key={i}
          position={shape.pos}
          speed={0.4} // Consistent slow speed for all shapes
          rotationIntensity={0.15}
          floatIntensity={0.3}
        >
          <mesh scale={shape.scale}>
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
