/**
 * History Card Components
 *
 * Displays two types of check-in history items:
 * 1. VoiceNoteCard - voice note recording with audio playback
 * 2. AIChatCard - AI chat session with message preview
 *
 * Both cards show type badge, timestamp, metrics/preview, and action buttons.
 * VoiceNote can expand to show waveform and audio player.
 * AIChat can open a drawer to view full conversation.
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
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { RecordingWaveform } from "@/components/dashboard/recording-waveform"
import { AudioPlayer } from "@/components/dashboard/audio-player"
import { formatDuration, formatDate } from "@/lib/date-utils"
import type { Recording, CheckInSession, VoiceNoteHistoryItem, AIChatHistoryItem } from "@/lib/types"

/**
 * Helper function to get the appropriate trending icon based on stress level
 */
function getStressIcon(level?: string) {
  if (!level) return Minus
  if (level === "low" || level === "moderate") return TrendingDown
  return TrendingUp
}

/**
 * VoiceNoteCard Component
 *
 * Displays a voice note recording in the history timeline.
 * Shows metrics (stress/fatigue), can expand to show waveform and audio player.
 * If a chat was triggered from this recording, shows a link indicator.
 *
 * @param item - VoiceNoteHistoryItem with recording data
 * @param onDelete - Callback when delete button is clicked
 * @param onOpenChat - Callback when linked chat indicator is clicked
 * @param isHighlighted - Visual highlight state for new recordings
 */
interface VoiceNoteCardProps {
  item: VoiceNoteHistoryItem
  onDelete: () => void
  onOpenChat?: (sessionId: string) => void
  isHighlighted?: boolean
}

export function VoiceNoteCard({ item, onDelete, onOpenChat, isHighlighted }: VoiceNoteCardProps) {
  const { recording, linkedChatSessionId } = item
  const [isExpanded, setIsExpanded] = useState(false)
  const [playheadPosition, setPlayheadPosition] = useState(0)
  const [seekPosition, setSeekPosition] = useState<number | undefined>(undefined)

  const StressIcon = getStressIcon(recording.metrics?.stressLevel)
  const hasAudioData = recording.audioData && recording.audioData.length > 0

  // Convert audio data to Float32Array for waveform visualization
  const audioDataArray = useMemo(() => {
    if (!hasAudioData) return null
    return new Float32Array(recording.audioData!)
  }, [hasAudioData, recording.audioData])

  const handleTimeUpdate = useCallback((currentTime: number) => {
    if (recording.duration > 0) {
      setPlayheadPosition(currentTime / recording.duration)
    }
  }, [recording.duration])

  const handleSeek = useCallback((position: number) => {
    setPlayheadPosition(position)
    setSeekPosition(position)
  }, [])

  const toggleExpand = () => {
    if (hasAudioData) {
      setIsExpanded(!isExpanded)
      if (!isExpanded) {
        setPlayheadPosition(0)
      }
    }
  }

  return (
    <div
      id={`history-recording-${recording.id}`}
      className={cn(
        "group rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl transition-all duration-300 hover:border-accent/50 hover:bg-card/40 overflow-hidden",
        isHighlighted && "ring-2 ring-accent ring-offset-2 ring-offset-background animate-pulse"
      )}
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            {/* Type badge - Microphone icon in circle */}
            <div className="p-3 rounded-full bg-accent/10">
              <Mic className="h-5 w-5 text-accent" />
            </div>

            {/* Main content */}
            <div className="flex-1">
              {/* Type label */}
              <p className="text-xs font-semibold text-accent uppercase tracking-wide">Voice Note</p>

              {/* Date and duration */}
              <p className="text-sm text-muted-foreground mt-0.5">{formatDate(recording.createdAt)}</p>
              <p className="text-lg font-medium mt-1">
                {formatDuration(recording.duration)} recording
              </p>

              {/* Stress and fatigue metrics */}
              {recording.metrics && (
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1">
                    <StressIcon className="h-4 w-4 text-destructive" />
                    <span className="text-sm">Stress: {recording.metrics.stressScore}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-accent" />
                    <span className="text-sm">Fatigue: {recording.metrics.fatigueScore}</span>
                  </div>
                </div>
              )}

              {/* Status indicators */}
              {!recording.metrics && recording.status === "complete" && (
                <p className="text-sm text-muted-foreground mt-2">Analysis pending</p>
              )}
              {recording.status === "processing" && (
                <p className="text-sm text-accent mt-2">Processing...</p>
              )}
              {recording.status === "error" && (
                <p className="text-sm text-destructive mt-2">Analysis failed</p>
              )}

              {/* Link indicator - if a chat was triggered from this recording */}
              {linkedChatSessionId && (
                <button
                  onClick={() => onOpenChat?.(linkedChatSessionId)}
                  className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground hover:text-accent transition-colors"
                >
                  <MessageSquare className="h-3 w-3" />
                  <span>Chat followed</span>
                </button>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Expand/collapse button - only if audio data exists */}
            {hasAudioData && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleExpand}
                className="h-8 w-8"
                aria-expanded={isExpanded}
                aria-label={isExpanded ? "Collapse recording details" : "Expand recording details"}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            )}
            {/* Delete button - hidden until hover */}
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
              onClick={onDelete}
              aria-label="Delete recording"
            >
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded view - shows waveform and audio player */}
      {isExpanded && audioDataArray && (
        <div className="px-6 pb-6 pt-2 border-t border-border/50 space-y-4">
          {/* Waveform visualization */}
          <div className="flex justify-center">
            <RecordingWaveform
              mode="static"
              audioData={audioDataArray}
              width={400}
              height={60}
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
    </div>
  )
}

/**
 * AIChatCard Component
 *
 * Displays an AI chat session in the history timeline.
 * Shows message count, duration, first message preview, and any voice mismatches.
 * If triggered by a voice note, shows a link indicator.
 * Clicking the card opens a detail drawer to view the full conversation.
 *
 * @param item - AIChatHistoryItem with session data
 * @param onDelete - Callback when delete button is clicked
 * @param onOpenDetail - Callback when card is clicked to view details
 */
interface AIChatCardProps {
  item: AIChatHistoryItem
  onDelete: () => void
  onOpenDetail: () => void
}

export function AIChatCard({ item, onDelete, onOpenDetail }: AIChatCardProps) {
  const { session, linkedRecordingId } = item

  // Get first user message for preview (truncated)
  const firstUserMessage = session.messages.find((m) => m.role === "user")
  const preview = firstUserMessage
    ? firstUserMessage.content.slice(0, 60) + (firstUserMessage.content.length > 60 ? "..." : "")
    : "No messages"

  // Calculate session duration
  const duration = session.duration
    ? Math.floor(session.duration / 60) + "m " + (session.duration % 60) + "s"
    : "—"

  // Determine if there were voice mismatches detected
  const hasMismatches = session.mismatchCount && session.mismatchCount > 0

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenDetail}
      onKeyDown={(e) => {
        // Allow keyboard activation with Enter or Space
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpenDetail()
        }
      }}
      className={cn(
        "group text-left rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl transition-all duration-300 hover:border-accent/50 hover:bg-card/40 overflow-hidden w-full cursor-pointer"
      )}
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            {/* Type badge - Message icon in circle */}
            <div className="p-3 rounded-full bg-accent/10">
              <MessageSquare className="h-5 w-5 text-accent" />
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0">
              {/* Type label */}
              <p className="text-xs font-semibold text-accent uppercase tracking-wide">AI Chat</p>

              {/* Date and time */}
              <p className="text-sm text-muted-foreground mt-0.5">{formatDate(session.startedAt)}</p>

              {/* Duration and message count */}
              <p className="text-lg font-medium mt-1">
                {session.messages.length} messages • {duration}
              </p>

              {/* First message preview (truncated) */}
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{preview}</p>

              {/* Voice mismatch indicator */}
              {hasMismatches && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-yellow-600 dark:text-yellow-500">
                  <AlertCircle className="h-3 w-3" />
                  <span>{session.mismatchCount} voice patterns noted</span>
                </div>
              )}

              {/* Link indicator - if triggered by a voice note */}
              {linkedRecordingId && (
                <p className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                  <Mic className="h-3 w-3" />
                  <span>From voice note</span>
                </p>
              )}
            </div>
          </div>

          {/* Delete button - hidden until hover */}
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation() // Prevent opening detail view when deleting
              onDelete()
            }}
            aria-label="Delete chat session"
          >
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  )
}
