/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

describe("color-utils OKLCH formatting", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("style")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("formats OKLCH lightness as a percentage (cross-browser)", async () => {
    const { hexToOklch } = await import("@/lib/color-utils")
    const result = hexToOklch("#d4a574")
    expect(result).toMatch(/^\d+(\.\d+)?% \d+(\.\d+)? \d+(\.\d+)?$/)
  })

  it("sets CSS variables using OKLCH percentage lightness (regression for iOS Safari near-black text)", async () => {
    vi.stubGlobal("CSS", { supports: () => true })
    const { updateCSSVariables } = await import("@/lib/color-utils")
    updateCSSVariables("#d4a574")

    const foreground = document.documentElement.style.getPropertyValue("--foreground")
    const accent = document.documentElement.style.getPropertyValue("--accent")
    const artworkHueShift = document.documentElement.style.getPropertyValue("--kanari-artwork-hue-shift")

    expect(foreground).toMatch(/^oklch\(\d+(\.\d+)?% /)
    expect(accent).toMatch(/^oklch\(\d+(\.\d+)?% /)
    expect(artworkHueShift).toBe("0deg")
  })

  it("falls back to hex CSS vars when OKLCH is unsupported", async () => {
    vi.stubGlobal("CSS", { supports: () => false })
    const { updateCSSVariables } = await import("@/lib/color-utils")
    updateCSSVariables("#d4a574")

    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("#d4a574")
    expect(document.documentElement.style.getPropertyValue("--foreground")).toBe("")
    expect(document.documentElement.style.getPropertyValue("--kanari-artwork-hue-shift")).toBe("0deg")
  })

  it("computes a stable landing artwork hue-shift from hex (used via CSS var to avoid hydration mismatch)", async () => {
    vi.stubGlobal("CSS", { supports: () => true })
    const { updateCSSVariables } = await import("@/lib/color-utils")
    updateCSSVariables("#00ff00")

    expect(document.documentElement.style.getPropertyValue("--kanari-artwork-hue-shift")).toBe("89.375deg")
  })
})
