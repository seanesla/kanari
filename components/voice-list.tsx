"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { VoiceListItem } from "./voice-list-item"
import { useVoicePreview } from "@/hooks/use-voice-preview"
import { GEMINI_VOICES } from "@/lib/gemini/voices"
import type { GeminiVoice } from "@/lib/types"

interface VoiceListProps {
  selectedVoice: GeminiVoice | null
  onVoiceSelect: (voice: GeminiVoice) => void
  /** Height of the scrollable area (default: 300px) */
  height?: string
}

export function VoiceList({
  selectedVoice,
  onVoiceSelect,
  height = "300px",
}: VoiceListProps) {
  const preview = useVoicePreview()

  const handlePlayToggle = (voice: GeminiVoice) => {
    if (preview.currentVoice === voice && preview.state !== "idle") {
      preview.stop()
    } else {
      preview.play(voice)
    }
  }

  return (
    <div
      className="rounded-md border overflow-hidden"
      style={{ height }}
    >
      <ScrollArea className="h-full">
        <div className="p-2 space-y-1" role="listbox">
          {GEMINI_VOICES.map((voice) => (
            <VoiceListItem
              key={voice.name}
              voice={voice}
              isSelected={selectedVoice === voice.name}
              isPlaying={preview.currentVoice === voice.name}
              previewState={preview.state}
              onSelect={() => onVoiceSelect(voice.name)}
              onPlayToggle={() => handlePlayToggle(voice.name)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
