"use client"

import { Play, Square, Loader2, Check } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { VoiceInfo } from "@/lib/gemini/voices"
import type { PreviewState } from "@/hooks/use-voice-preview"

interface VoiceListItemProps {
  voice: VoiceInfo
  isSelected: boolean
  isPlaying: boolean
  previewState: PreviewState
  onSelect: () => void
  onPlayToggle: () => void
}

export function VoiceListItem({
  voice,
  isSelected,
  isPlaying,
  previewState,
  onSelect,
  onPlayToggle,
}: VoiceListItemProps) {
  const isLoading = isPlaying && previewState === "loading"
  const isPlayingAudio = isPlaying && previewState === "playing"

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors",
        "hover:bg-accent/10",
        isSelected && "bg-accent/20 border border-accent/30"
      )}
      onClick={onSelect}
      role="option"
      aria-selected={isSelected}
    >
      {/* Selection indicator */}
      <div
        className={cn(
          "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center",
          isSelected ? "border-accent bg-accent" : "border-muted-foreground/30"
        )}
      >
        {isSelected && <Check className="w-3 h-3 text-accent-foreground" />}
      </div>

      {/* Voice info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{voice.name}</p>
        <p className="text-xs text-muted-foreground">{voice.style}</p>
      </div>

      {/* Play button */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="flex-shrink-0"
        onClick={(e) => {
          e.stopPropagation() // Don't trigger selection
          onPlayToggle()
        }}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isPlayingAudio ? (
          <Square className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4" />
        )}
        <span className="sr-only">
          {isPlayingAudio ? "Stop preview" : "Play preview"}
        </span>
      </Button>
    </div>
  )
}
