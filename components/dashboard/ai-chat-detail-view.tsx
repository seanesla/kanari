/**
 * AI Chat Detail View
 *
 * Full chat session display for the main content area in the ChatGPT-style layout.
 * Shows session info, all messages, and mismatch indicators.
 * Extracted from ChatSessionDrawer for inline display.
 */

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { MessageSquare, Calendar, AlertCircle, Trash2 } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import { MessageBubble } from "@/components/check-in/message-bubble"
import { RecordingWaveform } from "@/components/dashboard/recording-waveform"
import { AudioPlayer } from "@/components/dashboard/audio-player"
import { formatDate, formatDurationWithUnits } from "@/lib/date-utils"
import { useTimeZone } from "@/lib/timezone-context"
import { useCoachAvatar } from "@/hooks/use-coach-avatar"
import { Deck } from "@/components/dashboard/deck"
import { VoiceBiomarkerReport } from "@/components/check-in/voice-biomarker-report"
import type { CheckInSession } from "@/lib/types"
import { db } from "@/lib/storage/db"

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
    return Math.max(180, Math.min(720, Math.floor(window.innerWidth - 40)))
  })

  const normalizeStoredAudio = useCallback((stored: unknown): Float32Array | null => {
    if (!stored) return null

    if (stored instanceof Float32Array) {
      return stored.length > 0 ? stored : null
    }

    if (Array.isArray(stored)) {
      if (stored.length === 0) return null
      return new Float32Array(stored)
    }

    if (
      typeof stored === "object"
      && stored !== null
      && "length" in stored
      && typeof (stored as { length: unknown }).length === "number"
    ) {
      try {
        const values = Array.from(stored as ArrayLike<number>)
        return values.length > 0 ? new Float32Array(values) : null
      } catch {
        return null
      }
    }

    return null
  }, [])

  const linkedRecordingAudio = useLiveQuery(async () => {
    if (!session.recordingId) return null

    const recording = await db.recordings.get(session.recordingId)
    if (!recording?.audioData) return null

    const audioData = normalizeStoredAudio(recording.audioData)
    if (!audioData) return null

    return {
      audioData,
      sampleRate: recording.sampleRate || 16000,
    }
  }, [session.id, session.recordingId, normalizeStoredAudio])

  const playbackAudio = useMemo(() => {
    const sessionAudio = normalizeStoredAudio(session.audioData)
    if (sessionAudio) {
      return {
        audioData: sessionAudio,
        sampleRate: session.sampleRate || 16000,
        source: "session" as const,
      }
    }

    // Legacy sessions may only carry `recordingId` (without copied session audio).
    // Use recording audio as a fallback so historical check-ins remain playable.
    // Pattern doc: docs/error-patterns/check-in-review-missing-audio-fallback.md
    if (linkedRecordingAudio?.audioData) {
      return {
        audioData: linkedRecordingAudio.audioData,
        sampleRate: linkedRecordingAudio.sampleRate,
        source: "recording" as const,
      }
    }

    return null
  }, [linkedRecordingAudio, normalizeStoredAudio, session.audioData, session.sampleRate])

  const audioDataArray = playbackAudio?.audioData ?? null
  const playbackSampleRate = playbackAudio?.sampleRate || 16000

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
        setWaveformWidth(Math.max(180, Math.min(720, Math.floor(rect.width))))
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
    <div className="flex h-full min-w-0 flex-col">
      {/* Header */}
      <div className="flex min-w-0 items-center justify-between border-b border-accent/30 px-3 py-2.5 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <div className="p-1.5 sm:p-2 rounded-full bg-accent/10">
            <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
          </div>
          <div>
            <h2 className="text-sm sm:text-lg font-semibold">AI Chat</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
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
      <div className="min-w-0 border-b border-border/60 px-3 py-2.5 sm:px-6">
        <Deck tone="quiet" className="min-w-0 space-y-2 p-2.5 sm:p-3">
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
      <div
        // Pattern doc: docs/error-patterns/mobile-report-right-edge-clipping.md
        className="min-w-0 flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
      >
        <div className="min-w-0 space-y-4 px-3 py-3 sm:space-y-6 sm:px-6 sm:py-6">
          <Deck tone="default" className="min-w-0 p-3 sm:p-4">
            <VoiceBiomarkerReport
              metrics={session.acousticMetrics}
              state="final"
              title="Voice biomarker report"
            />
          </Deck>

          {audioDataArray && (
            <Deck tone="default" className="min-w-0 p-3 sm:p-4">
              <div className="flex justify-center mb-3 sm:mb-4">
                <div ref={waveformWrapRef} className="w-full max-w-xl">
                  <RecordingWaveform
                    mode="static"
                    audioData={audioDataArray}
                    width={waveformWidth}
                    height={72}
                    playheadPosition={playheadPosition}
                    onSeek={handleSeek}
                    className="border border-border/30 bg-background/50"
                  />
                </div>
              </div>
              <div className="max-w-xl mx-auto w-full">
                <AudioPlayer
                  audioData={audioDataArray}
                  sampleRate={playbackSampleRate}
                  duration={session.duration ?? audioDataArray.length / playbackSampleRate}
                  onTimeUpdate={handleTimeUpdate}
                  seekPosition={seekPosition}
                />
                {playbackAudio?.source === "recording" ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Playback source: linked recording audio.
                  </p>
                ) : null}
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
      </div>
    </div>
  )
}
