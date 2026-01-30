import type { GraphicsQuality } from "@/lib/types"

export type ResolvedGraphicsQuality = "low" | "medium" | "high" | "static"

export interface GraphicsProfile {
  quality: ResolvedGraphicsQuality
  dpr: [number, number]
  antialias: boolean
  maxFps: number | null
  animate: boolean
  nebulaVolumeLayers: number
  nebulaBackdropDensity: number
  auroraEnabled: boolean
  starfieldScale: number
  sparklesScale: number
  shootingStars: boolean
  floatingGeometry: boolean
  orbSamples: number
}

export const GRAPHICS_PRESET_OPTIONS: Array<{
  value: GraphicsQuality
  label: string
  description: string
}> = [
  {
    value: "auto",
    label: "Auto (recommended)",
    description: "Balanced fog with smart limits for most laptops.",
  },
  {
    value: "low",
    label: "Low",
    description: "Light fog, fewer effects, lowest GPU cost.",
  },
  {
    value: "medium",
    label: "Medium",
    description: "Full vibe with tuned performance.",
  },
  {
    value: "high",
    label: "High",
    description: "Maximum detail and animation (most GPU).",
  },
  {
    value: "static",
    label: "Static",
    description: "Keeps the fog look, but stops animation.",
  },
]

function clampQuality(quality: GraphicsQuality | undefined): GraphicsQuality {
  if (!quality) return "auto"
  if (quality === "auto" || quality === "low" || quality === "medium" || quality === "high" || quality === "static") {
    return quality
  }
  return "auto"
}

function resolveAutoQuality(prefersReducedMotion?: boolean): ResolvedGraphicsQuality {
  if (prefersReducedMotion) return "static"
  if (typeof window === "undefined") return "medium"

  const cores = navigator.hardwareConcurrency ?? 6
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8

  if (cores <= 4 || memory <= 4) return "low"
  return "medium"
}

export function resolveGraphicsQuality(
  quality: GraphicsQuality | undefined,
  options?: { prefersReducedMotion?: boolean }
): ResolvedGraphicsQuality {
  const resolved = clampQuality(quality)
  if (resolved === "auto") return resolveAutoQuality(options?.prefersReducedMotion)
  return resolved
}

const GRAPHICS_PROFILES: Record<ResolvedGraphicsQuality, GraphicsProfile> = {
  low: {
    quality: "low",
    dpr: [1, 1.15],
    antialias: false,
    maxFps: 20,
    animate: true,
    nebulaVolumeLayers: 0,
    nebulaBackdropDensity: 0.6,
    auroraEnabled: false,
    starfieldScale: 0.65,
    sparklesScale: 0.5,
    shootingStars: false,
    floatingGeometry: false,
    orbSamples: 2,
  },
  medium: {
    quality: "medium",
    dpr: [1, 1.25],
    antialias: false,
    maxFps: 30,
    animate: true,
    nebulaVolumeLayers: 1,
    nebulaBackdropDensity: 0.8,
    auroraEnabled: false,
    starfieldScale: 0.85,
    sparklesScale: 0.75,
    shootingStars: true,
    floatingGeometry: true,
    orbSamples: 4,
  },
  high: {
    quality: "high",
    dpr: [1, 1.5],
    antialias: true,
    maxFps: null,
    animate: true,
    nebulaVolumeLayers: 3,
    nebulaBackdropDensity: 1,
    auroraEnabled: true,
    starfieldScale: 1,
    sparklesScale: 1,
    shootingStars: true,
    floatingGeometry: true,
    orbSamples: 8,
  },
  static: {
    quality: "static",
    dpr: [1, 1.25],
    antialias: false,
    maxFps: 0,
    animate: false,
    nebulaVolumeLayers: 1,
    nebulaBackdropDensity: 0.8,
    auroraEnabled: false,
    starfieldScale: 0.8,
    sparklesScale: 0.6,
    shootingStars: false,
    floatingGeometry: false,
    orbSamples: 4,
  },
}

export function getGraphicsProfile(
  quality: GraphicsQuality | undefined,
  options?: { prefersReducedMotion?: boolean }
): GraphicsProfile {
  const resolved = resolveGraphicsQuality(quality, options)
  const base = GRAPHICS_PROFILES[resolved]

  if (!options?.prefersReducedMotion) return base

  return {
    ...base,
    quality: "static",
    animate: false,
    maxFps: 0,
    shootingStars: false,
  }
}
