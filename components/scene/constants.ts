import { SCENE_COLORS } from "@/lib/constants"

// Camera configuration
export const CAMERA = {
  initialPosition: [0, 1.5, 8] as const,
  fov: 50,
}

// Fog configuration
export const FOG = {
  color: SCENE_COLORS.background,
  near: 15,
  far: 40,
}

// Orbital ring radii for KanariCore
export const ORBITAL_RINGS = [1.6, 2.2, 2.8] as const

// Section accent positions (x, y, z)
export const SECTION_POSITIONS = {
  stats: [-6, -4, -8] as [number, number, number],
  problem: [7, -10, -6] as [number, number, number],
  how: [-5, -18, -5] as [number, number, number],
  cta: [0, -28, -4] as [number, number, number],
}

// Scroll thresholds for section visibility
export const SECTION_THRESHOLDS = {
  stats: 0.1,
  problem: 0.25,
  how: 0.45,
  cta: 0.7,
}

// Particle counts
export const PARTICLES = {
  landing: 80,
  dashboard: 50,
}
