"use client"

import { useEffect, useMemo, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { Sparkles, Stars, shaderMaterial } from "@react-three/drei"
import * as THREE from "three"
import { useReducedMotion } from "framer-motion"
import { useSceneMode } from "@/lib/scene-context"
import { generateLightVariant } from "@/lib/color-utils"

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

function mulberry32(seed: number) {
  return function rng() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function createNebulaTexture(seed: number): THREE.Texture | null {
  if (typeof document === "undefined") return null

  const size = 256
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  const rand = mulberry32(seed)

  ctx.clearRect(0, 0, size, size)
  ctx.globalCompositeOperation = "source-over"

  // Soft, irregular cloud puffs (blurred) – avoids obvious circular glows.
  ctx.filter = "blur(14px)"
  for (let i = 0; i < 42; i += 1) {
    const x = size * (0.22 + rand() * 0.56)
    const y = size * (0.22 + rand() * 0.56)
    const r = size * (0.08 + rand() * 0.22)
    const a = 0.06 + rand() * 0.11
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(255,255,255,${a})`)
    g.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.filter = "none"

  // Fade the texture edges so it reads like a mist patch, not a disc.
  ctx.globalCompositeOperation = "destination-in"
  const edgeFade = ctx.createRadialGradient(size * 0.5, size * 0.5, 0, size * 0.5, size * 0.5, size * 0.52)
  edgeFade.addColorStop(0, "rgba(255,255,255,1)")
  edgeFade.addColorStop(0.7, "rgba(255,255,255,0.85)")
  edgeFade.addColorStop(1, "rgba(255,255,255,0)")
  ctx.fillStyle = edgeFade
  ctx.fillRect(0, 0, size, size)
  ctx.globalCompositeOperation = "source-over"

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return texture
}

function Nebula({ color }: { color: string }) {
  const groupRef = useRef<THREE.Group>(null)
  const reducedMotion = useReducedMotion()

  const textures = useMemo(() => {
    return [createNebulaTexture(1), createNebulaTexture(2)].filter(
      (t): t is THREE.Texture => Boolean(t)
    )
  }, [])

  useFrame((state) => {
    if (reducedMotion) return
    if (!groupRef.current) return
    const t = state.clock.elapsedTime
    groupRef.current.rotation.y = t * 0.004
    groupRef.current.rotation.x = Math.sin(t * 0.03) * 0.02
  })

  // A few textured mist patches to create depth without obvious "giant circles".
  return (
    <group ref={groupRef}>
      {textures[0] ? (
        <mesh position={[7.5, 2.5, -22]} rotation={[0.2, -0.5, 0.15]} scale={[22, 12, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={textures[0]}
            color={color}
            transparent
            opacity={0.038}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ) : null}
      {textures[1] ? (
        <mesh position={[-8, -3.5, -26]} rotation={[-0.1, 0.8, -0.08]} scale={[24, 14, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={textures[1]}
            color={color}
            transparent
            opacity={0.03}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ) : null}
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

      <Stars
        radius={120}
        depth={60}
        count={reducedMotion ? 600 : 1400}
        factor={4}
        saturation={0.2}
        fade
      />

      <Sparkles
        count={reducedMotion ? 30 : 110}
        // Keep the drift subtle; avoid occasional fast streaks.
        speed={reducedMotion ? 0 : 0.08}
        opacity={0.55}
        color={sparkleColor}
        size={2.2}
        scale={[18, 10, 10]}
        noise={[0.55, 0.85, 0.55]}
      />

      <Nebula color={sparkleColor} />
    </group>
  )
}

/**
 * Dashboard-only 3D background.
 * Distinct from the landing KanariCore scene: no orb/rings, just warm starfield + dust.
 */
export function AppSpaceBackground() {
  const { accentColor } = useSceneMode()
  const reducedMotion = useReducedMotion()

  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 1], fov: 65 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        frameloop={reducedMotion ? "demand" : "always"}
      >
        <SpaceField accentColor={accentColor} />
      </Canvas>

      {/* Soft vignette for readability (CSS, not glass). */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 800px at 50% 20%, transparent 0%, rgba(0,0,0,0.18) 55%, rgba(0,0,0,0.46) 100%)",
        }}
      />
    </div>
  )
}
