/**
 * Voice Note Detail View
 *
 * Full voice note display for the main content area in the ChatGPT-style layout.
 * Shows all details including waveform, audio player, metrics, and emotion analysis.
 * Extracted from VoiceNoteCard's expanded state.
 */

"use client"

import { useState, useCallback, useMemo } from "react"
import {
  Mic,
  MessageSquare,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Trash2,
  Calendar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { RecordingWaveform } from "@/components/dashboard/recording-waveform"
import { AudioPlayer } from "@/components/dashboard/audio-player"
import { formatDate, formatDuration } from "@/lib/date-utils"
import type { Recording } from "@/lib/types"

interface VoiceNoteDetailViewProps {
  recording: Recording
  onDelete: () => void
  onOpenLinkedChat?: (sessionId: string) => void
  linkedChatSessionId?: string
}

/**
 * Helper function to get the appropriate trending icon based on stress level
 */
function getStressIcon(level?: string) {
  if (!level) return Minus
  if (level === "low" || level === "moderate") return TrendingDown
  return TrendingUp
}

export function VoiceNoteDetailView({
  recording,
  onDelete,
  onOpenLinkedChat,
  linkedChatSessionId,
}: VoiceNoteDetailViewProps) {
  const [playheadPosition, setPlayheadPosition] = useState(0)
  const [seekPosition, setSeekPosition] = useState<number | undefined>(undefined)

  const StressIcon = getStressIcon(recording.metrics?.stressLevel)
  const hasAudioData = recording.audioData && recording.audioData.length > 0

  // Convert audio data to Float32Array for waveform visualization
  const audioDataArray = useMemo(() => {
    if (!hasAudioData) return null
    return new Float32Array(recording.audioData!)
  }, [hasAudioData, recording.audioData])

  const handleTimeUpdate = useCallback(
    (currentTime: number) => {
      if (recording.duration > 0) {
        setPlayheadPosition(currentTime / recording.duration)
      }
    },
    [recording.duration]
  )

  const handleSeek = useCallback((position: number) => {
    setPlayheadPosition(position)
    setSeekPosition(position)
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-accent/10">
            <Mic className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Voice Note</h2>
            <p className="text-sm text-muted-foreground">
              {formatDuration(recording.duration)} recording
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          aria-label="Delete recording"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Date info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(recording.createdAt)}</span>
          </div>

          {/* Waveform visualization */}
          {audioDataArray && (
            <div className="rounded-lg border border-border/50 bg-card/30 p-4">
              <div className="flex justify-center mb-4">
                <RecordingWaveform
                  mode="static"
                  audioData={audioDataArray}
                  width={400}
                  height={80}
                  playheadPosition={playheadPosition}
                  onSeek={handleSeek}
                  className="border border-border/30 bg-background/50"
                />
              </div>

              {/* Audio player controls */}
              <div className="max-w-md mx-auto">
                <AudioPlayer
                  audioData={audioDataArray}
                  sampleRate={recording.sampleRate || 16000}
                  duration={recording.duration}
                  onTimeUpdate={handleTimeUpdate}
                  seekPosition={seekPosition}
                />
              </div>
            </div>
          )}

          {/* Metrics */}
          {recording.metrics && (
            <div className="rounded-lg border border-border/50 bg-card/30 p-4">
              <h3 className="text-sm font-medium mb-3">Voice Analysis</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                  <StressIcon className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="text-xs text-muted-foreground">Stress Level</p>
                    <p className="text-lg font-semibold">{recording.metrics.stressScore}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {recording.metrics.stressLevel}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                  <Clock className="h-5 w-5 text-accent" />
                  <div>
                    <p className="text-xs text-muted-foreground">Fatigue Level</p>
                    <p className="text-lg font-semibold">{recording.metrics.fatigueScore}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {recording.metrics.fatigueLevel}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Semantic analysis / emotional summary */}
          {recording.semanticAnalysis?.summary && (
            <div className="rounded-lg border border-border/50 bg-card/30 p-4">
              <h3 className="text-sm font-medium mb-2">Emotional Summary</h3>
              <p className="text-sm text-muted-foreground italic">
                {recording.semanticAnalysis.summary}
              </p>
            </div>
          )}

          {/* Status indicators */}
          {!recording.metrics && recording.status === "complete" && (
            <div className="rounded-lg border border-border/50 bg-card/30 p-4">
              <p className="text-sm text-muted-foreground">Analysis pending...</p>
            </div>
          )}
          {recording.status === "processing" && (
            <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
              <p className="text-sm text-accent">Processing audio...</p>
            </div>
          )}
          {recording.status === "error" && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm text-destructive">Analysis failed</p>
            </div>
          )}

          {/* Link to follow-up chat */}
          {linkedChatSessionId && (
            <button
              onClick={() => onOpenLinkedChat?.(linkedChatSessionId)}
              className="flex items-center gap-2 w-full p-3 rounded-lg border border-border/50 bg-card/30 text-sm text-muted-foreground hover:text-accent hover:border-accent/50 transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              <span>View follow-up AI chat</span>
            </button>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
