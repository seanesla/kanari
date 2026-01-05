"use client"

/**
 * Voice Picker Component
 *
 * Shown on first check-in when no voice has been selected.
 * Allows user to choose their AI assistant's voice before starting.
 * Includes preview functionality to hear each voice.
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Volume2 } from "lucide-react"
import { VoiceList } from "@/components/voice-list"
import type { GeminiVoice } from "@/lib/types"

interface VoicePickerProps {
  onVoiceSelected: (voice: GeminiVoice) => void
  isLoading?: boolean
}

export function VoicePicker({ onVoiceSelected, isLoading }: VoicePickerProps) {
  const [selectedVoice, setSelectedVoice] = useState<GeminiVoice | null>(null)

  return (
    <div className="flex flex-col items-center gap-6 p-4 max-w-md mx-auto">
      <div className="flex items-center gap-2 text-accent">
        <Volume2 className="h-6 w-6" />
        <h3 className="text-lg font-semibold font-serif">Choose Your AI Voice</h3>
      </div>

      <p className="text-sm text-muted-foreground text-center">
        Select a voice for your AI assistant. Tap the play button to preview.
        You can change this anytime in Settings.
      </p>

      <div className="w-full">
        <VoiceList
          selectedVoice={selectedVoice}
          onVoiceSelect={setSelectedVoice}
          height="250px"
        />
      </div>

      <Button
        onClick={() => selectedVoice && onVoiceSelected(selectedVoice)}
        disabled={!selectedVoice || isLoading}
        className="w-full max-w-xs"
      >
        {isLoading ? "Saving..." : "Continue"}
      </Button>
    </div>
  )
}
