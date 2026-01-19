"use client"

/**
 * Space Background for Onboarding
 *
 * Ethereal, performance-conscious WebGL background elements reused by:
 * - Onboarding 3D scene (desktop)
 * - Onboarding 2D fallback (mobile)
 *
 * Goals:
 * - Feel alive (twinkle + slow drift) without being distracting
 * - Blend in the user's accent color subtly (never neon/confetti)
 * - Stay smooth on low/mid-end devices
 *
 * Source: Context7 - /pmndrs/drei docs - "Sparkles", "Float"
 */

import { useEffect, useMemo, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { AdaptiveDpr, Float, Sparkles } from "@react-three/drei"
import * as THREE from "three"
import { useSceneMode } from "@/lib/scene-context"
import { SCENE_COLORS } from "@/lib/constants"

type QualityTier = "low" | "medium" | "high"

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

function getQualityTier(): QualityTier {
  if (typeof window === "undefined") return "high"

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
  if (reduceMotion) return "low"

  const cores = navigator.hardwareConcurrency ?? 6
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8

  // Keep low-end devices stable, but don't over-downshift. We still want the
  // background to be visible and expressive.
  if (cores <= 2 || memory <= 2) return "medium"
  return "high"
}

function createSoftDiscTexture() {
  if (typeof document === "undefined") return null

  const size = 96
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  const center = size / 2
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center)
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)")
  gradient.addColorStop(0.18, "rgba(255, 255, 255, 0.75)")
  gradient.addColorStop(0.45, "rgba(255, 255, 255, 0.18)")
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)")

  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  return texture
}

function createNebulaTexture() {
  if (typeof document === "undefined") return null

  const size = 640
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  ctx.clearRect(0, 0, size, size)
  ctx.globalCompositeOperation = "lighter"

  // Big soft blobs (keep alphas low; we also use additive blending later)
  for (let i = 0; i < 28; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = size * (0.09 + Math.random() * 0.25)
    const a = 0.06 + Math.random() * 0.14

    ctx.filter = `blur(${Math.round(size * (0.018 + Math.random() * 0.03))}px)`
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(255, 255, 255, ${a})`)
    g.addColorStop(1, "rgba(255, 255, 255, 0)")
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Filament streaks (subtle structure)
  for (let i = 0; i < 16; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const w = size * (0.25 + Math.random() * 0.55)
    const h = size * (0.06 + Math.random() * 0.14)
    const a = 0.035 + Math.random() * 0.08
    const rot = Math.random() * Math.PI * 2

    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rot)
    ctx.filter = `blur(${Math.round(size * 0.014)}px)`

    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.5)
    g.addColorStop(0, `rgba(255, 255, 255, ${a})`)
    g.addColorStop(1, "rgba(255, 255, 255, 0)")
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(0, 0, w * 0.5, h * 0.5, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  ctx.filter = "none"

  // Fade edges so sprites never show hard borders.
  ctx.globalCompositeOperation = "destination-in"
  const center = size / 2
  const mask = ctx.createRadialGradient(center, center, size * 0.08, center, center, size * 0.54)
  mask.addColorStop(0, "rgba(255, 255, 255, 1)")
  mask.addColorStop(1, "rgba(255, 255, 255, 0)")
  ctx.fillStyle = mask
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  return texture
}

interface TwinklingStarPointsProps {
  count: number
  size: number
  opacity: number
  radius: [number, number]
  zRange: [number, number]
  accentColor: string
  discTexture: THREE.Texture | null
  animate: boolean
  updateStride: number
}

function TwinklingStarPoints({
  count,
  size,
  opacity,
  radius,
  zRange,
  accentColor,
  discTexture,
  animate,
  updateStride,
}: TwinklingStarPointsProps) {
  const colorAttrRef = useRef<THREE.BufferAttribute | null>(null)
  const groupRef = useRef<THREE.Group | null>(null)
  const frameCounter = useRef(0)

  const data = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const baseColors = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)

    const baseBrightness = new Float32Array(count)
    const twinkleAmp = new Float32Array(count)

    const freq1 = new Float32Array(count)
    const freq2 = new Float32Array(count)
    const freq3 = new Float32Array(count)

    const phase1 = new Float32Array(count)
    const phase2 = new Float32Array(count)
    const phase3 = new Float32Array(count)

    const glintFreq = new Float32Array(count)
    const glintPhase = new Float32Array(count)
    const glintStrength = new Float32Array(count)

    const [radiusMin, radiusMax] = radius
    const [zMin, zMax] = zRange

    const white = new THREE.Color("#ffffff")
    const warm = new THREE.Color("#fff6e9")
    const cool = new THREE.Color("#eaf3ff")

    const accent = new THREE.Color(accentColor)
    const accentStar = accent.clone().lerp(white, 0.78)

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const r = radiusMin + Math.random() * (radiusMax - radiusMin)

      const x = Math.cos(angle) * r
      const y = Math.sin(angle) * r
      const z = THREE.MathUtils.randFloat(zMin, zMax)

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z

      // Base star color palette: mostly white with subtle temperature + rare accent tint.
      const paletteRoll = Math.random()
      let c = white
      if (paletteRoll < 0.08) c = accentStar
      else if (paletteRoll < 0.24) c = warm
      else if (paletteRoll < 0.40) c = cool

      baseColors[i * 3] = c.r
      baseColors[i * 3 + 1] = c.g
      baseColors[i * 3 + 2] = c.b

      const distNorm = (r - radiusMin) / Math.max(0.0001, radiusMax - radiusMin)
      const zNorm = (zMax - z) / Math.max(0.0001, zMax - zMin)

      // Dim far stars a bit so the scene reads as deep (not flat noise).
      // Keep the overall floor higher so the effect reads even on dim displays.
      const brightness =
        (0.55 + Math.random() * 0.75) *
        THREE.MathUtils.lerp(0.98, 0.72, distNorm) *
        THREE.MathUtils.lerp(1.0, 0.82, zNorm)
      baseBrightness[i] = brightness

      // Higher-brightness stars twinkle a bit more.
      // Increase amplitude so it's visible without feeling like "blinking".
      twinkleAmp[i] = (0.14 + Math.random() * 0.34) * (0.55 + brightness * 0.45)

      // Slow, layered twinkle.
      freq1[i] = 0.35 + Math.random() * 1.35
      freq2[i] = 0.16 + Math.random() * 0.9
      freq3[i] = 0.08 + Math.random() * 0.55

      phase1[i] = Math.random() * Math.PI * 2
      phase2[i] = Math.random() * Math.PI * 2
      phase3[i] = Math.random() * Math.PI * 2

      // Rare, soft glints (kept subtle to avoid "cheap sparkle" vibes).
      // Slightly more common/strong so it reads, still not disco.
      if (Math.random() < 0.10) {
        glintFreq[i] = 0.10 + Math.random() * 0.24
        glintPhase[i] = Math.random() * Math.PI * 2
        glintStrength[i] = 0.18 + Math.random() * 0.36
      } else {
        glintFreq[i] = 0
        glintPhase[i] = 0
        glintStrength[i] = 0
      }

      colors[i * 3] = baseColors[i * 3] * brightness
      colors[i * 3 + 1] = baseColors[i * 3 + 1] * brightness
      colors[i * 3 + 2] = baseColors[i * 3 + 2] * brightness
    }

    return {
      positions,
      baseColors,
      colors,
      baseBrightness,
      twinkleAmp,
      freq1,
      freq2,
      freq3,
      phase1,
      phase2,
      phase3,
      glintFreq,
      glintPhase,
      glintStrength,
    }
  }, [count, radius, zRange, accentColor])

  useEffect(() => {
    if (!colorAttrRef.current) return
    colorAttrRef.current.setUsage(THREE.DynamicDrawUsage)
  }, [])

  useFrame((state) => {
    if (!animate) return

    frameCounter.current += 1
    if (updateStride > 1 && frameCounter.current % updateStride !== 0) return

    if (!colorAttrRef.current) return

    const t = state.clock.elapsedTime
    const colors = data.colors

    for (let i = 0; i < count; i++) {
      const idx = i * 3

      const wave =
        Math.sin(t * data.freq1[i] + data.phase1[i]) * 0.55 +
        Math.sin(t * data.freq2[i] + data.phase2[i]) * 0.3 +
        Math.sin(t * data.freq3[i] + data.phase3[i]) * 0.15

      let twinkle = 1 + wave * data.twinkleAmp[i]

      if (data.glintStrength[i] > 0) {
        const g = 0.5 + 0.5 * Math.sin(t * data.glintFreq[i] + data.glintPhase[i])
        // Sharpen the peak, but keep intensity controlled.
        twinkle += Math.pow(g, 6) * data.glintStrength[i]
      }

      const brightness = data.baseBrightness[i] * twinkle

      colors[idx] = data.baseColors[idx] * brightness
      colors[idx + 1] = data.baseColors[idx + 1] * brightness
      colors[idx + 2] = data.baseColors[idx + 2] * brightness
    }

    colorAttrRef.current.needsUpdate = true

    // Almost imperceptible drift so the starfield never feels like a static wallpaper.
    if (groupRef.current) {
      groupRef.current.rotation.z = t * 0.002
    }
  })

  return (
    <group ref={groupRef}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
          <bufferAttribute
            ref={colorAttrRef}
            attach="attributes-color"
            args={[data.colors, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={size}
          vertexColors
          transparent
          opacity={opacity}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          map={discTexture ?? undefined}
          alphaTest={0.001}
          sizeAttenuation
        />
      </points>
    </group>
  )
}

/**
 * Starfield - distant twinkling stars spanning the entire onboarding journey.
 *
 * Camera travels from Z=0 to Z=-56, so stars span Z=+10 to Z=-70.
 */
export function Starfield() {
  const { accentColor } = useSceneMode()
  const quality = useMemo(() => getQualityTier(), [])
  const discTexture = useMemo(() => createSoftDiscTexture(), [])

  useEffect(() => {
    if (!discTexture) return
    return () => discTexture.dispose()
  }, [discTexture])

  const animate = quality !== "low"
  const updateStride = quality === "high" ? 1 : 2

  const smallCount = quality === "high" ? 1500 : quality === "medium" ? 1100 : 800
  const largeCount = quality === "high" ? 340 : quality === "medium" ? 240 : 180

  return (
    <group>
      <TwinklingStarPoints
        count={smallCount}
        size={0.075}
        opacity={0.72}
        radius={[14, 52]}
        zRange={[-70, 10]}
        accentColor={accentColor}
        discTexture={discTexture}
        animate={animate}
        updateStride={updateStride}
      />
      <TwinklingStarPoints
        count={largeCount}
        size={0.13}
        opacity={0.60}
        radius={[10, 36]}
        zRange={[-68, 6]}
        accentColor={accentColor}
        discTexture={discTexture}
        animate={animate}
        updateStride={updateStride}
      />
    </group>
  )
}

/**
 * AccentNebula - soft, drifting particles in the user's accent color.
 *
 * Extended to span the entire onboarding journey (Z=+10 to Z=-70).
 */
export function AccentNebula({ accentColor }: { accentColor: string }) {
  const quality = useMemo(() => getQualityTier(), [])
  const animate = quality !== "low"

  const nebulaTexture = useMemo(() => createNebulaTexture(), [])
  useEffect(() => {
    if (!nebulaTexture) return
    return () => nebulaTexture.dispose()
  }, [nebulaTexture])

  const counts = {
    // Sparkle layer: visible particles (accent-tinted dust)
    sparklesA: quality === "high" ? 190 : quality === "medium" ? 150 : 110,
    sparklesB: quality === "high" ? 120 : quality === "medium" ? 90 : 65,

    // Sprite layer: the actual "gas cloud" feeling
    // Higher count + lower alpha spreads it around, especially at distance.
    sprites: quality === "high" ? 26 : quality === "medium" ? 20 : 14,
  }

  const colors = useMemo(() => {
    const accent = new THREE.Color(accentColor)
    const white = new THREE.Color("#ffffff")

    // Match accent, but keep it muted because additive blending stacks fast.
    // This should read as soft gas, not a light source.
    const soft = accent.clone().lerp(white, 0.35).multiplyScalar(0.42)
    const pale = accent.clone().lerp(white, 0.55).multiplyScalar(0.52)

    return { soft, pale }
  }, [accentColor])

  const spriteData = useMemo(() => {
    const positions = new Float32Array(counts.sprites * 3)
    const scalesX = new Float32Array(counts.sprites)
    const scalesY = new Float32Array(counts.sprites)
    const rotations = new Float32Array(counts.sprites)
    const opacities = new Float32Array(counts.sprites)
    const phases = new Float32Array(counts.sprites)

    const zMin = -70
    const zMax = 14

    for (let i = 0; i < counts.sprites; i++) {
      const z = THREE.MathUtils.randFloat(zMin, zMax)
      const u = (z - zMin) / Math.max(0.0001, zMax - zMin) // 0..1

      // Two lopsided spines (near + far) so the nebula feels like it continues into distance.
      const farBlend = u < 0.45 ? 0 : Math.min(1, (u - 0.45) / 0.55)

      // Near spine
      const xA = THREE.MathUtils.lerp(-11, 7.5, u) + Math.sin(u * 5.1) * 3.4
      const yA = THREE.MathUtils.lerp(5.5, -4.8, u) + Math.cos(u * 4.6) * 2.8

      // Far spine (shifted + wider)
      const xB = THREE.MathUtils.lerp(8, -14, u) + Math.sin(u * 3.2 + 1.1) * 4.8
      const yB = THREE.MathUtils.lerp(-7, 6, u) + Math.cos(u * 3.7 - 0.6) * 3.9

      const xCenter = THREE.MathUtils.lerp(xA, xB, farBlend)
      const yCenter = THREE.MathUtils.lerp(yA, yB, farBlend)

      // Wider in the far corridor so it doesn't feel concentrated.
      const spreadX = THREE.MathUtils.lerp(4.6, 9.5, u) + Math.random() * 2.5
      const spreadY = THREE.MathUtils.lerp(4.0, 8.5, u) + Math.random() * 2.2

      positions[i * 3] = xCenter + THREE.MathUtils.randFloatSpread(spreadX)
      positions[i * 3 + 1] = yCenter + THREE.MathUtils.randFloatSpread(spreadY)
      positions[i * 3 + 2] = z

      // Non-uniform scale + rotation breaks the "perfect circle" look.
      const base = THREE.MathUtils.lerp(16, 34, u) * (0.75 + Math.random() * 0.7)
      const ax = 0.65 + Math.random() * 1.25
      const ay = 0.55 + Math.random() * 1.4

      scalesX[i] = base * ax
      scalesY[i] = base * ay
      rotations[i] = THREE.MathUtils.randFloat(-Math.PI, Math.PI)

      // Distant clouds should be present but dim.
      const distanceFade = 1 - u * 0.55
      const density = 0.55 + 0.35 * Math.sin(u * Math.PI)
      opacities[i] = (0.028 + Math.random() * 0.05) * density * distanceFade

      phases[i] = Math.random() * Math.PI * 2
    }

    return { positions, scalesX, scalesY, rotations, opacities, phases }
  }, [counts.sprites])

  const spriteGroupRef = useRef<THREE.Group | null>(null)

  useFrame((state) => {
    if (!animate) return
    if (!spriteGroupRef.current) return

    const t = state.clock.elapsedTime

    // Slow, subtle planar drift (x/y only) so it feels like gas.
    // Avoid sin/cos at matching rates (it reads as a circular orbit).
    spriteGroupRef.current.rotation.z = Math.sin(t * 0.043) * 0.018
    spriteGroupRef.current.rotation.x = Math.cos(t * 0.031) * 0.01
    spriteGroupRef.current.position.x = Math.sin(t * 0.06) * 0.55 + Math.sin(t * 0.083) * 0.22
    spriteGroupRef.current.position.y = Math.cos(t * 0.055) * 0.42 + Math.sin(t * 0.071) * 0.18

    spriteGroupRef.current.updateMatrix()
  })

  return (
    <group position={[0, 0, -28]}>
      {/* Gas cloud sprites (this is the "nebula") */}
      <group ref={spriteGroupRef} matrixAutoUpdate={false}>
        {Array.from({ length: counts.sprites }).map((_, i) => (
            <sprite
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              position={[
                spriteData.positions[i * 3],
                spriteData.positions[i * 3 + 1],
                spriteData.positions[i * 3 + 2],
              ]}
              rotation={[0, 0, spriteData.rotations[i]]}
              scale={[spriteData.scalesX[i], spriteData.scalesY[i], 1]}
            >
              <spriteMaterial
                map={nebulaTexture ?? undefined}
                transparent
                depthWrite={false}
                depthTest
                blending={THREE.AdditiveBlending}
                color={colors.soft}
                opacity={spriteData.opacities[i]}
                fog={false}
                toneMapped={false}
              />
          </sprite>
        ))}
      </group>

      {/* Accent dust that helps sell depth */}
      <Sparkles
        count={counts.sparklesA}
        speed={animate ? 0.34 : 0}
        opacity={0.55}
        color={accentColor}
        size={3.0}
        scale={[22, 22, 78]}
        noise={[0.65, 0.55, 0.45]}
      />

      <Sparkles
        count={counts.sparklesB}
        speed={animate ? 0.22 : 0}
        opacity={0.32}
        color={colors.pale}
        size={5.1}
        scale={[30, 30, 88]}
        noise={[0.35, 0.28, 0.32]}
      />
    </group>
  )
}

export function ShootingStars({ accentColor }: { accentColor: string }) {
  const quality = useMemo(() => getQualityTier(), [])
  const reduceMotion = quality === "low"

  // Allocate a few more particles on higher tiers for a nicer streak.
  const trailPoints = quality === "high" ? 32 : quality === "medium" ? 28 : 24

  const pointsRef = useRef<THREE.Points | null>(null)
  const positionAttrRef = useRef<THREE.BufferAttribute | null>(null)
  const materialRef = useRef<THREE.PointsMaterial | null>(null)

  const stateRef = useRef({
    isActive: false,
    startedAt: 0,
    duration: 1,
    trailPoints,
    maxTrailLength: 9,
    start: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    travelDistance: 26,
    nextSpawnAt: 0,
  })

  const discTexture = useMemo(() => createSoftDiscTexture(), [])

  useEffect(() => {
    if (!discTexture) return
    return () => discTexture.dispose()
  }, [discTexture])

  const data = useMemo(() => {
    const trailPoints = stateRef.current.trailPoints
    const positions = new Float32Array(trailPoints * 3)
    const colors = new Float32Array(trailPoints * 3)

    const white = new THREE.Color("#ffffff")
    const accent = new THREE.Color(accentColor)
    const accentBright = accent.clone().lerp(white, 0.45)

    for (let i = 0; i < trailPoints; i++) {
      const t = i / Math.max(1, trailPoints - 1)
      const brightness = Math.pow(1 - t, 2.1) * 1.2
      const c = white.clone().lerp(accentBright, t)

      colors[i * 3] = c.r * brightness
      colors[i * 3 + 1] = c.g * brightness
      colors[i * 3 + 2] = c.b * brightness
    }

    return { positions, colors }
  }, [accentColor])

  useEffect(() => {
    if (positionAttrRef.current) {
      positionAttrRef.current.setUsage(THREE.DynamicDrawUsage)
    }

    if (materialRef.current) {
      materialRef.current.opacity = 0
    }
  }, [])

  function scheduleNextSpawn(now: number) {
    const base = quality === "high" ? 4.0 : 5.5
    const jitter = quality === "high" ? 4.5 : 6.0
    stateRef.current.nextSpawnAt = now + base + Math.random() * jitter
  }

  function startStar(now: number) {
    const s = stateRef.current

    s.isActive = true
    s.startedAt = now
    s.duration = 0.9 + Math.random() * 0.55
    s.travelDistance = 22 + Math.random() * 18

    // Spawn in a wide ring around the camera path, then travel diagonally across.
    const angle = Math.random() * Math.PI * 2
    const ringRadius = 18 + Math.random() * 26
    const z = THREE.MathUtils.randFloat(-62, -6)

    s.start.set(Math.cos(angle) * ringRadius, Math.sin(angle) * ringRadius, z)

    // Direction: mostly across the screen (XY), slight Z drift.
    const dirAngle = angle + Math.PI + THREE.MathUtils.randFloat(-0.9, 0.9)
    s.dir.set(Math.cos(dirAngle), Math.sin(dirAngle), THREE.MathUtils.randFloat(-0.18, 0.18)).normalize()

    // Tail length and density (keep small on lower tiers).
    s.maxTrailLength = quality === "high" ? 10 : 8
  }

  useFrame((fiberState) => {
    if (reduceMotion) return

    if (!materialRef.current || !positionAttrRef.current) return

    const now = fiberState.clock.getElapsedTime()
    const s = stateRef.current

    if (!s.nextSpawnAt) scheduleNextSpawn(now)

    if (!s.isActive && now >= s.nextSpawnAt) {
      startStar(now)
    }

    if (!s.isActive) {
      materialRef.current.opacity = 0
      return
    }

    const t = clamp01((now - s.startedAt) / s.duration)
    const p = easeOutCubic(t)

    const fadeIn = clamp01(t / 0.12)
    const fadeOut = 1 - clamp01((t - 0.72) / 0.28)
    const fade = fadeIn * fadeOut

    // Tail grows in quickly so it feels like a streak instead of a moving dot.
    const tailGrow = clamp01(t / 0.18)
    const tailLength = s.maxTrailLength * tailGrow
    const spacing = tailLength / Math.max(1, s.trailPoints - 1)

    const head = new THREE.Vector3().copy(s.start).addScaledVector(s.dir, s.travelDistance * p)

    for (let i = 0; i < s.trailPoints; i++) {
      const pos = new THREE.Vector3().copy(head).addScaledVector(s.dir, -i * spacing)
      const idx = i * 3
      data.positions[idx] = pos.x
      data.positions[idx + 1] = pos.y
      data.positions[idx + 2] = pos.z
    }

    positionAttrRef.current.needsUpdate = true
    materialRef.current.opacity = 0.9 * fade

    if (t >= 1) {
      s.isActive = false
      scheduleNextSpawn(now)
    }
  })

  if (reduceMotion) return null

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          ref={positionAttrRef}
          attach="attributes-position"
          args={[data.positions, 3]}
        />
        <bufferAttribute attach="attributes-color" args={[data.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={materialRef}
        size={0.24}
        vertexColors
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        map={discTexture ?? undefined}
        alphaTest={0.001}
        sizeAttenuation
      />
    </points>
  )
}

/**
 * FloatingGeometry - distant geometric shapes that drift gently.
 */
export function FloatingGeometry({ accentColor }: { accentColor: string }) {
  const shapes = useMemo(
    () => [
      { pos: [-10, 5, -5] as [number, number, number], scale: 0.35, type: "octahedron" },
      { pos: [12, -3, -8] as [number, number, number], scale: 0.3, type: "icosahedron" },
      { pos: [-8, -6, -18] as [number, number, number], scale: 0.4, type: "tetrahedron" },
      { pos: [10, 7, -22] as [number, number, number], scale: 0.25, type: "dodecahedron" },
      { pos: [-12, 4, -32] as [number, number, number], scale: 0.35, type: "octahedron" },
      { pos: [14, -5, -35] as [number, number, number], scale: 0.3, type: "icosahedron" },
      { pos: [-9, -7, -46] as [number, number, number], scale: 0.4, type: "tetrahedron" },
      { pos: [11, 6, -50] as [number, number, number], scale: 0.25, type: "dodecahedron" },
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
          speed={0.42}
          rotationIntensity={0.15}
          floatIntensity={0.33}
        >
          <mesh scale={shape.scale}>
            {shape.type === "octahedron" && <octahedronGeometry args={[1, 0]} />}
            {shape.type === "icosahedron" && <icosahedronGeometry args={[1, 0]} />}
            {shape.type === "tetrahedron" && <tetrahedronGeometry args={[1, 0]} />}
            {shape.type === "dodecahedron" && <dodecahedronGeometry args={[1, 0]} />}
            <meshStandardMaterial
              color={accentColor}
              emissive={accentColor}
              emissiveIntensity={0.55}
              metalness={0.82}
              roughness={0.18}
              transparent
              opacity={0.55}
              wireframe={i % 2 === 0}
            />
          </mesh>
        </Float>
      ))}
    </>
  )
}

function OnboardingScene() {
  const { accentColor } = useSceneMode()

  return (
    <>
      <ambientLight intensity={0.15} />
      <pointLight position={[10, 10, 10]} intensity={0.33} color={accentColor} />

      <Starfield />
      <AccentNebula accentColor={accentColor} />
      <ShootingStars accentColor={accentColor} />
      <FloatingGeometry accentColor={accentColor} />
    </>
  )
}

export function FloatingOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <AdaptiveDpr />
        <color attach="background" args={[SCENE_COLORS.background]} />
        <OnboardingScene />
      </Canvas>
    </div>
  )
}
