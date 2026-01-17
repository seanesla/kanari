export interface FontOption {
  name: string
  variable: string
  cssFamily: string
}

// Sans-serif fonts (18 options)
export const SANS_FONTS: FontOption[] = [
  { name: "Instrument Sans", variable: "--font-sans", cssFamily: '"Instrument Sans", system-ui' },
  { name: "Inter", variable: "--font-sans", cssFamily: '"Inter", system-ui' },
  { name: "DM Sans", variable: "--font-sans", cssFamily: '"DM Sans", system-ui' },
  { name: "Work Sans", variable: "--font-sans", cssFamily: '"Work Sans", system-ui' },
  { name: "Public Sans", variable: "--font-sans", cssFamily: '"Public Sans", system-ui' },
  { name: "Plus Jakarta Sans", variable: "--font-sans", cssFamily: '"Plus Jakarta Sans", system-ui' },
  { name: "Manrope", variable: "--font-sans", cssFamily: '"Manrope", system-ui' },
  { name: "Sora", variable: "--font-sans", cssFamily: '"Sora", system-ui' },
  { name: "Outfit", variable: "--font-sans", cssFamily: '"Outfit", system-ui' },
  { name: "Quicksand", variable: "--font-sans", cssFamily: '"Quicksand", system-ui' },
  { name: "Karla", variable: "--font-sans", cssFamily: '"Karla", system-ui' },
  { name: "Nunito Sans", variable: "--font-sans", cssFamily: '"Nunito Sans", system-ui' },
  { name: "Poppins", variable: "--font-sans", cssFamily: '"Poppins", system-ui' },
  { name: "Raleway", variable: "--font-sans", cssFamily: '"Raleway", system-ui' },
  { name: "Rubik", variable: "--font-sans", cssFamily: '"Rubik", system-ui' },
  { name: "Source Sans 3", variable: "--font-sans", cssFamily: '"Source Sans 3", system-ui' },
  { name: "Montserrat", variable: "--font-sans", cssFamily: '"Montserrat", system-ui' },
  { name: "Lexend", variable: "--font-sans", cssFamily: '"Lexend", system-ui' },
]

// Serif fonts (12 options)
export const SERIF_FONTS: FontOption[] = [
  { name: "Instrument Serif", variable: "--font-serif", cssFamily: '"Instrument Serif", Georgia' },
  { name: "Merriweather", variable: "--font-serif", cssFamily: '"Merriweather", Georgia' },
  { name: "Lora", variable: "--font-serif", cssFamily: '"Lora", Georgia' },
  { name: "Playfair Display", variable: "--font-serif", cssFamily: '"Playfair Display", Georgia' },
  { name: "IBM Plex Serif", variable: "--font-serif", cssFamily: '"IBM Plex Serif", Georgia' },
  { name: "Spectral", variable: "--font-serif", cssFamily: '"Spectral", Georgia' },
  { name: "Crimson Pro", variable: "--font-serif", cssFamily: '"Crimson Pro", Georgia' },
  { name: "Libre Baskerville", variable: "--font-serif", cssFamily: '"Libre Baskerville", Georgia' },
  { name: "Cardo", variable: "--font-serif", cssFamily: '"Cardo", Georgia' },
  { name: "Bitter", variable: "--font-serif", cssFamily: '"Bitter", Georgia' },
  { name: "Fraunces", variable: "--font-serif", cssFamily: '"Fraunces", Georgia' },
  { name: "EB Garamond", variable: "--font-serif", cssFamily: '"EB Garamond", Georgia' },
]

// Defaults
export const DEFAULT_SANS = "Instrument Sans"
export const DEFAULT_SERIF = "Instrument Serif"

// CSS variable mapping for font previews
export const FONT_CSS_VARIABLES: Record<string, string> = {
  // Sans
  "Instrument Sans": "var(--font-instrument-sans)",
  "Inter": "var(--font-inter)",
  "DM Sans": "var(--font-dm-sans)",
  "Work Sans": "var(--font-work-sans)",
  "Public Sans": "var(--font-public-sans)",
  "Plus Jakarta Sans": "var(--font-plus-jakarta-sans)",
  "Manrope": "var(--font-manrope)",
  "Sora": "var(--font-sora)",
  "Outfit": "var(--font-outfit)",
  "Quicksand": "var(--font-quicksand)",
  "Karla": "var(--font-karla)",
  "Nunito Sans": "var(--font-nunito-sans)",
  "Poppins": "var(--font-poppins)",
  "Raleway": "var(--font-raleway)",
  "Rubik": "var(--font-rubik)",
  "Source Sans 3": "var(--font-source-sans-3)",
  "Montserrat": "var(--font-montserrat)",
  "Lexend": "var(--font-lexend)",
  // Serif
  "Instrument Serif": "var(--font-instrument-serif)",
  "Merriweather": "var(--font-merriweather)",
  "Lora": "var(--font-lora)",
  "Playfair Display": "var(--font-playfair-display)",
  "IBM Plex Serif": "var(--font-ibm-plex-serif)",
  "Spectral": "var(--font-spectral)",
  "Crimson Pro": "var(--font-crimson-pro)",
  "Libre Baskerville": "var(--font-libre-baskerville)",
  "Cardo": "var(--font-cardo)",
  "Bitter": "var(--font-bitter)",
  "Fraunces": "var(--font-fraunces)",
  "EB Garamond": "var(--font-eb-garamond)",
}

/**
 * Update a CSS custom property (CSS variable) for font switching
 * Updates dashboard-scoped variables so landing page is unaffected
 */
export function updateFontVariable(variable: string, fontFamily: string): void {
  if (typeof document !== "undefined") {
    // Map global variables to dashboard-scoped variables
    const dashboardVariable = variable.replace("--font-", "--dashboard-font-")

    // Update both global and dashboard-scoped variables
    // Dashboard uses dashboard-scoped, landing uses global defaults
    document.documentElement.style.setProperty(dashboardVariable, fontFamily)
  }
}

/**
 * Get CSS family string for a font name
 */
export function getFontCssFamily(fontName: string, fontType: "sans" | "serif" = "sans"): string {
  const fontList = fontType === "sans" ? SANS_FONTS : SERIF_FONTS
  const font = fontList.find((f) => f.name === fontName)
  return font?.cssFamily || (fontType === "sans" ? '"Instrument Sans", system-ui' : '"Instrument Serif", Georgia')
}

/**
 * Check if a font name is valid
 */
export function isValidFont(fontName: string, fontType: "sans" | "serif"): boolean {
  const fontList = fontType === "sans" ? SANS_FONTS : SERIF_FONTS
  return fontList.some((f) => f.name === fontName)
}
