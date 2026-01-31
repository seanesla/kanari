import type { GraphicsQuality } from "@/lib/types"

export type ResolvedGraphicsQuality = "low" | "medium" | "high"

export function normalizeGraphicsQuality(quality: unknown): GraphicsQuality {
  if (quality === "auto" || quality === "low" || quality === "medium" || quality === "high") {
    return quality
  }

  // Legacy migration target: "static" -> "medium"
  if (quality === "static") return "medium"

  return "auto"
}

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
]

function resolveAutoQuality(): ResolvedGraphicsQuality {
  if (typeof window === "undefined") return "medium"

  const cores = navigator.hardwareConcurrency ?? 6
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8

  if (cores <= 4 || memory <= 4) return "low"
  return "medium"
}

export function resolveGraphicsQuality(
  quality: GraphicsQuality | undefined,
  _options?: { prefersReducedMotion?: boolean }
): ResolvedGraphicsQuality {
  const resolved = normalizeGraphicsQuality(quality)
  if (resolved === "auto") return resolveAutoQuality()
  return resolved
}

const GRAPHICS_PROFILES: Record<ResolvedGraphicsQuality, GraphicsProfile> = {
  low: {
    quality: "low",
    dpr: [1, 1.15],
    antialias: false,
    maxFps: null,
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
    maxFps: null,
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
    animate: false,
    shootingStars: false,
  }
}
