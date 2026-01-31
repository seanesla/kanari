"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import { Float } from "@react-three/drei"
import * as THREE from "three"

export type SpaceVariant = "landing" | "dashboard"

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function mulberry32(seed: number) {
  return function rng() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randNorm(rand: () => number) {
  // Box-Muller transform.
  let u = 0
  let v = 0
  while (u === 0) u = rand()
  while (v === 0) v = rand()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function useDisposableTexture<T extends THREE.Texture | null>(factory: () => T, deps: unknown[]) {
  const texture = useMemo(factory, deps)

  useEffect(() => {
    if (!texture) return
    return () => texture.dispose()
  }, [texture])

  return texture
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
  gradient.addColorStop(0.16, "rgba(255, 255, 255, 0.75)")
  gradient.addColorStop(0.42, "rgba(255, 255, 255, 0.18)")
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

function createNebulaTexture(seed: number, size = 512) {
  if (typeof document === "undefined") return null

  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  const rand = mulberry32(seed)

  ctx.clearRect(0, 0, size, size)
  ctx.globalCompositeOperation = "lighter"

  // Soft cloud mass.
  for (let i = 0; i < 34; i += 1) {
    const x = size * (0.12 + rand() * 0.76)
    const y = size * (0.12 + rand() * 0.76)
    const r = size * (0.10 + rand() * 0.24)
    const a = 0.045 + rand() * 0.11

    ctx.filter = `blur(${Math.round(size * (0.016 + rand() * 0.022))}px)`
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(255, 255, 255, ${a})`)
    g.addColorStop(1, "rgba(255, 255, 255, 0)")
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Filament streaks (subtle structure).
  // Paint as a chain of soft dabs so it reads as wispy gas (not obvious stretched ovals).
  for (let i = 0; i < 14; i += 1) {
    const x = size * (0.10 + rand() * 0.80)
    const y = size * (0.10 + rand() * 0.80)
    const w = size * (0.22 + rand() * 0.58)
    const h = size * (0.05 + rand() * 0.14)
    const a = 0.016 + rand() * 0.05
    const rot = rand() * Math.PI * 2
    const steps = 10 + Math.floor(rand() * 10)

    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rot)

    for (let s = 0; s < steps; s += 1) {
      const t = steps <= 1 ? 0 : s / (steps - 1)
      const px = (t - 0.5) * w + (rand() - 0.5) * w * 0.08
      const py = (rand() - 0.5) * h * 0.9 + Math.sin(t * Math.PI) * h * 0.22
      const r = h * (0.35 + rand() * 0.9)
      const aa = a * (0.55 + 0.45 * Math.sin(t * Math.PI))

      ctx.filter = `blur(${Math.round(size * 0.012)}px)`
      const g = ctx.createRadialGradient(px, py, 0, px, py, r * 1.8)
      g.addColorStop(0, `rgba(255, 255, 255, ${aa})`)
      g.addColorStop(1, "rgba(255, 255, 255, 0)")
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(px, py, r * 1.8, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }

  ctx.filter = "none"

  // Fade edges so sprites never show hard borders.
  ctx.globalCompositeOperation = "destination-in"
  const center = size / 2
  const mask = ctx.createRadialGradient(center, center, size * 0.08, center, center, size * 0.56)
  mask.addColorStop(0, "rgba(255, 255, 255, 1)")
  mask.addColorStop(1, "rgba(255, 255, 255, 0)")
  ctx.fillStyle = mask
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  return texture
}

function createNebulaVolumeTexture(seed: number, size = 512) {
  if (typeof document === "undefined") return null

  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  const rand = mulberry32(seed)

  ctx.clearRect(0, 0, size, size)
  ctx.globalCompositeOperation = "source-over"

  // Very soft, low-frequency cloud mass.
  // Avoid filament/detail passes here: this texture is meant to stay smooth
  // when layered and blended (no "TV static" look).
  for (let i = 0; i < 18; i += 1) {
    const x = size * (0.18 + rand() * 0.64)
    const y = size * (0.18 + rand() * 0.64)
    const r = size * (0.16 + rand() * 0.34)
    const a = 0.05 + rand() * 0.12
    const blur = size * (0.02 + rand() * 0.045)

    ctx.filter = `blur(${Math.max(1, Math.round(blur))}px)`
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(255, 255, 255, ${a})`)
    g.addColorStop(1, "rgba(255, 255, 255, 0)")
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.filter = "none"

  // Fade edges so sprites never show hard borders.
  ctx.globalCompositeOperation = "destination-in"
  const center = size / 2
  const mask = ctx.createRadialGradient(center, center, size * 0.12, center, center, size * 0.56)
  mask.addColorStop(0, "rgba(255, 255, 255, 1)")
  mask.addColorStop(1, "rgba(255, 255, 255, 0)")
  ctx.fillStyle = mask
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  // This texture stays intentionally smooth; mipmaps are rarely needed here and
  // can cause a noticeable hitch when generated/uploaded.
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  return texture
}

type TextureCacheEntry = {
  texture: THREE.Texture
  refs: number
}

const NEBULA_VOLUME_TEX_CACHE_KEY = "__kanari_nebula_volume_tex_key"
const nebulaVolumeTextureCache = new Map<string, TextureCacheEntry>()

function retainNebulaVolumeTexture(seed: number, size = 512) {
  const key = `${seed}:${size}`
  const cached = nebulaVolumeTextureCache.get(key)
  if (cached) {
    cached.refs += 1
    return cached.texture
  }

  const created = createNebulaVolumeTexture(seed, size)
  if (!created) return null
  ;(created.userData as Record<string, unknown>)[NEBULA_VOLUME_TEX_CACHE_KEY] = key
  nebulaVolumeTextureCache.set(key, { texture: created, refs: 1 })
  return created
}

function releaseNebulaVolumeTexture(texture: THREE.Texture | null) {
  if (!texture) return
  const key = (texture.userData as Record<string, unknown>)[NEBULA_VOLUME_TEX_CACHE_KEY]
  if (typeof key !== "string") {
    texture.dispose()
    return
  }

  const cached = nebulaVolumeTextureCache.get(key)
  if (!cached || cached.texture !== texture) {
    texture.dispose()
    return
  }

  cached.refs -= 1
  if (cached.refs <= 0) {
    cached.texture.dispose()
    nebulaVolumeTextureCache.delete(key)
  }
}

function createDustLaneTexture(seed: number, size = 512) {
  if (typeof document === "undefined") return null

  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  const ctx2: CanvasRenderingContext2D = ctx

  const rand = mulberry32(seed)

  ctx2.clearRect(0, 0, size, size)
  ctx2.globalCompositeOperation = "lighter"

  function dab(x: number, y: number, radius: number, alpha: number, blurPx: number) {
    ctx2.filter = `blur(${Math.max(1, Math.round(blurPx))}px)`
    const g = ctx2.createRadialGradient(x, y, 0, x, y, radius)
    g.addColorStop(0, `rgba(255, 255, 255, ${alpha})`)
    g.addColorStop(1, "rgba(255, 255, 255, 0)")
    ctx2.fillStyle = g
    ctx2.beginPath()
    ctx2.arc(x, y, radius, 0, Math.PI * 2)
    ctx2.fill()
  }

  // Chunky absorption pockets (broken up and lower contrast).
  for (let i = 0; i < 11; i += 1) {
    const x = size * (0.14 + rand() * 0.72)
    const y = size * (0.14 + rand() * 0.72)
    const r = size * (0.10 + rand() * 0.18)
    const a = 0.12 + rand() * 0.2
    dab(x, y, r, a, size * (0.016 + rand() * 0.02))
  }

  // Dust lanes: paint them as a chain of soft dabs along a curve.
  // This avoids the "perfect stretched ellipse" look.
  const laneCount = 7
  for (let i = 0; i < laneCount; i += 1) {
    const startX = size * (0.12 + rand() * 0.76)
    const startY = size * (0.12 + rand() * 0.76)
    const angle = (rand() - 0.5) * Math.PI * 1.1
    const length = size * (0.32 + rand() * 0.46)
    const steps = 16 + Math.floor(rand() * 10)

    const dx = (Math.cos(angle) * length) / steps
    const dy = (Math.sin(angle) * length) / steps

    for (let s = 0; s < steps; s += 1) {
      const t = steps <= 1 ? 0 : s / (steps - 1)
      const bend = Math.sin(t * Math.PI) * (rand() - 0.5) * size * 0.05
      const px = startX + dx * s + Math.cos(angle + Math.PI / 2) * bend + (rand() - 0.5) * size * 0.018
      const py = startY + dy * s + Math.sin(angle + Math.PI / 2) * bend + (rand() - 0.5) * size * 0.018

      const r = size * (0.032 + rand() * 0.058) * (0.7 + 0.6 * Math.sin(t * Math.PI))
      const a = (0.055 + rand() * 0.12) * (0.55 + 0.45 * Math.sin(t * Math.PI))
      dab(px, py, r, a, size * 0.012)
    }
  }

  ctx2.filter = "none"

  // Edge fade.
  ctx2.globalCompositeOperation = "destination-in"
  const center = size / 2
  const mask = ctx2.createRadialGradient(center, center, size * 0.12, center, center, size * 0.56)
  mask.addColorStop(0, "rgba(255, 255, 255, 1)")
  mask.addColorStop(1, "rgba(255, 255, 255, 0)")
  ctx2.fillStyle = mask
  ctx2.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  return texture
}

function createGalaxyTexture(seed: number, size = 512) {
  if (typeof document === "undefined") return null

  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  const rand = mulberry32(seed)
  const center = size / 2

  ctx.clearRect(0, 0, size, size)
  ctx.globalCompositeOperation = "lighter"

  // Core glow.
  ctx.filter = `blur(${Math.round(size * 0.018)}px)`
  const core = ctx.createRadialGradient(center, center, 0, center, center, size * 0.18)
  core.addColorStop(0, "rgba(255, 255, 255, 0.95)")
  core.addColorStop(0.35, "rgba(255, 255, 255, 0.38)")
  core.addColorStop(1, "rgba(255, 255, 255, 0)")
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.arc(center, center, size * 0.2, 0, Math.PI * 2)
  ctx.fill()

  const armCount = 4
  const steps = 140
  const maxR = size * 0.46

  // Spiral arms.
  for (let arm = 0; arm < armCount; arm += 1) {
    const armOffset = (arm / armCount) * Math.PI * 2 + rand() * 0.4

    for (let i = 0; i < steps; i += 1) {
      const t = i / Math.max(1, steps - 1)
      const r = maxR * t
      const angle = t * (Math.PI * 6.2) + armOffset
      const warp = 0.92 + rand() * 0.18
      const squash = 0.55 + rand() * 0.08

      const x = center + Math.cos(angle) * r * warp
      const y = center + Math.sin(angle) * r * warp * squash

      // Add a bit of jitter so the arms aren't perfectly smooth.
      const jx = (rand() - 0.5) * size * 0.01 * (0.4 + t)
      const jy = (rand() - 0.5) * size * 0.01 * (0.4 + t)

      const dotR = size * (0.004 + (1 - t) * 0.012)
      const a = (0.03 + rand() * 0.065) * (1 - t) * (0.75 + 0.25 * Math.sin(t * Math.PI))

      ctx.filter = `blur(${Math.round(size * (0.003 + (1 - t) * 0.01))}px)`
      const g = ctx.createRadialGradient(x + jx, y + jy, 0, x + jx, y + jy, dotR * 7)
      g.addColorStop(0, `rgba(255, 255, 255, ${a})`)
      g.addColorStop(1, "rgba(255, 255, 255, 0)")
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x + jx, y + jy, dotR * 9, 0, Math.PI * 2)
      ctx.fill()

      // Rare, sharper star clumps so it reads like a galaxy (not a soft oval).
      if (rand() < 0.22 && t > 0.18) {
        ctx.filter = `blur(${Math.round(size * 0.002)}px)`
        const starR = size * (0.003 + rand() * 0.004)
        const starA = 0.12 + rand() * 0.25
        const g2 = ctx.createRadialGradient(x + jx, y + jy, 0, x + jx, y + jy, starR * 10)
        g2.addColorStop(0, `rgba(255, 255, 255, ${starA})`)
        g2.addColorStop(1, "rgba(255, 255, 255, 0)")
        ctx.fillStyle = g2
        ctx.beginPath()
        ctx.arc(x + jx, y + jy, starR * 10, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  // Outer halo.
  ctx.filter = `blur(${Math.round(size * 0.018)}px)`
  const halo = ctx.createRadialGradient(center, center, size * 0.08, center, center, size * 0.52)
  halo.addColorStop(0, "rgba(255, 255, 255, 0.18)")
  halo.addColorStop(1, "rgba(255, 255, 255, 0)")
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(center, center, size * 0.54, 0, Math.PI * 2)
  ctx.fill()

  ctx.filter = "none"

  // Fade edges.
  ctx.globalCompositeOperation = "destination-in"
  const mask = ctx.createRadialGradient(center, center, size * 0.08, center, center, size * 0.56)
  mask.addColorStop(0, "rgba(255, 255, 255, 1)")
  mask.addColorStop(1, "rgba(255, 255, 255, 0)")
  ctx.fillStyle = mask
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.generateMipmaps = false
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  return texture
}

function makeNebulaColors(accentColor: string, variant: SpaceVariant) {
  const accent = new THREE.Color(accentColor)
  const white = new THREE.Color("#ffffff")

  const soft = accent.clone().lerp(white, 0.35)
  const pale = accent.clone().lerp(white, 0.58)

  // Slightly brighter than onboarding: this is meant to read against a near-black UI.
  const scaleSoft = variant === "landing" ? 0.76 : 0.7
  const scalePale = variant === "landing" ? 0.94 : 0.86

  soft.multiplyScalar(scaleSoft)
  pale.multiplyScalar(scalePale)
  return { soft, pale }
}

export function NebulaVolume({
  accentColor,
  variant,
  animate = true,
  layers = 3,
}: {
  accentColor: string
  variant: SpaceVariant
  animate?: boolean
  layers?: number
}) {
  const layerCount = Math.max(0, Math.min(3, Math.round(layers)))
  const enabled = layerCount > 0
  const baseColors = useMemo(() => makeNebulaColors(accentColor, variant), [accentColor, variant])

  // Turn down intensity here: these layers are large and blended.
  // (NebulaBackdrop is responsible for the crisp, brighter accents.)
  const volumeColors = useMemo(() => {
    const soft = baseColors.soft.clone().multiplyScalar(0.42)
    const pale = baseColors.pale.clone().multiplyScalar(0.36)
    return { soft, pale }
  }, [baseColors])

  const [textures, setTextures] = useState<
    [THREE.Texture | null, THREE.Texture | null, THREE.Texture | null]
  >([null, null, null])

  useEffect(() => {
    if (!enabled) {
      setTextures([null, null, null])
      return
    }

    // Only depends on variant + enabled so we don't regenerate when `layers`
    // changes between 1..3.
    const baseSeed = variant === "landing" ? 1201 : 2201
    const next: [THREE.Texture | null, THREE.Texture | null, THREE.Texture | null] = [
      retainNebulaVolumeTexture(baseSeed),
      retainNebulaVolumeTexture(baseSeed + 1),
      retainNebulaVolumeTexture(baseSeed + 2),
    ]

    setTextures(next)
    return () => {
      for (const texture of next) releaseNebulaVolumeTexture(texture)
    }
  }, [variant, enabled])

  const layerSettings = useMemo(() => {
    if (variant === "landing") {
      return [
        {
          position: [0, 10, -56] as [number, number, number],
          rotation: [0.08, 0.32, 0.06] as [number, number, number],
          bounds: [92, 54, 18] as [number, number, number],
          segments: 28,
          size: [20, 50] as [number, number],
          opacity: 0.11,
          colorKey: "pale" as const,
          textureIndex: 0,
        },
        {
          position: [-14, -12, -76] as [number, number, number],
          rotation: [0.02, -0.26, -0.08] as [number, number, number],
          bounds: [104, 62, 20] as [number, number, number],
          segments: 24,
          size: [22, 56] as [number, number],
          opacity: 0.085,
          colorKey: "soft" as const,
          textureIndex: 1,
        },
        {
          position: [18, 6, -102] as [number, number, number],
          rotation: [-0.03, 0.58, 0.04] as [number, number, number],
          bounds: [124, 72, 24] as [number, number, number],
          segments: 20,
          size: [26, 62] as [number, number],
          opacity: 0.065,
          colorKey: "pale" as const,
          textureIndex: 2,
        },
      ]
    }

    return [
      {
        position: [0, 7.5, -42] as [number, number, number],
        rotation: [0.09, 0.34, 0.05] as [number, number, number],
        bounds: [78, 44, 16] as [number, number, number],
        segments: 22,
        size: [18, 44] as [number, number],
        opacity: 0.095,
        colorKey: "pale" as const,
        textureIndex: 0,
      },
      {
        position: [-12, -10, -58] as [number, number, number],
        rotation: [0.03, -0.22, -0.08] as [number, number, number],
        bounds: [90, 50, 18] as [number, number, number],
        segments: 18,
        size: [20, 48] as [number, number],
        opacity: 0.072,
        colorKey: "soft" as const,
        textureIndex: 1,
      },
      {
        position: [14, 4, -78] as [number, number, number],
        rotation: [-0.03, 0.56, 0.04] as [number, number, number],
        bounds: [104, 58, 22] as [number, number, number],
        segments: 14,
        size: [24, 56] as [number, number],
        opacity: 0.055,
        colorKey: "pale" as const,
        textureIndex: 2,
      },
    ]
  }, [variant])

  const materials = useMemo(() => {
    const mats: THREE.SpriteMaterial[] = []
    for (let i = 0; i < layerCount; i += 1) {
      const material = new THREE.SpriteMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: true,
        blending: THREE.NormalBlending,
        fog: false,
      })
      material.toneMapped = false
      material.alphaTest = 0.001
      mats.push(material)
    }
    return mats
  }, [layerCount])

  useEffect(() => {
    return () => {
      for (const material of materials) material.dispose()
    }
  }, [materials])

  useEffect(() => {
    for (let i = 0; i < layerCount; i += 1) {
      const layer = layerSettings[i]
      const material = materials[i]
      if (!layer || !material) continue

      const map = textures[layer.textureIndex] ?? null
      const color = layer.colorKey === "soft" ? volumeColors.soft : volumeColors.pale

      const mapChanged = material.map !== map
      material.map = map
      material.opacity = map ? layer.opacity : 0
      material.color.copy(color)
      if (mapChanged) material.needsUpdate = true
    }
  }, [layerCount, layerSettings, materials, textures, volumeColors])

  const spriteDataByLayer = useMemo(() => {
    const layers = layerSettings.slice(0, layerCount)

    return layers.map((layer, layerIdx) => {
      const seed = (variant === "landing" ? 9101 : 8101) + layerIdx * 197
      const rand = mulberry32(seed)

      return Array.from({ length: layer.segments }).map(() => {
        const nx = Math.max(-1, Math.min(1, randNorm(rand) * 0.52))
        const ny = Math.max(-1, Math.min(1, randNorm(rand) * 0.52))
        const nz = Math.max(-1, Math.min(1, randNorm(rand) * 0.36))

        const x = nx * (layer.bounds[0] * 0.5)
        const y = ny * (layer.bounds[1] * 0.5)
        const z = nz * (layer.bounds[2] * 0.5)

        const t = Math.pow(rand(), 1.65)
        const base = THREE.MathUtils.lerp(layer.size[0], layer.size[1], t)
        const ax = 0.72 + rand() * 0.7
        const ay = 0.72 + rand() * 0.7

        return {
          position: [x, y, z] as [number, number, number],
          scale: [base * ax, base * ay, 1] as [number, number, number],
          rotation: rand() * Math.PI * 2,
        }
      })
    })
  }, [layerCount, layerSettings, variant])

  const layerGroupRefs = useRef<(THREE.Group | null)[]>([])

  useFrame((state) => {
    if (!animate) return
    if (layerCount === 0) return

    const t = state.clock.elapsedTime
    for (let i = 0; i < layerCount; i += 1) {
      const group = layerGroupRefs.current[i]
      const base = layerSettings[i]
      if (!group || !base) continue

      const phase = i * 1.7
      group.rotation.x = base.rotation[0] + Math.sin(t * 0.023 + phase) * 0.01
      group.rotation.y = base.rotation[1] + Math.cos(t * 0.018 + phase) * 0.02
      group.rotation.z = base.rotation[2] + Math.sin(t * 0.02 + phase) * 0.02

      group.position.x =
        base.position[0] + Math.sin(t * 0.06 + phase) * 0.55 + Math.sin(t * 0.083 + phase) * 0.22
      group.position.y =
        base.position[1] + Math.cos(t * 0.055 + phase) * 0.42 + Math.sin(t * 0.071 + phase) * 0.18
    }
  })

  if (layerCount === 0) return null

  return (
    <group>
      {layerSettings.slice(0, layerCount).map((layer, layerIdx) => (
        <group
          key={layerIdx}
          ref={(el) => {
            layerGroupRefs.current[layerIdx] = el
          }}
          position={layer.position}
          rotation={layer.rotation}
        >
          {spriteDataByLayer[layerIdx]?.map((sprite, idx) => (
            <sprite
              key={idx}
              position={sprite.position}
              scale={sprite.scale}
              rotation={[0, 0, sprite.rotation]}
              material={materials[layerIdx]}
              renderOrder={-20}
            />
          ))}
        </group>
      ))}
    </group>
  )
}

export function NebulaBackdrop({
  accentColor,
  variant,
  animate = true,
  density = 1,
}: {
  accentColor: string
  variant: SpaceVariant
  animate?: boolean
  density?: number
}) {
  const clampedDensity = clamp01(density)
  const textures = useMemo(() => {
    if (clampedDensity <= 0) {
      return { gasA: null, gasB: null, dust: null }
    }
    const a = variant === "landing" ? 21 : 11
    return {
      gasA: createNebulaTexture(a),
      gasB: createNebulaTexture(a + 1),
      dust: createDustLaneTexture(a + 2),
    }
  }, [variant, clampedDensity])

  useEffect(() => {
    return () => {
      textures.gasA?.dispose()
      textures.gasB?.dispose()
      textures.dust?.dispose()
    }
  }, [textures])

  const colors = useMemo(() => makeNebulaColors(accentColor, variant), [accentColor, variant])

  const data = useMemo(() => {
    const rand = mulberry32(variant === "landing" ? 801 : 401)

    const baseGasCount = variant === "landing" ? 12 : 10
    const baseDustCount = variant === "landing" ? 5 : 4
    const gasCount = Math.max(0, Math.round(baseGasCount * clampedDensity))
    const dustCount = Math.max(0, Math.round(baseDustCount * clampedDensity))

    const gas = Array.from({ length: gasCount }).map((_, i) => {
      const u = gasCount <= 1 ? 0.5 : i / (gasCount - 1)
      const zNear = variant === "landing" ? -26 : -18
      const zFar = variant === "landing" ? -115 : -64
      const z = THREE.MathUtils.lerp(zNear, zFar, u)

      // A slightly diagonal band (like a galaxy arm), not just random blobs.
      const spineX = THREE.MathUtils.lerp(-28, 22, u) + Math.sin(u * 5.2 + 1.1) * (variant === "landing" ? 9 : 6)
      const spineY = THREE.MathUtils.lerp(16, -12, u) + Math.cos(u * 4.4 - 0.7) * (variant === "landing" ? 7 : 5)

      const spreadX = THREE.MathUtils.lerp(10, 26, u) + rand() * (variant === "landing" ? 10 : 7)
      const spreadY = THREE.MathUtils.lerp(8, 22, u) + rand() * (variant === "landing" ? 8 : 5)

      const x = spineX + THREE.MathUtils.randFloatSpread(spreadX)
      const y = spineY + THREE.MathUtils.randFloatSpread(spreadY)

      const base = THREE.MathUtils.lerp(26, 54, u) * (0.78 + rand() * 0.6)
      const ax = 0.65 + rand() * 1.15
      const ay = 0.55 + rand() * 1.3

      const opacityBase = variant === "landing" ? 0.036 : 0.03
      const opacityJitter = variant === "landing" ? 0.05 : 0.04
      const opacity = (opacityBase + rand() * opacityJitter) * (1 - u * 0.45) * clampedDensity

      return {
        x,
        y,
        z,
        u,
        scaleX: base * ax,
        scaleY: base * ay,
        rotation: THREE.MathUtils.randFloat(-Math.PI, Math.PI),
        opacity,
        phase: rand() * Math.PI * 2,
        driftX: (rand() - 0.5) * (variant === "landing" ? 2.0 : 1.6),
        driftY: (rand() - 0.5) * (variant === "landing" ? 1.7 : 1.3),
        spin: (rand() - 0.5) * (variant === "landing" ? 0.12 : 0.1),
        pulse: 0.08 + rand() * 0.14,
        colorKey: i % 3 === 0 ? "pale" : "soft",
        textureKey: i % 2 === 0 ? "gasA" : "gasB",
      }
    })

    const dust = Array.from({ length: dustCount }).map((_, i) => {
      const u = dustCount <= 1 ? 0.55 : (i + 0.35) / dustCount
      const zNear = variant === "landing" ? -18 : -12
      const zFar = variant === "landing" ? -74 : -44
      const z = THREE.MathUtils.lerp(zNear, zFar, u)

      const spineX = THREE.MathUtils.lerp(-22, 18, u) + Math.sin(u * 4.8 + 0.5) * (variant === "landing" ? 8 : 6)
      const spineY = THREE.MathUtils.lerp(12, -10, u) + Math.cos(u * 3.9 + 0.2) * (variant === "landing" ? 6 : 4)

      const x = spineX + THREE.MathUtils.randFloatSpread(variant === "landing" ? 14 : 10)
      const y = spineY + THREE.MathUtils.randFloatSpread(variant === "landing" ? 12 : 9)

      const base = THREE.MathUtils.lerp(24, 46, u) * (0.9 + rand() * 0.5)
      const ax = 0.7 + rand() * 1.05
      const ay = 0.55 + rand() * 1.1
      // Dust lanes should read as depth, not obvious "blobs".
      const opacityBase = variant === "landing" ? 0.036 : 0.03
      const opacity = (opacityBase + rand() * 0.03) * (1 - u * 0.35) * clampedDensity

      return {
        x,
        y,
        z,
        u,
        scaleX: base * ax,
        scaleY: base * ay,
        rotation: THREE.MathUtils.randFloat(-Math.PI, Math.PI),
        opacity,
        phase: rand() * Math.PI * 2,
        spin: (rand() - 0.5) * (variant === "landing" ? 0.07 : 0.06),
      }
    })

    return { gas, dust }
  }, [variant, clampedDensity])

  const groupRef = useRef<THREE.Group | null>(null)
  const gasSpriteRefs = useRef<(THREE.Sprite | null)[]>([])
  const gasMaterialRefs = useRef<(THREE.SpriteMaterial | null)[]>([])
  const dustSpriteRefs = useRef<(THREE.Sprite | null)[]>([])
  const dustMaterialRefs = useRef<(THREE.SpriteMaterial | null)[]>([])

  useFrame((state) => {
    if (!animate) return
    if (!groupRef.current) return
    const t = state.clock.elapsedTime
    groupRef.current.rotation.y = t * 0.003
    groupRef.current.rotation.z = Math.sin(t * 0.041) * 0.02
    groupRef.current.rotation.x = Math.cos(t * 0.029) * 0.012
    groupRef.current.position.x = Math.sin(t * 0.06) * 0.5 + Math.sin(t * 0.083) * 0.18
    groupRef.current.position.y = Math.cos(t * 0.055) * 0.38 + Math.sin(t * 0.071) * 0.14
    groupRef.current.updateMatrix()

    for (let i = 0; i < data.gas.length; i += 1) {
      const s = data.gas[i]
      const sprite = gasSpriteRefs.current[i]
      const material = gasMaterialRefs.current[i]
      if (sprite) {
        const depth = 1 - s.u * 0.55
        sprite.position.x = s.x + Math.sin(t * 0.07 + s.phase) * s.driftX * depth * 0.35
        sprite.position.y = s.y + Math.cos(t * 0.06 + s.phase) * s.driftY * depth * 0.35
        sprite.rotation.z = s.rotation + Math.sin(t * 0.03 + s.phase) * s.spin

        const breathe = 1 + Math.sin(t * 0.045 + s.phase) * s.pulse * 0.05
        sprite.scale.x = s.scaleX * breathe
        sprite.scale.y = s.scaleY * (1 + Math.cos(t * 0.04 + s.phase) * s.pulse * 0.05)
      }

      if (material) {
        const pulse = 0.86 + 0.14 * Math.sin(t * 0.06 + s.phase)
        material.opacity = s.opacity * pulse
      }
    }

    for (let i = 0; i < data.dust.length; i += 1) {
      const s = data.dust[i]
      const sprite = dustSpriteRefs.current[i]
      const material = dustMaterialRefs.current[i]

      if (sprite) {
        sprite.rotation.z = s.rotation + Math.sin(t * 0.02 + s.phase) * s.spin
      }

      if (material) {
        const pulse = 0.92 + 0.08 * Math.sin(t * 0.04 + s.phase)
        material.opacity = s.opacity * pulse
      }
    }
  })

  if (clampedDensity <= 0) return null

  return (
    <group ref={groupRef} matrixAutoUpdate={false}>
      {data.gas.map((s, idx) => (
        <sprite
          key={`gas-${idx}`}
          ref={(el) => {
            gasSpriteRefs.current[idx] = el
          }}
          position={[s.x, s.y, s.z]}
          rotation={[0, 0, s.rotation]}
          scale={[s.scaleX, s.scaleY, 1]}
        >
          <spriteMaterial
            ref={(el) => {
              gasMaterialRefs.current[idx] = el
            }}
            map={textures[s.textureKey as "gasA" | "gasB"] ?? undefined}
            transparent
            depthWrite={false}
            depthTest
            blending={THREE.AdditiveBlending}
            color={s.colorKey === "pale" ? colors.pale : colors.soft}
            opacity={s.opacity}
            fog={false}
            toneMapped={false}
          />
        </sprite>
      ))}

      {textures.dust
        ? data.dust.map((s, idx) => (
            <sprite
              key={`dust-${idx}`}
              ref={(el) => {
                dustSpriteRefs.current[idx] = el
              }}
              position={[s.x, s.y, s.z]}
              rotation={[0, 0, s.rotation]}
              scale={[s.scaleX, s.scaleY, 1]}
            >
              <spriteMaterial
                ref={(el) => {
                  dustMaterialRefs.current[idx] = el
                }}
                map={textures.dust}
                transparent
                depthWrite={false}
                depthTest={false}
                blending={THREE.NormalBlending}
                color="#000000"
                opacity={s.opacity}
                fog={false}
                toneMapped={false}
              />
            </sprite>
          ))
        : null}
    </group>
  )
}

export function DistantStars({
  accentColor,
  variant,
  animate = true,
}: {
  accentColor: string
  variant: SpaceVariant
  animate?: boolean
}) {
  const discTexture = useDisposableTexture(createSoftDiscTexture, [])

  const config = useMemo(() => {
    if (variant === "landing") {
      return {
        count: 900,
        radius: [22, 84] as [number, number],
        zRange: [-120, -16] as [number, number],
        size: 0.08,
        opacity: 0.55,
      }
    }

    return {
      count: 500,
      radius: [16, 74] as [number, number],
      zRange: [-110, -22] as [number, number],
      size: 0.075,
      opacity: 0.45,
    }
  }, [variant])

  const data = useMemo(() => {
    const rand = mulberry32(variant === "landing" ? 999 : 555)
    const positions = new Float32Array(config.count * 3)
    const colors = new Float32Array(config.count * 3)

    const white = new THREE.Color("#ffffff")
    const warm = new THREE.Color("#fff6e9")
    const cool = new THREE.Color("#eaf3ff")

    const accent = new THREE.Color(accentColor)
    const accentStar = accent.clone().lerp(white, 0.8)

    const [radiusMin, radiusMax] = config.radius
    const [zMin, zMax] = config.zRange

    for (let i = 0; i < config.count; i += 1) {
      const angle = rand() * Math.PI * 2
      const r = radiusMin + rand() * (radiusMax - radiusMin)
      const x = Math.cos(angle) * r
      const y = Math.sin(angle) * r
      const z = THREE.MathUtils.randFloat(zMin, zMax)

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z

      const paletteRoll = rand()
      let c = white
      if (paletteRoll < 0.07) c = accentStar
      else if (paletteRoll < 0.23) c = warm
      else if (paletteRoll < 0.4) c = cool

      const distNorm = (r - radiusMin) / Math.max(0.0001, radiusMax - radiusMin)
      const zNorm = (zMax - z) / Math.max(0.0001, zMax - zMin)

      const brightness =
        (0.52 + rand() * 0.62) *
        THREE.MathUtils.lerp(1.0, 0.7, distNorm) *
        THREE.MathUtils.lerp(1.0, 0.78, zNorm)

      colors[i * 3] = c.r * brightness
      colors[i * 3 + 1] = c.g * brightness
      colors[i * 3 + 2] = c.b * brightness
    }

    return { positions, colors }
  }, [accentColor, config.count, config.radius, config.zRange, variant])

  const groupRef = useRef<THREE.Group | null>(null)

  useFrame((state) => {
    if (!animate) return
    if (!groupRef.current) return
    const t = state.clock.elapsedTime
    groupRef.current.rotation.z = t * 0.0016
    groupRef.current.rotation.y = t * 0.0012
  })

  return (
    <group ref={groupRef}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[data.colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={config.size}
          vertexColors
          transparent
          opacity={config.opacity}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          map={discTexture ?? undefined}
          alphaTest={0.001}
          sizeAttenuation
          fog={false}
        />
      </points>
    </group>
  )
}

export function StarClusters({
  accentColor,
  variant,
  animate = true,
}: {
  accentColor: string
  variant: SpaceVariant
  animate?: boolean
}) {
  const discTexture = useDisposableTexture(createSoftDiscTexture, [])

  const config = useMemo(() => {
    if (variant === "landing") {
      return {
        size: 0.105,
        opacity: 0.5,
        clusters: [
          { center: [-18, 14, -72] as [number, number, number], radius: 5.8, count: 120 },
          { center: [22, -8, -62] as [number, number, number], radius: 6.6, count: 140 },
          { center: [6, 22, -92] as [number, number, number], radius: 7.2, count: 140 },
        ],
      }
    }

    return {
      size: 0.11,
      opacity: 0.45,
      clusters: [
        { center: [-16, 10, -58] as [number, number, number], radius: 5.2, count: 90 },
        { center: [20, -9, -68] as [number, number, number], radius: 5.8, count: 110 },
        { center: [4, 18, -86] as [number, number, number], radius: 6.4, count: 110 },
      ],
    }
  }, [variant])

  const data = useMemo(() => {
    const rand = mulberry32(variant === "landing" ? 222 : 111)
    const total = config.clusters.reduce((acc, c) => acc + c.count, 0)
    const positions = new Float32Array(total * 3)
    const colors = new Float32Array(total * 3)

    const white = new THREE.Color("#ffffff")
    const warm = new THREE.Color("#fff6e9")
    const cool = new THREE.Color("#eaf3ff")
    const accent = new THREE.Color(accentColor)
    const accentStar = accent.clone().lerp(white, 0.72)

    let offset = 0

    for (const cluster of config.clusters) {
      for (let i = 0; i < cluster.count; i += 1) {
        const gx = randNorm(rand) * cluster.radius
        const gy = randNorm(rand) * cluster.radius * 0.82
        const gz = randNorm(rand) * cluster.radius * 0.65

        const idx = (offset + i) * 3
        positions[idx] = cluster.center[0] + gx
        positions[idx + 1] = cluster.center[1] + gy
        positions[idx + 2] = cluster.center[2] + gz

        const paletteRoll = rand()
        let c = white
        if (paletteRoll < 0.06) c = accentStar
        else if (paletteRoll < 0.18) c = warm
        else if (paletteRoll < 0.34) c = cool

        const radial = Math.sqrt(gx * gx + gy * gy + gz * gz) / Math.max(0.0001, cluster.radius)
        const brightness = (0.4 + rand() * 0.6) * (1 - clamp01(radial) * 0.55)

        colors[idx] = c.r * brightness
        colors[idx + 1] = c.g * brightness
        colors[idx + 2] = c.b * brightness
      }
      offset += cluster.count
    }

    return { positions, colors }
  }, [accentColor, config.clusters, variant])

  const groupRef = useRef<THREE.Group | null>(null)

  useFrame((state) => {
    if (!animate) return
    if (!groupRef.current) return
    const t = state.clock.elapsedTime
    groupRef.current.rotation.z = t * 0.0023
    groupRef.current.rotation.y = Math.sin(t * 0.04) * 0.015
  })

  return (
    <group ref={groupRef}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[data.colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={config.size}
          vertexColors
          transparent
          opacity={config.opacity}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          map={discTexture ?? undefined}
          alphaTest={0.001}
          sizeAttenuation
          fog={false}
        />
      </points>
    </group>
  )
}

export function GalaxySprites({
  accentColor,
  variant,
  animate = true,
}: {
  accentColor: string
  variant: SpaceVariant
  animate?: boolean
}) {
  const galaxyA = useDisposableTexture(() => createGalaxyTexture(77), [])
  const galaxyB = useDisposableTexture(() => createGalaxyTexture(78), [])

  const color = useMemo(() => {
    const accent = new THREE.Color(accentColor)
    const white = new THREE.Color("#ffffff")
    return accent.clone().lerp(white, 0.72).multiplyScalar(0.62)
  }, [accentColor])

  const sprites = useMemo(() => {
    if (variant === "landing") {
      return [
        {
          textureKey: "A" as const,
          position: [34, 18, -112] as [number, number, number],
          scale: [32, 24, 1] as [number, number, number],
          rotation: 0.62,
          opacity: 0.028,
        },
        {
          textureKey: "B" as const,
          position: [-38, -20, -98] as [number, number, number],
          scale: [30, 24, 1] as [number, number, number],
          rotation: -0.56,
          opacity: 0.022,
        },
      ]
    }

    return [
      {
        textureKey: "A" as const,
        position: [28, 14, -96] as [number, number, number],
        scale: [26, 20, 1] as [number, number, number],
        rotation: 0.48,
        opacity: 0.026,
      },
      {
        textureKey: "B" as const,
        position: [-34, -16, -112] as [number, number, number],
        scale: [30, 24, 1] as [number, number, number],
        rotation: -0.44,
        opacity: 0.021,
      },
    ]
  }, [variant])

  const groupRef = useRef<THREE.Group | null>(null)

  useFrame((state) => {
    if (!animate) return
    if (!groupRef.current) return
    const t = state.clock.elapsedTime
    groupRef.current.rotation.z = Math.sin(t * 0.018) * 0.012
    groupRef.current.rotation.y = t * 0.0008
  })

  return (
    <group ref={groupRef}>
      {sprites.map((s, idx) => {
        const map = s.textureKey === "A" ? galaxyA : galaxyB
        if (!map) return null
        return (
          <sprite
            key={idx}
            position={s.position}
            rotation={[0, 0, s.rotation]}
            scale={s.scale}
          >
            <spriteMaterial
              map={map}
              transparent
              depthWrite={false}
              depthTest
              blending={THREE.AdditiveBlending}
              color={color}
              opacity={s.opacity}
              fog={false}
              toneMapped={false}
            />
          </sprite>
        )
      })}
    </group>
  )
}

export function ShootingStars({
  accentColor,
  variant,
  animate = true,
}: {
  accentColor: string
  variant: SpaceVariant
  animate?: boolean
}) {
  const pointsRef = useRef<THREE.Points | null>(null)
  const positionAttrRef = useRef<THREE.BufferAttribute | null>(null)
  const materialRef = useRef<THREE.PointsMaterial | null>(null)
  const discTexture = useDisposableTexture(createSoftDiscTexture, [])

  const config = useMemo(() => {
    if (variant === "landing") {
      return {
        trailPoints: 30,
        spawnInterval: [9, 16] as [number, number],
        zRange: [-92, -18] as [number, number],
        ringRadius: [24, 44] as [number, number],
        travelDistance: [28, 46] as [number, number],
        maxTrailLength: 11,
        size: 0.24,
      }
    }

    return {
      trailPoints: 26,
      spawnInterval: [12, 20] as [number, number],
      zRange: [-64, -18] as [number, number],
      ringRadius: [18, 34] as [number, number],
      travelDistance: [22, 36] as [number, number],
      maxTrailLength: 9,
      size: 0.22,
    }
  }, [variant])

  const stateRef = useRef({
    isActive: false,
    startedAt: 0,
    duration: 1,
    nextSpawnAt: 0,
    maxTrailLength: config.maxTrailLength,
    start: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    travelDistance: 30,
  })

  useEffect(() => {
    stateRef.current.maxTrailLength = config.maxTrailLength
  }, [config.maxTrailLength])

  const data = useMemo(() => {
    const positions = new Float32Array(config.trailPoints * 3)
    const colors = new Float32Array(config.trailPoints * 3)

    const white = new THREE.Color("#ffffff")
    const accent = new THREE.Color(accentColor)
    const accentBright = accent.clone().lerp(white, 0.45)

    for (let i = 0; i < config.trailPoints; i += 1) {
      const t = i / Math.max(1, config.trailPoints - 1)
      const brightness = Math.pow(1 - t, 2.1) * 1.15
      const c = white.clone().lerp(accentBright, t)
      colors[i * 3] = c.r * brightness
      colors[i * 3 + 1] = c.g * brightness
      colors[i * 3 + 2] = c.b * brightness
    }

    return { positions, colors }
  }, [accentColor, config.trailPoints])

  useEffect(() => {
    if (positionAttrRef.current) {
      positionAttrRef.current.setUsage(THREE.DynamicDrawUsage)
    }

    if (materialRef.current) {
      materialRef.current.opacity = 0
    }
  }, [])

  function scheduleNextSpawn(now: number) {
    const [minI, maxI] = config.spawnInterval
    stateRef.current.nextSpawnAt = now + minI + Math.random() * (maxI - minI)
  }

  function startStar(now: number) {
    const s = stateRef.current
    const [zMin, zMax] = config.zRange
    const [rMin, rMax] = config.ringRadius
    const [dMin, dMax] = config.travelDistance

    s.isActive = true
    s.startedAt = now
    s.duration = 0.9 + Math.random() * 0.55
    s.travelDistance = dMin + Math.random() * (dMax - dMin)

    const angle = Math.random() * Math.PI * 2
    const ringRadius = rMin + Math.random() * (rMax - rMin)
    const z = THREE.MathUtils.randFloat(zMin, zMax)
    s.start.set(Math.cos(angle) * ringRadius, Math.sin(angle) * ringRadius, z)

    // Mostly across the view, slight Z drift.
    const dirAngle = angle + Math.PI + THREE.MathUtils.randFloat(-0.95, 0.95)
    s.dir.set(Math.cos(dirAngle), Math.sin(dirAngle), THREE.MathUtils.randFloat(-0.16, 0.16)).normalize()
  }

  useFrame((fiberState) => {
    if (!animate) return
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
    const p = 1 - Math.pow(1 - t, 3)

    const fadeIn = clamp01(t / 0.12)
    const fadeOut = 1 - clamp01((t - 0.72) / 0.28)
    const fade = fadeIn * fadeOut

    const tailGrow = clamp01(t / 0.18)
    const tailLength = s.maxTrailLength * tailGrow
    const spacing = tailLength / Math.max(1, config.trailPoints - 1)

    const travel = s.travelDistance * p
    const headX = s.start.x + s.dir.x * travel
    const headY = s.start.y + s.dir.y * travel
    const headZ = s.start.z + s.dir.z * travel

    const stepX = s.dir.x * spacing
    const stepY = s.dir.y * spacing
    const stepZ = s.dir.z * spacing

    for (let i = 0; i < config.trailPoints; i += 1) {
      const idx = i * 3
      data.positions[idx] = headX - stepX * i
      data.positions[idx + 1] = headY - stepY * i
      data.positions[idx + 2] = headZ - stepZ * i
    }

    positionAttrRef.current.needsUpdate = true
    materialRef.current.opacity = 0.85 * fade

    if (t >= 1) {
      s.isActive = false
      scheduleNextSpawn(now)
    }
  })

  if (!animate) return null

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute ref={positionAttrRef} attach="attributes-position" args={[data.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[data.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={materialRef}
        size={config.size}
        vertexColors
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        map={discTexture ?? undefined}
        alphaTest={0.001}
        sizeAttenuation
        fog={false}
      />
    </points>
  )
}

export function FloatingGeometryField({
  accentColor,
  variant,
  animate = true,
}: {
  accentColor: string
  variant: SpaceVariant
  animate?: boolean
}) {
  const shapes = useMemo(() => {
    if (variant === "landing") {
      return [
        { pos: [-22, 14, -46] as [number, number, number], scale: 0.42, type: "octahedron" as const },
        { pos: [26, -10, -52] as [number, number, number], scale: 0.34, type: "icosahedron" as const },
        { pos: [12, 22, -68] as [number, number, number], scale: 0.28, type: "dodecahedron" as const },
      ]
    }

    return [
      { pos: [-18, 10, -34] as [number, number, number], scale: 0.38, type: "octahedron" as const },
      { pos: [20, -8, -38] as [number, number, number], scale: 0.32, type: "icosahedron" as const },
      { pos: [12, 16, -44] as [number, number, number], scale: 0.26, type: "tetrahedron" as const },
      { pos: [-24, -14, -48] as [number, number, number], scale: 0.3, type: "dodecahedron" as const },
    ]
  }, [variant])

  const materialProps = useMemo(() => {
    const opacity = variant === "landing" ? 0.28 : 0.34
    const emissiveIntensity = variant === "landing" ? 0.38 : 0.46
    return { opacity, emissiveIntensity }
  }, [variant])

  const mesh = (shape: (typeof shapes)[number], i: number) => (
    <mesh scale={shape.scale}>
      {shape.type === "octahedron" && <octahedronGeometry args={[1, 0]} />}
      {shape.type === "icosahedron" && <icosahedronGeometry args={[1, 0]} />}
      {shape.type === "tetrahedron" && <tetrahedronGeometry args={[1, 0]} />}
      {shape.type === "dodecahedron" && <dodecahedronGeometry args={[1, 0]} />}
      <meshStandardMaterial
        color={accentColor}
        emissive={accentColor}
        emissiveIntensity={materialProps.emissiveIntensity}
        metalness={0.84}
        roughness={0.22}
        transparent
        opacity={materialProps.opacity}
        wireframe={i % 2 === 0}
      />
    </mesh>
  )

  return (
    <>
      {shapes.map((shape, i) => {
        if (!animate) {
          return (
            <group key={i} position={shape.pos}>
              {mesh(shape, i)}
            </group>
          )
        }

        return (
          <Float
            key={i}
            position={shape.pos}
            speed={0.32}
            rotationIntensity={0.16}
            floatIntensity={0.32}
          >
            {mesh(shape, i)}
          </Float>
        )
      })}
    </>
  )
}
