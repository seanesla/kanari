"use client"

import { Gauge } from "@/lib/icons"
import { Deck } from "@/components/dashboard/deck"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { GRAPHICS_PRESET_OPTIONS } from "@/lib/graphics/quality"
import type { GraphicsQuality } from "@/lib/types"

interface SettingsGraphicsSectionProps {
  graphicsQuality: GraphicsQuality
  onGraphicsQualityChange: (quality: GraphicsQuality) => void
}

export function SettingsGraphicsSection({
  graphicsQuality,
  onGraphicsQualityChange,
}: SettingsGraphicsSectionProps) {
  return (
    <Deck className="p-6 transition-colors hover:bg-card/80">
      <div className="flex items-center gap-2 mb-6">
        <Gauge className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold font-serif">Graphics</h2>
      </div>

      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Graphics quality</Label>
        <RadioGroup
          value={graphicsQuality}
          onValueChange={(value) => onGraphicsQualityChange(value as GraphicsQuality)}
          className="gap-2"
        >
          {GRAPHICS_PRESET_OPTIONS.map((option) => (
            <label
              key={option.value}
              htmlFor={`graphics-${option.value}`}
              className={cn(
                "flex items-start gap-3 rounded-xl border border-border/50 bg-card/20 px-4 py-3 transition-colors",
                graphicsQuality === option.value
                  ? "border-accent/40 bg-card/30"
                  : "hover:border-accent/20"
              )}
            >
              <RadioGroupItem value={option.value} id={`graphics-${option.value}`} className="mt-1" />
              <div className="space-y-1">
                <p className="font-medium text-sm">{option.label}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
            </label>
          ))}
        </RadioGroup>
      </div>
    </Deck>
  )
}
