"use client"

import { useState, useEffect } from "react"
import { HexColorPicker, HexColorInput } from "react-colorful"
import { Paintbrush } from "@/lib/icons"
import { updateCSSVariables } from "@/lib/color-utils"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"

interface ColorPickerProps {
  accentColor: string
  onAccentColorChange: (color: string) => void
}

export function ColorPicker({ accentColor, onAccentColorChange }: ColorPickerProps) {
  const [localColor, setLocalColor] = useState(accentColor)

  // Sync with context changes (initial load from IndexedDB)
  useEffect(() => {
    setLocalColor(accentColor)
  }, [accentColor])

  const handleColorChange = (newColor: string) => {
    setLocalColor(newColor)
    // Real-time preview
    updateCSSVariables(newColor)
    onAccentColorChange(newColor)
  }

  return (
    <div className="space-y-3">
      <Label className="text-base">Accent Color</Label>
      <p className="text-sm text-muted-foreground mb-3">
        Customize the accent color used throughout the app and 3D scene
      </p>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start gap-2 bg-transparent">
            <div
              className="w-4 h-4 rounded border border-border"
              style={{ backgroundColor: localColor }}
            />
            <span className="font-mono text-xs">{localColor.toUpperCase()}</span>
            <Paintbrush className="ml-auto h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <div className="space-y-3">
            <HexColorPicker color={localColor} onChange={handleColorChange} />
            <HexColorInput
              color={localColor}
              onChange={handleColorChange}
              prefixed
              className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm font-mono focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
