"use client"

import { useSceneMode } from "@/lib/scene-context"
import { SANS_FONTS, SERIF_FONTS, DEFAULT_SANS, DEFAULT_SERIF, FONT_CSS_VARIABLES } from "@/lib/font-utils"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function FontPicker() {
  const {
    selectedSansFont,
    setSansFont,
    selectedSerifFont,
    setSerifFont,
    resetFontsToDefault,
  } = useSceneMode()

  return (
    <div className="space-y-6">
      {/* Sans-serif Font Selector */}
      <div>
        <Label className="text-base font-serif">Body Font (Sans-serif)</Label>
        <p className="text-sm text-muted-foreground mb-3 font-sans">
          Used for UI text and general content
        </p>
        <Select value={selectedSansFont} onValueChange={setSansFont}>
          <SelectTrigger
            className="w-full"
            style={{ fontFamily: FONT_CSS_VARIABLES[selectedSansFont] }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SANS_FONTS.map((font) => (
              <SelectItem
                key={font.name}
                value={font.name}
                style={{ fontFamily: FONT_CSS_VARIABLES[font.name] }}
              >
                {font.name}{font.name === DEFAULT_SANS ? " (Default)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Serif Font Selector */}
      <div>
        <Label className="text-base font-serif">Heading Font (Serif)</Label>
        <p className="text-sm text-muted-foreground mb-3 font-sans">
          Used for headings and display text
        </p>
        <Select value={selectedSerifFont} onValueChange={setSerifFont}>
          <SelectTrigger
            className="w-full"
            style={{ fontFamily: FONT_CSS_VARIABLES[selectedSerifFont] }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SERIF_FONTS.map((font) => (
              <SelectItem
                key={font.name}
                value={font.name}
                style={{ fontFamily: FONT_CSS_VARIABLES[font.name] }}
              >
                {font.name}{font.name === DEFAULT_SERIF ? " (Default)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Reset to Defaults Button */}
      <div className="mt-6 flex items-center justify-end">
        <button
          onClick={resetFontsToDefault}
          className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-secondary/50 transition-colors"
          aria-label="Reset all fonts to their default values"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  )
}
