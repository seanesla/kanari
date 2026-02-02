"use client"

import { useFrame } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"

const GATHER_DURATION_S = 2.0
const HOLD_DURATION_S = 1.6
const SCATTER_DURATION_S = 1.1

const DRIFT_IN_DURATION_S = 0.5
const DRIFT_STRENGTH = 0.065
const TOTAL_DURATION_MS = Math.round((GATHER_DURATION_S + HOLD_DURATION_S + SCATTER_DURATION_S) * 1000)

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

function easeInCubic(t: number) {
  return t * t * t
}

function sampleTextPoints(text: string) {
  if (typeof document === "undefined") {
    return new Float32Array(0)
  }

  const canvas = document.createElement("canvas")
  const width = 860
  const height = 260
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext("2d")
  if (!ctx) return new Float32Array(0)

  ctx.clearRect(0, 0, width, height)
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  // Best-effort match to app typography. If the font isn't loaded yet,
  // the canvas will fall back gracefully.
  ctx.font = '400 190px "Instrument Serif", Georgia'
  ctx.fillStyle = "#ffffff"
  ctx.fillText(text, width / 2, height / 2 + 8)

  const image = ctx.getImageData(0, 0, width, height)
  const data = image.data

  const candidates: Array<[number, number]> = []
  const step = 3

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4
      const alpha = data[idx + 3] ?? 0
      if (alpha > 90) {
        candidates.push([x, y])
      }
    }
  }

  // Shuffle (Fisher-Yates) then cap to a manageable particle count.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = candidates[i]
    candidates[i] = candidates[j]!
    candidates[j] = tmp!
  }

  const maxPoints = 1100
  const points = candidates.slice(0, maxPoints)

  // Map canvas pixels into world units.
  // Tuned so the word fits nicely at the welcome camera distance.
  const scale = 85
  const out = new Float32Array(points.length * 3)

  for (let i = 0; i < points.length; i++) {
    const [px, py] = points[i]!
    const x = (px - width / 2) / scale
    const y = (height / 2 - py) / scale
    const z = (Math.random() - 0.5) * 0.08

    out[i * 3] = x
    out[i * 3 + 1] = y
    out[i * 3 + 2] = z
  }

  return out
}

function randomRingPosition(zMin: number, zMax: number) {
  const angle = Math.random() * Math.PI * 2
  const radius = 14 + Math.random() * 26
  const x = Math.cos(angle) * radius
  const y = Math.sin(angle) * radius
  const z = THREE.MathUtils.randFloat(zMin, zMax)
  return [x, y, z] as const
}

export function WelcomeParticles({
  accentColor,
  onComplete,
  text = "kanari",
}: {
  accentColor: string
  onComplete?: () => void
  text?: string
}) {
  const startedAt = useRef<number | null>(null)
  const didComplete = useRef(false)
  const onCompleteRef = useRef(onComplete)

  const positionAttr = useRef<THREE.BufferAttribute | null>(null)
  const pointsRef = useRef<THREE.Points | null>(null)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const data = useMemo(() => {
    const targets = sampleTextPoints(text)
    const count = Math.floor(targets.length / 3)

    const start = new Float32Array(count * 3)
    const scatter = new Float32Array(count * 3)
    const seeds = new Float32Array(count)

    const accent = new THREE.Color(accentColor)
    const white = new THREE.Color("#ffffff")
    const colors = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      const [sx, sy, sz] = randomRingPosition(-26, 2.8)
      start[i * 3] = sx
      start[i * 3 + 1] = sy
      start[i * 3 + 2] = sz

      const [ex, ey, ez] = randomRingPosition(-62, -24)
      scatter[i * 3] = ex
      scatter[i * 3 + 1] = ey
      scatter[i * 3 + 2] = ez

      seeds[i] = Math.random() * 1000

      // Heavily accent-tinted: these particles are literally forming the brand word.
      // Keep a little white so it stays crisp on dark backgrounds.
      const tint = 0.08 + Math.random() * 0.22
      const c = accent.clone().lerp(white, tint)
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }

    const positions = start.slice()

    return {
      count,
      targets,
      start,
      scatter,
      positions,
      colors,
      seeds,
    }
  }, [accentColor, text])

  useEffect(() => {
    if (!onComplete) return
    const timer = setTimeout(() => {
      if (didComplete.current) return
      didComplete.current = true
      onCompleteRef.current?.()
    }, TOTAL_DURATION_MS)

    return () => clearTimeout(timer)
  }, [Boolean(onComplete)])

  useEffect(() => {
    if (positionAttr.current?.setUsage) {
      positionAttr.current.setUsage(THREE.DynamicDrawUsage)
    }
  }, [])

  useFrame((state) => {
    if (!positionAttr.current) return

    if (startedAt.current === null) {
      startedAt.current = state.clock.getElapsedTime()
    }

    const elapsed = state.clock.getElapsedTime() - (startedAt.current ?? 0)
    const positions = data.positions

    for (let i = 0; i < data.count; i++) {
      const sx = data.start[i * 3]
      const sy = data.start[i * 3 + 1]
      const sz = data.start[i * 3 + 2]

      const tx = data.targets[i * 3]
      const ty = data.targets[i * 3 + 1]
      const tz = data.targets[i * 3 + 2]

      const seed = data.seeds[i]

      let x = sx
      let y = sy
      let z = sz

      const gatherT = clamp01(elapsed / GATHER_DURATION_S)
      const gatherP = easeOutCubic(gatherT)
      const driftInT = clamp01((elapsed - GATHER_DURATION_S) / DRIFT_IN_DURATION_S)

      if (elapsed < GATHER_DURATION_S) {
        x = THREE.MathUtils.lerp(sx, tx, gatherP)
        y = THREE.MathUtils.lerp(sy, ty, gatherP)
        z = THREE.MathUtils.lerp(sz, tz, gatherP)

        // Swirl is strongest early, then eases out cleanly so the word can settle
        // without a hard "state change".
        const swirl = Math.pow(1 - gatherP, 2) * 0.9
        x += Math.sin(gatherP * 7 + seed) * swirl
        y += Math.cos(gatherP * 7 + seed * 0.9) * swirl
        z += Math.sin(gatherP * 6 + seed * 1.3) * swirl * 0.14
      } else if (elapsed < GATHER_DURATION_S + HOLD_DURATION_S) {
        const drift = DRIFT_STRENGTH * easeInCubic(driftInT)

        // Use global elapsed time so motion stays continuous across phases.
        x = tx + Math.sin(elapsed * 1.3 + seed) * drift
        y = ty + Math.cos(elapsed * 1.1 + seed * 1.1) * drift
        z = tz + Math.sin(elapsed * 0.9 + seed * 0.7) * drift * 0.25
      } else {
        const scatterT = elapsed - (GATHER_DURATION_S + HOLD_DURATION_S)
        const t = clamp01(scatterT / SCATTER_DURATION_S)
        const p = easeInCubic(t)

        const ex = data.scatter[i * 3]
        const ey = data.scatter[i * 3 + 1]
        const ez = data.scatter[i * 3 + 2]

        x = THREE.MathUtils.lerp(tx, ex, p)
        y = THREE.MathUtils.lerp(ty, ey, p)
        z = THREE.MathUtils.lerp(tz, ez, p)

        // Keep a bit of drift at the start of scatter, then fade it out. This avoids
        // a visible snap when switching from "hold" to "exit".
        const driftOut = 1 - easeOutCubic(p)
        const drift = DRIFT_STRENGTH * easeInCubic(driftInT) * driftOut

        x += Math.sin(elapsed * 1.3 + seed) * drift
        y += Math.cos(elapsed * 1.1 + seed * 1.1) * drift
        z += Math.sin(elapsed * 0.9 + seed * 0.7) * drift * 0.25
      }

      // Micro-motion that bridges "gather" -> "hold" smoothly.
      // - Fades in as the word forms.
      // - Fades out as the hold drift ramps in.
      const microBase = 0.012 + (0.5 + 0.5 * Math.sin(seed * 0.13)) * 0.018
      const micro = microBase * gatherP * (1 - driftInT)
      x += Math.sin(elapsed * 3.3 + seed * 0.3) * micro
      y += Math.cos(elapsed * 3.1 + seed * 0.4) * micro
      z += Math.sin(elapsed * 2.7 + seed * 0.2) * micro

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
    }

    positionAttr.current.needsUpdate = true

    if (pointsRef.current?.material) {
      const mat = pointsRef.current.material as THREE.PointsMaterial
      const fadeIn = clamp01(elapsed / 0.35)
      const fadeOutStart = GATHER_DURATION_S + HOLD_DURATION_S + SCATTER_DURATION_S * 0.55
      const fadeOut = 1 - clamp01((elapsed - fadeOutStart) / 0.55)
      mat.opacity = 0.75 * fadeIn * fadeOut
    }
  })

  return (
    <group position={[0, 0, 0]}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            ref={positionAttr}
            attach="attributes-position"
            args={[data.positions, 3]}
          />
          <bufferAttribute attach="attributes-color" args={[data.colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.09}
          transparent
          opacity={0.0}
          vertexColors
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>


    </group>
  )
}
