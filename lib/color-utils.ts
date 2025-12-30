import { oklch, formatHex } from "culori"

export const DEFAULT_ACCENT = "#d4a574"
export const DEFAULT_ACCENT_DARK = "#8b4513"

/**
 * Convert hex color to OKLCH format for CSS variables
 * Example: #d4a574 → "0.78 0.16 70"
 */
export function hexToOklch(hex: string): string {
  const color = oklch(hex)
  if (!color) return "0.78 0.16 70" // fallback to amber

  // Return as space-separated values (no oklch() wrapper)
  return `${color.l.toFixed(2)} ${color.c.toFixed(2)} ${(color.h || 0).toFixed(0)}`
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
  if (!color) return "oklch(0.78 0.08 70)" // fallback to amber muted

  // Use accent hue with muted chroma (0.08) and standard lightness (0.78)
  return `oklch(0.78 0.08 ${(color.h || 0).toFixed(0)})`
}

/**
 * Update CSS custom properties with new accent color
 * Updates both accent variables and base palette hues for consistent theming
 */
export function updateCSSVariables(hex: string) {
  if (typeof document === "undefined") return

  const color = oklch(hex)
  const hue = (color?.h || 60).toFixed(0)

  const oklchValue = hexToOklch(hex)
  const lightVariant = generateLightVariant(hex)
  const lightOklchValue = hexToOklch(lightVariant)
  const mutedValue = generateMutedOklch(hex)
  const root = document.documentElement

  // Update accent-related CSS variables
  root.style.setProperty("--accent", `oklch(${oklchValue})`)
  root.style.setProperty("--accent-light", `oklch(${lightOklchValue})`)
  root.style.setProperty("--muted-foreground", mutedValue)
  root.style.setProperty("--ring", `oklch(${oklchValue})`)
  root.style.setProperty("--chart-1", `oklch(${oklchValue})`)
  root.style.setProperty("--sidebar-primary", `oklch(${oklchValue})`)
  root.style.setProperty("--sidebar-ring", `oklch(${oklchValue})`)

  // Update base palette hues to match accent (keep original L and C values)
  root.style.setProperty("--background", `oklch(0.08 0.01 ${hue})`)
  root.style.setProperty("--foreground", `oklch(0.93 0.01 ${hue})`)
  root.style.setProperty("--card", `oklch(0.14 0.01 ${hue})`)
  root.style.setProperty("--card-foreground", `oklch(0.93 0.01 ${hue})`)
  root.style.setProperty("--popover", `oklch(0.14 0.01 ${hue})`)
  root.style.setProperty("--popover-foreground", `oklch(0.93 0.01 ${hue})`)
  root.style.setProperty("--primary", `oklch(0.93 0.01 ${hue})`)
  root.style.setProperty("--primary-foreground", `oklch(0.08 0.01 ${hue})`)
  root.style.setProperty("--secondary", `oklch(0.18 0.01 ${hue})`)
  root.style.setProperty("--secondary-foreground", `oklch(0.93 0.01 ${hue})`)
  root.style.setProperty("--muted", `oklch(0.21 0.01 ${hue})`)
  root.style.setProperty("--accent-foreground", `oklch(0.08 0.01 ${hue})`)
  root.style.setProperty("--border", `oklch(0.30 0.01 ${hue})`)
  root.style.setProperty("--input", `oklch(0.18 0.01 ${hue})`)
  root.style.setProperty("--sidebar", `oklch(0.06 0.01 ${hue})`)
  root.style.setProperty("--sidebar-foreground", `oklch(0.93 0.01 ${hue})`)
  root.style.setProperty("--sidebar-accent", `oklch(0.18 0.01 ${hue})`)
  root.style.setProperty("--sidebar-accent-foreground", `oklch(0.93 0.01 ${hue})`)
  root.style.setProperty("--sidebar-border", `oklch(0.25 0.01 ${hue})`)
  root.style.setProperty("--sidebar-primary-foreground", `oklch(0.08 0.01 ${hue})`)
}
