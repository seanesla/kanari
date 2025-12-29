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
 * Update CSS custom properties with new accent color
 */
export function updateCSSVariables(hex: string) {
  if (typeof document === "undefined") return

  const oklchValue = hexToOklch(hex)
  const root = document.documentElement

  // Update all accent-related CSS variables
  root.style.setProperty("--accent", `oklch(${oklchValue})`)
  root.style.setProperty("--ring", `oklch(${oklchValue})`)
  root.style.setProperty("--chart-1", `oklch(${oklchValue})`)
  root.style.setProperty("--sidebar-primary", `oklch(${oklchValue})`)
  root.style.setProperty("--sidebar-ring", `oklch(${oklchValue})`)
}
