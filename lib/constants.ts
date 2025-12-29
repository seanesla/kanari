// Breakpoints (matching Tailwind defaults)
export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1280,
} as const

// Scene colors for 3D rendering
// Note: accent colors are now managed by SceneProvider for dynamic theming
// Use useSceneMode().accentColor instead of SCENE_COLORS.accent
export const SCENE_COLORS = {
  background: "#0a0908",
} as const

// Animation timing constants
export const ANIMATION = {
  transition: {
    fast: 100,
    normal: 300,
    slow: 700,
  },
  easing: {
    default: "ease-in-out",
    smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
  },
} as const

// Lenis smooth scroll configuration
export const SCROLL = {
  duration: 1.2,
  easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
} as const
