"use client"

import { useEffect, useState } from "react"
import { Mic, MicOff, Square } from "lucide-react"
import { useSceneMode } from "@/lib/scene-context"
import { cn } from "@/lib/utils"
import { DecorativeGrid } from "@/components/ui/decorative-grid"
import { Button } from "@/components/ui/button"

export default function RecordPage() {
  const { setMode } = useSceneMode()
  const [visible, setVisible] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)

  // Set scene to dashboard mode
  useEffect(() => {
    setMode("dashboard")
  }, [setMode])

  // Trigger entry animation
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  // Recording timer
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((t) => t + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isRecording])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleStartRecording = () => {
    setIsRecording(true)
    setRecordingTime(0)
    // TODO: Implement actual recording with Web Audio API
  }

  const handleStopRecording = () => {
    setIsRecording(false)
    // TODO: Process recording
  }

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
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-6">Record</p>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif leading-[0.95] mb-6">
              Voice <span className="text-accent">check-in</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl">
              Speak naturally for 30-60 seconds about your day. Your voice carries signals of stress and fatigue that
              we'll analyze locally in your browser.
            </p>
          </div>
        </div>

        {/* RECORDING INTERFACE */}
        <div
          className={cn(
            "relative max-w-2xl mx-auto transition-all duration-1000 delay-200",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
          )}
        >
          <div className="rounded-2xl border border-border/70 bg-card/30 backdrop-blur-xl p-8 md:p-12">
            {/* Recording indicator */}
            <div className="text-center mb-8">
              <div
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm",
                  isRecording ? "bg-destructive/20 text-destructive" : "bg-muted/50 text-muted-foreground"
                )}
              >
                <span
                  className={cn("h-2 w-2 rounded-full", isRecording ? "bg-destructive animate-pulse" : "bg-muted")}
                />
                {isRecording ? "Recording..." : "Ready to record"}
              </div>
            </div>

            {/* Timer */}
            <div className="text-center mb-8">
              <p className="text-6xl md:text-8xl font-serif tabular-nums">{formatTime(recordingTime)}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {isRecording ? "Keep talking naturally" : "Recommended: 30-60 seconds"}
              </p>
            </div>

            {/* Recording button */}
            <div className="flex justify-center gap-4">
              {!isRecording ? (
                <Button
                  size="lg"
                  className="bg-accent text-accent-foreground hover:bg-accent/90 h-16 w-16 rounded-full p-0"
                  onClick={handleStartRecording}
                >
                  <Mic className="h-8 w-8" />
                </Button>
              ) : (
                <Button
                  size="lg"
                  variant="destructive"
                  className="h-16 w-16 rounded-full p-0"
                  onClick={handleStopRecording}
                >
                  <Square className="h-6 w-6" />
                </Button>
              )}
            </div>

            {/* Instructions */}
            <div className="mt-12 space-y-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Tips for best results:</p>
              <ul className="space-y-2 list-disc list-inside">
                <li>Find a quiet space with minimal background noise</li>
                <li>Speak naturally about how your day is going</li>
                <li>Don't worry about what you say—only voice patterns are analyzed</li>
                <li>Audio is processed locally and never uploaded</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
