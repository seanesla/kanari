"use client"

import { useCallback, useEffect, useState } from "react"
import { Link } from "next-view-transitions"
import { Mic, Clock, TrendingUp, TrendingDown, Minus, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import { useSceneMode } from "@/lib/scene-context"
import { cn } from "@/lib/utils"
import { DecorativeGrid } from "@/components/ui/decorative-grid"
import { Button } from "@/components/ui/button"
import { Empty } from "@/components/ui/empty"
import { useRecordings, useRecordingActions } from "@/hooks/use-storage"
import { RecordingWaveform } from "@/components/dashboard/recording-waveform"
import { AudioPlayer } from "@/components/dashboard/audio-player"
import type { Recording } from "@/lib/types"

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function getStressIcon(level?: string) {
  if (!level) return Minus
  if (level === "low" || level === "moderate") return TrendingDown
  return TrendingUp
}

function RecordingCard({ recording, onDelete }: { recording: Recording; onDelete: () => void }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [playheadPosition, setPlayheadPosition] = useState(0)
  // Track seek position separately to pass to AudioPlayer
  const [seekPosition, setSeekPosition] = useState<number | undefined>(undefined)
  const StressIcon = getStressIcon(recording.metrics?.stressLevel)

  const hasAudioData = recording.audioData && recording.audioData.length > 0

  const handleTimeUpdate = useCallback((currentTime: number) => {
    if (recording.duration > 0) {
      setPlayheadPosition(currentTime / recording.duration)
    }
  }, [recording.duration])

  const handleSeek = useCallback((position: number) => {
    setPlayheadPosition(position)
    // Update seekPosition to trigger AudioPlayer seek
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
    <div className="group rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl transition-all duration-300 hover:border-accent/50 hover:bg-card/40 overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            <div className="p-3 rounded-full bg-accent/10">
              <Mic className="h-5 w-5 text-accent" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">{formatDate(recording.createdAt)}</p>
              <p className="text-lg font-medium mt-1">
                {formatDuration(recording.duration)} recording
              </p>
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
              {!recording.metrics && recording.status === "complete" && (
                <p className="text-sm text-muted-foreground mt-2">Analysis pending</p>
              )}
              {recording.status === "processing" && (
                <p className="text-sm text-accent mt-2">Processing...</p>
              )}
              {recording.status === "error" && (
                <p className="text-sm text-destructive mt-2">Analysis failed</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasAudioData && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleExpand}
                className="h-8 w-8"
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
            </Button>
          </div>
        </div>
      </div>

      {/* Expandable audio player section */}
      {isExpanded && hasAudioData && (
        <div className="px-6 pb-6 pt-2 border-t border-border/50 space-y-4">
          <div className="flex justify-center">
            <RecordingWaveform
              mode="static"
              audioData={new Float32Array(recording.audioData!)}
              width={400}
              height={60}
              playheadPosition={playheadPosition}
              onSeek={handleSeek}
              className="border border-border/30 bg-background/50"
            />
          </div>
          <div className="max-w-md mx-auto">
            <AudioPlayer
              audioData={new Float32Array(recording.audioData!)}
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

export default function HistoryPage() {
  const { setMode } = useSceneMode()
  const [visible, setVisible] = useState(false)

  // Set scene to dashboard mode
  useEffect(() => {
    setMode("dashboard")
  }, [setMode])

  // Trigger entry animation
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  // Real data from IndexedDB
  const recordings = useRecordings()
  const { deleteRecording } = useRecordingActions()

  return (
    <div className="min-h-screen bg-transparent relative overflow-hidden">
      <main className="px-8 md:px-16 lg:px-20 pt-28 pb-12 relative z-10">
        {/* HERO SECTION */}
        <div className="relative mb-16">
          {/* Grid background */}
          <DecorativeGrid />

          {/* Decorative blur accents */}
          <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />

          {/* Content */}
          <div
            className={cn(
              "relative transition-all duration-1000 delay-100",
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
            )}
          >
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-6">History</p>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif leading-[0.95] mb-6">
              Recording <span className="text-accent">history</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl">
              View your past recordings and track how your stress and fatigue levels have changed over time.
            </p>
          </div>
        </div>

        {/* HISTORY LIST */}
        <div
          className={cn(
            "relative transition-all duration-1000 delay-200",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
          )}
        >
          {recordings.length === 0 ? (
            <div className="rounded-2xl border border-border/70 bg-card/30 backdrop-blur-xl p-12">
              <Empty
                icon={Clock}
                title="No recordings yet"
                description="Start recording to build your history and track wellness trends over time."
              >
                <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90 mt-4">
                  <Link href="/dashboard/record">
                    <Mic className="mr-2 h-4 w-4" />
                    Record Now
                  </Link>
                </Button>
              </Empty>
            </div>
          ) : (
            <div className="space-y-4">
              {recordings.map((recording) => (
                <RecordingCard
                  key={recording.id}
                  recording={recording}
                  onDelete={() => deleteRecording(recording.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
