/**
 * AI Chat Detail View
 *
 * Full chat session display for the main content area in the ChatGPT-style layout.
 * Shows session info, all messages, and mismatch indicators.
 * Extracted from ChatSessionDrawer for inline display.
 */

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { MessageSquare, Calendar, AlertCircle, Trash2 } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageBubble } from "@/components/check-in/message-bubble"
import { RecordingWaveform } from "@/components/dashboard/recording-waveform"
import { AudioPlayer } from "@/components/dashboard/audio-player"
import { formatDate, formatDurationWithUnits } from "@/lib/date-utils"
import { useTimeZone } from "@/lib/timezone-context"
import { useCoachAvatar } from "@/hooks/use-coach-avatar"
import { Deck } from "@/components/dashboard/deck"
import { VoiceBiomarkerReport } from "@/components/check-in/voice-biomarker-report"
import type { CheckInSession } from "@/lib/types"

interface AIChatDetailViewProps {
  session: CheckInSession
  onDelete: () => void
  highlightMessageId?: string | null
}

export function AIChatDetailView({
  session,
  onDelete,
  highlightMessageId,
}: AIChatDetailViewProps) {
  const { timeZone } = useTimeZone()
  const { avatarBase64: coachAvatar } = useCoachAvatar()
  // Calculate session duration
  const duration = session.duration ? formatDurationWithUnits(session.duration) : null

  // Determine if there were voice mismatches detected
  const hasMismatches = (session.mismatchCount ?? 0) > 0

  const [playheadPosition, setPlayheadPosition] = useState(0)
  const [seekPosition, setSeekPosition] = useState<number | undefined>(undefined)

  const [activeHighlightMessageId, setActiveHighlightMessageId] = useState<string | null>(null)

  const waveformWrapRef = useRef<HTMLDivElement | null>(null)
  const [waveformWidth, setWaveformWidth] = useState(() => {
    if (typeof window === "undefined") return 400
    return Math.max(240, Math.min(640, Math.floor(window.innerWidth - 48)))
  })

  const audioDataArray = useMemo(() => {
    const stored = session.audioData
    if (!stored) return null

    // New storage format: Float32Array (no copy)
    if (stored instanceof Float32Array) {
      return stored.length > 0 ? stored : null
    }

    // Legacy storage format: number[]
    if (stored.length === 0) return null
    return new Float32Array(stored)
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

  useEffect(() => {
    const el = waveformWrapRef.current
    if (!el || typeof ResizeObserver === "undefined") return

    const update = () => {
      const rect = el.getBoundingClientRect()
      if (!rect.width) return
      setWaveformWidth(Math.max(240, Math.min(640, Math.floor(rect.width))))
    }

    update()

    const observer = new ResizeObserver(() => update())
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!highlightMessageId) return

    setActiveHighlightMessageId(highlightMessageId)

    const timer = window.setTimeout(() => {
      const el = document.getElementById(`message-${highlightMessageId}`)
      el?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 150)

    const clear = window.setTimeout(() => setActiveHighlightMessageId(null), 2500)
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(clear)
    }
  }, [highlightMessageId])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-accent/30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-accent/10">
            <MessageSquare className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-semibold">AI Chat</h2>
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
      <div className="px-4 py-3 sm:px-6 border-b border-border/60">
        <Deck tone="quiet" className="p-3 space-y-2">
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
        </Deck>
      </div>

      {/* Messages scroll area */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-6">
          <Deck tone="default" className="p-4">
            <VoiceBiomarkerReport
              metrics={session.acousticMetrics}
              state="final"
              title="Voice biomarker report"
            />
          </Deck>

          {audioDataArray && (
            <Deck tone="default" className="p-4">
              <div className="flex justify-center mb-4">
                <div ref={waveformWrapRef} className="w-full max-w-xl">
                  <RecordingWaveform
                    mode="static"
                    audioData={audioDataArray}
                    width={waveformWidth}
                    height={80}
                    playheadPosition={playheadPosition}
                    onSeek={handleSeek}
                    className="border border-border/30 bg-background/50"
                  />
                </div>
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
            </Deck>
          )}

          {session.messages.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">No messages in this session</p>
            </div>
          ) : (
            session.messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                skipAnimation
                coachAvatar={coachAvatar}
                highlight={message.id === activeHighlightMessageId}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
