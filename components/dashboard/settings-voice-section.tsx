"use client"

import { Volume2 } from "lucide-react"
import { VoiceList } from "@/components/voice-list"
import type { GeminiVoice } from "@/lib/types"

interface SettingsVoiceSectionProps {
  selectedVoice: GeminiVoice | undefined
  onVoiceChange: (voice: GeminiVoice) => void
}

export function SettingsVoiceSection({
  selectedVoice,
  onVoiceChange,
}: SettingsVoiceSectionProps) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl p-6 transition-colors hover:bg-card/40">
      <div className="flex items-center gap-2 mb-4">
        <Volume2 className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold font-serif">AI Voice</h2>
      </div>

      <p className="text-sm text-muted-foreground mb-4 font-sans">
        Choose the voice your AI assistant will use during check-ins.
        Tap the play button to preview each voice.
      </p>

      <VoiceList
        selectedVoice={selectedVoice ?? null}
        onVoiceSelect={onVoiceChange}
        height="300px"
      />
    </div>
  )
}
