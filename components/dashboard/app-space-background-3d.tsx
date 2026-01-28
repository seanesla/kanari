"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Sparkles, Stars, shaderMaterial } from "@react-three/drei"
import * as THREE from "three"
import { useReducedMotion } from "framer-motion"
import { useSceneMode } from "@/lib/scene-context"
import { generateLightVariant } from "@/lib/color-utils"
import {
  FloatingGeometryField,
  GalaxySprites,
  NebulaBackdrop,
  NebulaVolume,
  ShootingStars,
  StarClusters,
} from "@/components/background/space-effects"

// Source: Context7 - pmndrs/drei docs - "shaderMaterial"
const AuroraCurtainMaterial = shaderMaterial(
  {
    time: 0,
    colorA: new THREE.Color("#ffffff"),
    colorB: new THREE.Color("#ffffff"),
    opacity: 0.08,
    seed: 0,
  },
  /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  /* glsl */ `
    uniform float time;
    uniform vec3 colorA;
    uniform vec3 colorB;
    uniform float opacity;
    uniform float seed;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      float t = time;

      // Diffused aurora: wide, patchy glow (avoid a single hard band).
      vec2 p = vUv;
      p = vec2((p.x - 0.5) * 3.0, (p.y - 0.5) * 2.2);

      float drift = t * 0.04;
      float n = fbm(vec2(p.x * 0.8 + seed * 12.3, p.y * 0.6 - drift));
      float warp = sin((p.y * 1.3) + (t * 0.12) + seed) * 0.16;

      // Vertical curtains (variation across X), but softened by noise so it feels like haze.
      float curtain = sin((p.x * 2.2) + (n * 2.0) + warp + (seed * 4.0) + (t * 0.08));
      curtain = curtain * 0.5 + 0.5;
      curtain = smoothstep(0.28, 0.92, curtain);

      float wash = smoothstep(0.25, 0.95, n);
      float alpha = mix(wash, curtain, 0.55) * opacity;

      float edgeFadeX = smoothstep(0.0, 0.08, vUv.x) * (1.0 - smoothstep(0.92, 1.0, vUv.x));
      float edgeFadeY = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.90, 1.0, vUv.y));
      alpha *= edgeFadeX * edgeFadeY;

      vec3 col = mix(colorA, colorB, n);
      gl_FragColor = vec4(col, alpha);
    }
  `
)

type AuroraCurtainMaterialInstance = THREE.ShaderMaterial & {
  time: number
  colorA: THREE.Color
  colorB: THREE.Color
  opacity: number
  seed: number
}

function Aurora({ accentColor }: { accentColor: string }) {
  const reducedMotion = useReducedMotion()

  const colorA = useMemo(() => new THREE.Color(generateLightVariant(accentColor)), [accentColor])
  const colorB = useMemo(() => new THREE.Color(accentColor), [accentColor])

  const materials = useMemo(() => {
    const create = (seed: number, opacity: number) => {
      const material = new (AuroraCurtainMaterial as unknown as new () => AuroraCurtainMaterialInstance)()
      material.transparent = true
      material.depthWrite = false
      material.blending = THREE.AdditiveBlending
      material.side = THREE.DoubleSide
      material.seed = seed
      material.opacity = opacity
      return material
    }

    // Three layers, offset/tilted in space to feel diffused (not a single strip).
    return [create(0.0, 0.055), create(1.37, 0.04), create(2.91, 0.03)]
  }, [])

  useEffect(() => {
    for (const material of materials) {
      material.colorA = colorA
      material.colorB = colorB
    }
  }, [colorA, colorB, materials])

  useEffect(() => {
    return () => {
      for (const material of materials) material.dispose()
    }
  }, [materials])

  useFrame((_, delta) => {
    if (reducedMotion) return
    const step = delta * 0.4
    for (const material of materials) {
      material.time += step
    }
  })

  return (
    <group>
      <mesh position={[0, 6.5, -46]} rotation={[0.16, 0.28, 0.06]} scale={[140, 80, 1]}>
        <planeGeometry args={[1, 1]} />
        <primitive object={materials[0]} attach="material" />
      </mesh>
      <mesh position={[0, -4.5, -60]} rotation={[0.06, -0.22, -0.04]} scale={[150, 86, 1]}>
        <planeGeometry args={[1, 1]} />
        <primitive object={materials[1]} attach="material" />
      </mesh>
      <mesh position={[10, 1.5, -54]} rotation={[-0.02, 0.62, 0.10]} scale={[130, 74, 1]}>
        <planeGeometry args={[1, 1]} />
        <primitive object={materials[2]} attach="material" />
      </mesh>
    </group>
  )
}

function SpaceField({ accentColor }: { accentColor: string }) {
  const reducedMotion = useReducedMotion()
  const rigRef = useRef<THREE.Group>(null)

  const sparkleColor = useMemo(() => generateLightVariant(accentColor), [accentColor])

  useFrame((state) => {
    if (reducedMotion) return
    if (!rigRef.current) return
    const t = state.clock.elapsedTime
    rigRef.current.rotation.y = t * 0.003
    rigRef.current.rotation.x = Math.sin(t * 0.025) * 0.02
  })

  return (
    <group ref={rigRef}>
      <ambientLight intensity={0.25} />
      <pointLight position={[6, 4, 6]} intensity={0.35} color={sparkleColor} />
      <pointLight position={[-6, -2, 4]} intensity={0.15} color="#ffffff" />

      <Aurora accentColor={accentColor} />

      <NebulaVolume accentColor={accentColor} variant="dashboard" animate={!reducedMotion} />

      <GalaxySprites accentColor={accentColor} variant="dashboard" animate={!reducedMotion} />

      <Stars
        radius={120}
        depth={60}
        count={reducedMotion ? 600 : 1350}
        factor={4}
        saturation={0.2}
        fade
      />

      <StarClusters accentColor={accentColor} variant="dashboard" animate={!reducedMotion} />

      <Sparkles
        count={reducedMotion ? 30 : 90}
        // Keep the drift subtle; avoid occasional fast streaks.
        speed={reducedMotion ? 0 : 0.08}
        opacity={0.55}
        color={sparkleColor}
        size={2.2}
        scale={[18, 10, 10]}
        noise={[0.55, 0.85, 0.55]}
      />

      <NebulaBackdrop accentColor={accentColor} variant="dashboard" animate={!reducedMotion} />
      <ShootingStars accentColor={accentColor} variant="dashboard" animate={!reducedMotion} />
      <FloatingGeometryField accentColor={accentColor} variant="dashboard" animate={!reducedMotion} />
    </group>
  )
}

/**
 * Dashboard-only 3D background.
 * Distinct from the landing KanariCore scene: no orb/rings, just warm starfield + dust.
 */
export function AppSpaceBackground3D() {
  const { accentColor } = useSceneMode()
  const reducedMotion = useReducedMotion()

  const dpr = useMemo(() => [1, 1.5] as [number, number], [])
  const camera = useMemo(() => ({ position: [0, 0, 1] as [number, number, number], fov: 65 }), [])
  const gl = useMemo(() => ({ antialias: true, alpha: true, powerPreference: "high-performance" as const }), [])

  const [isPageVisible, setIsPageVisible] = useState(() => {
    if (typeof document === "undefined") return true
    return document.visibilityState !== "hidden"
  })

  useEffect(() => {
    if (typeof document === "undefined") return

    const onVisibilityChange = () => {
      setIsPageVisible(document.visibilityState !== "hidden")
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [])

  return (
    <Canvas
      dpr={dpr}
      camera={camera}
      gl={gl}
      frameloop={reducedMotion || !isPageVisible ? "demand" : "always"}
    >
      <SpaceField accentColor={accentColor} />
    </Canvas>
  )
}

