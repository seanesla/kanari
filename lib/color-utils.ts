import { oklch, formatHex } from "culori"

export const DEFAULT_ACCENT = "#d4a574"
export const DEFAULT_ACCENT_DARK = "#8b4513"

// Error pattern doc: docs/error-patterns/oklch-lightness-must-be-percent.md

function hexToHslHueDegrees(hex: string): number | null {
  if (typeof hex !== "string") return null
  const value = hex.trim().toLowerCase()
  if (!value.startsWith("#")) return null
  const raw = value.slice(1)
  const expanded =
    raw.length === 3
      ? `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`
      : raw.length === 6
        ? `#${raw}`
        : null
  if (!expanded) return null

  const r = parseInt(expanded.slice(1, 3), 16) / 255
  const g = parseInt(expanded.slice(3, 5), 16) / 255
  const b = parseInt(expanded.slice(5, 7), 16) / 255
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return 0

  let h: number
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4

  h *= 60
  if (h < 0) h += 360
  return h
}

function normalizeHueDeltaDegrees(delta: number): number {
  // Normalize to [-180, 180]
  return ((delta + 180) % 360) - 180
}

const ARTWORK_BASE_HUE_DEG = hexToHslHueDegrees(DEFAULT_ACCENT) ?? 0

/**
 * Convert hex color to OKLCH format for CSS variables
 * Example: #d4a574 → "78% 0.16 70"
 */
export function hexToOklch(hex: string): string {
  const color = oklch(hex)
  if (!color) return "78% 0.16 70" // fallback to amber

  // Return as space-separated values (no oklch() wrapper)
  return `${(color.l * 100).toFixed(2)}% ${color.c.toFixed(2)} ${(color.h || 0).toFixed(0)}`
}

/**
 * Generate darker variant by reducing lightness by 30%
 * Example: #d4a574 → #8b4513
 */
export function generateDarkVariant(hex: string): string {
  const color = oklch(hex)
  if (!color) return DEFAULT_ACCENT_DARK

  const darkColor = {
    ...color,
    l: Math.max(0, color.l * 0.7) // Reduce lightness by 30%
  }

  return formatHex(darkColor) || DEFAULT_ACCENT_DARK
}

/**
 * Generate lighter variant by increasing lightness by 15%
 * Used for hover states and lighter text
 */
export function generateLightVariant(hex: string): string {
  const color = oklch(hex)
  if (!color) return "#e0b080" // fallback

  const lightColor = {
    ...color,
    l: Math.min(1, color.l * 1.15) // Increase lightness by 15%
  }

  return formatHex(lightColor) || "#e0b080"
}

/**
 * Generate muted variant for secondary text (text-muted-foreground)
 * Uses accent hue with low chroma for subtle tinting
 */
export function generateMutedOklch(hex: string): string {
  const color = oklch(hex)
  if (!color) return "oklch(78% 0.08 70)" // fallback to amber muted

  // Use accent hue with muted chroma (0.08) and standard lightness (0.78)
  return `oklch(78% 0.08 ${(color.h || 0).toFixed(0)})`
}

/**
 * Update CSS custom properties with new accent color
 * Updates both accent variables and base palette hues for consistent theming
 */
export function updateCSSVariables(hex: string) {
  if (typeof document === "undefined") return

  const supportsOklch =
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("color", "oklch(50% 0.1 0)")

  const color = oklch(hex)
  const hue = (color?.h || 60).toFixed(0)

  const oklchValue = hexToOklch(hex)
  const lightVariant = generateLightVariant(hex)
  const darkVariant = generateDarkVariant(hex)
  const lightOklchValue = hexToOklch(lightVariant)
  const darkOklchValue = hexToOklch(darkVariant)
  const mutedValue = generateMutedOklch(hex)
  const root = document.documentElement
  const accentHueDeg = hexToHslHueDegrees(hex) ?? ARTWORK_BASE_HUE_DEG
  const artworkHueShiftDeg = Math.round(normalizeHueDeltaDegrees(accentHueDeg - ARTWORK_BASE_HUE_DEG) * 1000) / 1000

  root.style.setProperty("--kanari-artwork-hue-shift", `${artworkHueShiftDeg}deg`)

  if (!supportsOklch) {
    // Keep the app readable on browsers without OKLCH support by emitting hex values.
    // We intentionally avoid rewriting the whole base palette in this mode.
    root.style.setProperty("--accent", hex)
    root.style.setProperty("--accent-light", lightVariant)
    root.style.setProperty("--accent-dark", darkVariant)
    root.style.setProperty("--muted-foreground", formatHex({ mode: "oklch", l: 0.78, c: 0.08, h: color?.h || 60 }) || "#d9af7f")
    root.style.setProperty("--ring", hex)
    root.style.setProperty("--chart-1", hex)
    root.style.setProperty("--sidebar-primary", hex)
    root.style.setProperty("--sidebar-ring", hex)
    return
  }

  // Update accent-related CSS variables
  root.style.setProperty("--accent", `oklch(${oklchValue})`)
  root.style.setProperty("--accent-light", `oklch(${lightOklchValue})`)
  root.style.setProperty("--accent-dark", `oklch(${darkOklchValue})`)
  root.style.setProperty("--muted-foreground", mutedValue)
  root.style.setProperty("--ring", `oklch(${oklchValue})`)
  root.style.setProperty("--chart-1", `oklch(${oklchValue})`)
  root.style.setProperty("--sidebar-primary", `oklch(${oklchValue})`)
  root.style.setProperty("--sidebar-ring", `oklch(${oklchValue})`)

  // Update base palette hues to match accent (keep original L and C values)
  root.style.setProperty("--background", `oklch(8% 0.01 ${hue})`)
  root.style.setProperty("--foreground", `oklch(93% 0.01 ${hue})`)
  root.style.setProperty("--card", `oklch(14% 0.01 ${hue})`)
  root.style.setProperty("--card-foreground", `oklch(93% 0.01 ${hue})`)
  root.style.setProperty("--popover", `oklch(14% 0.01 ${hue})`)
  root.style.setProperty("--popover-foreground", `oklch(93% 0.01 ${hue})`)
  root.style.setProperty("--primary", `oklch(93% 0.01 ${hue})`)
  root.style.setProperty("--primary-foreground", `oklch(8% 0.01 ${hue})`)
  root.style.setProperty("--secondary", `oklch(18% 0.01 ${hue})`)
  root.style.setProperty("--secondary-foreground", `oklch(93% 0.01 ${hue})`)
  root.style.setProperty("--muted", `oklch(21% 0.01 ${hue})`)
  root.style.setProperty("--accent-foreground", `oklch(8% 0.01 ${hue})`)
  root.style.setProperty("--border", `oklch(30% 0.01 ${hue})`)
  root.style.setProperty("--input", `oklch(18% 0.01 ${hue})`)
  root.style.setProperty("--sidebar", `oklch(6% 0.01 ${hue})`)
  root.style.setProperty("--sidebar-foreground", `oklch(93% 0.01 ${hue})`)
  root.style.setProperty("--sidebar-accent", `oklch(18% 0.01 ${hue})`)
  root.style.setProperty("--sidebar-accent-foreground", `oklch(93% 0.01 ${hue})`)
  root.style.setProperty("--sidebar-border", `oklch(25% 0.01 ${hue})`)
  root.style.setProperty("--sidebar-primary-foreground", `oklch(8% 0.01 ${hue})`)
}
