/**
 * AI Chat Detail View
 *
 * Full chat session display for the main content area in the ChatGPT-style layout.
 * Shows session info, all messages, and mismatch indicators.
 * Extracted from ChatSessionDrawer for inline display.
 */

"use client"

import { useCallback, useMemo, useState } from "react"
import { MessageSquare, Calendar, AlertCircle, Trash2, Clock, TrendingUp, TrendingDown, Minus } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageBubble } from "@/components/check-in/message-bubble"
import { RecordingWaveform } from "@/components/dashboard/recording-waveform"
import { AudioPlayer } from "@/components/dashboard/audio-player"
import { formatDate, formatDurationWithUnits } from "@/lib/date-utils"
import { useTimeZone } from "@/lib/timezone-context"
import type { CheckInSession } from "@/lib/types"

interface AIChatDetailViewProps {
  session: CheckInSession
  onDelete: () => void
}

function scoreToBand(score: number | undefined): "low" | "medium" | "high" | "unknown" {
  if (score === undefined) return "unknown"
  if (score < 34) return "low"
  if (score < 67) return "medium"
  return "high"
}

export function AIChatDetailView({
  session,
  onDelete,
}: AIChatDetailViewProps) {
  const { timeZone } = useTimeZone()
  // Calculate session duration
  const duration = session.duration ? formatDurationWithUnits(session.duration) : null

  // Determine if there were voice mismatches detected
  const hasMismatches = (session.mismatchCount ?? 0) > 0

  const [playheadPosition, setPlayheadPosition] = useState(0)
  const [seekPosition, setSeekPosition] = useState<number | undefined>(undefined)

  const audioDataArray = useMemo(() => {
    if (!session.audioData || session.audioData.length === 0) return null
    return new Float32Array(session.audioData)
  }, [session.audioData])

  const handleTimeUpdate = useCallback(
    (currentTime: number) => {
      if ((session.duration ?? 0) > 0) {
        setPlayheadPosition(currentTime / (session.duration ?? 1))
      }
    },
    [session.duration]
  )

  const handleSeek = useCallback((position: number) => {
    setPlayheadPosition(position)
    setSeekPosition(position)
  }, [])

  const stressBand = scoreToBand(session.acousticMetrics?.stressScore)
  const fatigueBand = scoreToBand(session.acousticMetrics?.fatigueScore)

  const StressIcon = stressBand !== "unknown"
    ? stressBand === "high"
      ? TrendingUp
      : TrendingDown
    : Minus

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-accent/30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-accent/10">
            <MessageSquare className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">AI Chat</h2>
            <p className="text-sm text-muted-foreground">
              {session.messages.length} messages{duration && ` • ${duration}`}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          aria-label="Delete chat session"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Session info bar */}
      <div
        className="px-6 py-3 border-b border-accent/30 bg-foreground/5 backdrop-blur-xl space-y-2"
        style={{ boxShadow: '0 0 10px color-mix(in srgb, var(--accent) 10%, transparent)' }}
      >
        {/* Date */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{formatDate(session.startedAt, timeZone)}</span>
        </div>

        {/* Voice mismatch indicator */}
        {hasMismatches && (
          <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-500">
            <AlertCircle className="h-4 w-4" />
            <span>{session.mismatchCount} voice patterns detected</span>
          </div>
        )}

        {/* Session summary if available */}
        {session.summary && session.summary.positiveNotes.length > 0 && (
          <p className="text-sm text-muted-foreground italic border-t border-border/30 pt-2 mt-2">
            &ldquo;{session.summary.positiveNotes[0]}&rdquo;
          </p>
        )}
      </div>

      {/* Messages scroll area */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-6 py-6 space-y-6">
          {session.acousticMetrics && (
            <div
              className="rounded-lg border border-accent/30 bg-foreground/5 backdrop-blur-xl p-4"
              style={{ boxShadow: '0 0 15px color-mix(in srgb, var(--accent) 15%, transparent)' }}
            >
              <h3 className="text-sm font-medium mb-3">Voice Analysis</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                  <StressIcon className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="text-xs text-muted-foreground">Stress Level</p>
                    <p className="text-lg font-semibold capitalize">{stressBand}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
                  <Clock className="h-5 w-5 text-accent" />
                  <div>
                    <p className="text-xs text-muted-foreground">Fatigue Level</p>
                    <p className="text-lg font-semibold capitalize">{fatigueBand}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {audioDataArray && (
            <div
              className="rounded-lg border border-accent/30 bg-foreground/5 backdrop-blur-xl p-4"
              style={{ boxShadow: '0 0 15px color-mix(in srgb, var(--accent) 15%, transparent)' }}
            >
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
              <div className="max-w-md mx-auto">
                <AudioPlayer
                  audioData={audioDataArray}
                  sampleRate={session.sampleRate || 16000}
                  duration={session.duration ?? audioDataArray.length / 16000}
                  onTimeUpdate={handleTimeUpdate}
                  seekPosition={seekPosition}
                />
              </div>
            </div>
          )}

          {session.messages.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">No messages in this session</p>
            </div>
          ) : (
            session.messages.map((message) => (
              <MessageBubble key={message.id} message={message} skipAnimation />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
