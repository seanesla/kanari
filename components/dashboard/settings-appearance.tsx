"use client"

import { Paintbrush } from "@/lib/icons"
import { ColorPicker } from "./color-picker"
import { FontPicker } from "./font-picker"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { DEFAULT_SANS, DEFAULT_SERIF } from "@/lib/font-utils"
import type { FontFamily, SerifFamily } from "@/lib/types"
import { Deck } from "@/components/dashboard/deck"

interface SettingsAppearanceSectionProps {
  accentColor: string
  onAccentColorChange: (color: string) => void
  selectedSansFont: FontFamily
  onSansFontChange: (font: FontFamily) => void
  selectedSerifFont: SerifFamily
  onSerifFontChange: (font: SerifFamily) => void
  disableStartupAnimation: boolean
  onDisableStartupAnimationChange: (checked: boolean) => void
}

export function SettingsAppearanceSection({
  accentColor,
  onAccentColorChange,
  selectedSansFont,
  onSansFontChange,
  selectedSerifFont,
  onSerifFontChange,
  disableStartupAnimation,
  onDisableStartupAnimationChange,
}: SettingsAppearanceSectionProps) {
  return (
    <Deck className="p-6 transition-colors hover:bg-card/80">
      <div className="flex items-center gap-2 mb-6">
        <Paintbrush className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold font-serif">Appearance</h2>
      </div>

      <ColorPicker accentColor={accentColor} onAccentColorChange={onAccentColorChange} />

      <div className="mt-6 pt-6 border-t border-border">
        <FontPicker
          selectedSansFont={selectedSansFont}
          onSansFontChange={onSansFontChange}
          selectedSerifFont={selectedSerifFont}
          onSerifFontChange={onSerifFontChange}
          onResetFontsToDefault={() => {
            onSansFontChange(DEFAULT_SANS as FontFamily)
            onSerifFontChange(DEFAULT_SERIF as SerifFamily)
          }}
        />
      </div>

      <div className="mt-6 pt-6 border-t border-border">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="disable-startup-animation" className="text-base font-sans">
              Disable startup animation
            </Label>
            <p className="text-sm text-muted-foreground font-sans">
              Skip the animated logo when loading Kanari
            </p>
          </div>
          <Switch
            id="disable-startup-animation"
            checked={disableStartupAnimation}
            onCheckedChange={onDisableStartupAnimationChange}
            aria-label="Disable startup animation"
          />
        </div>
      </div>
    </Deck>
  )
}
