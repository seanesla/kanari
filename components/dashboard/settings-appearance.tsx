"use client"

import { Paintbrush } from "lucide-react"
import { ColorPicker } from "./color-picker"
import { FontPicker } from "./font-picker"

export function SettingsAppearanceSection() {
  return (
    <div className="rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl p-6 transition-colors hover:bg-card/40">
      <div className="flex items-center gap-2 mb-6">
        <Paintbrush className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold font-serif">Appearance</h2>
      </div>

      <ColorPicker />

      <div className="mt-6 pt-6 border-t border-border">
        <FontPicker />
      </div>
    </div>
  )
}

