"use client"

import { useSceneMode } from "@/lib/scene-context"
import { SANS_FONTS, SERIF_FONTS, MONO_FONTS } from "@/lib/font-utils"
import { Label } from "@/components/ui/label"

export function FontPicker() {
  const {
    selectedSansFont,
    setSansFont,
    selectedSerifFont,
    setSerifFont,
    selectedMonoFont,
    setMonoFont,
  } = useSceneMode()

  const handleSansChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSansFont(e.target.value)
  }

  const handleSerifChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSerifFont(e.target.value)
  }

  const handleMonoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setMonoFont(e.target.value)
  }

  return (
    <div className="space-y-6">
      {/* Sans-serif Font Selector */}
      <div>
        <Label className="text-base font-serif">Body Font (Sans-serif)</Label>
        <p className="text-sm text-muted-foreground mb-3 font-sans">
          Used for UI text and general content
        </p>
        <select
          value={selectedSansFont}
          onChange={handleSansChange}
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent font-sans"
        >
          {SANS_FONTS.map((font) => (
            <option key={font.name} value={font.name}>
              {font.name}
            </option>
          ))}
        </select>
      </div>

      {/* Serif Font Selector */}
      <div>
        <Label className="text-base font-serif">Heading Font (Serif)</Label>
        <p className="text-sm text-muted-foreground mb-3 font-sans">
          Used for headings and display text
        </p>
        <select
          value={selectedSerifFont}
          onChange={handleSerifChange}
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent font-sans"
        >
          {SERIF_FONTS.map((font) => (
            <option key={font.name} value={font.name}>
              {font.name}
            </option>
          ))}
        </select>
      </div>

      {/* Mono Font Selector */}
      <div>
        <Label className="text-base font-serif">Code Font (Monospace)</Label>
        <p className="text-sm text-muted-foreground mb-3 font-sans">
          Used for code and technical content
        </p>
        <select
          value={selectedMonoFont}
          onChange={handleMonoChange}
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent font-sans"
        >
          {MONO_FONTS.map((font) => (
            <option key={font.name} value={font.name}>
              {font.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
