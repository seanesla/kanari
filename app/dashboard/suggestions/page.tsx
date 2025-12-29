"use client"

import { useEffect, useState } from "react"
import { Link } from "next-view-transitions"
import { Lightbulb, Mic, Calendar as CalendarIcon, Coffee, Dumbbell, Brain, Users, CheckCircle2, Clock } from "lucide-react"
import { useSceneMode } from "@/lib/scene-context"
import { cn } from "@/lib/utils"
import { DecorativeGrid } from "@/components/ui/decorative-grid"
import { Button } from "@/components/ui/button"
import { Empty } from "@/components/ui/empty"
import { useCalendar } from "@/hooks/use-calendar"
import type { Suggestion } from "@/lib/types"

export default function SuggestionsPage() {
  const { setMode } = useSceneMode()
  const [visible, setVisible] = useState(false)
  const { isConnected, isLoading, scheduleEvent } = useCalendar()
  const [schedulingId, setSchedulingId] = useState<string | null>(null)
  const [localSuggestions, setLocalSuggestions] = useState<Suggestion[]>([])

  // Set scene to dashboard mode
  useEffect(() => {
    setMode("dashboard")
  }, [setMode])

  // Trigger entry animation
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  // Load suggestions (placeholder - will be populated by Gemini API)
  useEffect(() => {
    // Mock data for demonstration
    const mockSuggestions: Suggestion[] = [
      {
        id: "sugg_1",
        content: "Take a 15-minute walk outside to reset your nervous system",
        rationale: "Your voice analysis shows elevated stress markers. Light exercise can reduce cortisol levels.",
        duration: 15,
        category: "exercise",
        status: "pending",
        createdAt: new Date().toISOString(),
      },
      {
        id: "sugg_2",
        content: "Practice box breathing for 5 minutes",
        rationale: "Speech rate variability suggests tension. Controlled breathing activates the parasympathetic nervous system.",
        duration: 5,
        category: "mindfulness",
        status: "pending",
        createdAt: new Date().toISOString(),
      },
      {
        id: "sugg_3",
        content: "Schedule a coffee chat with a friend or colleague",
        rationale: "Social connection is a proven stress buffer. Your recent patterns suggest isolation.",
        duration: 30,
        category: "social",
        status: "pending",
        createdAt: new Date().toISOString(),
      },
    ]
    setLocalSuggestions(mockSuggestions)
  }, [])

  const handleSchedule = async (suggestion: Suggestion) => {
    setSchedulingId(suggestion.id)

    try {
      const recoveryBlock = await scheduleEvent(suggestion)

      if (recoveryBlock) {
        // Update suggestion status
        setLocalSuggestions((prev) =>
          prev.map((s) =>
            s.id === suggestion.id
              ? { ...s, status: "scheduled" as const, calendarEventId: recoveryBlock.calendarEventId }
              : s
          )
        )
      }
    } catch (error) {
      console.error("Failed to schedule:", error)
    } finally {
      setSchedulingId(null)
    }
  }

  const categoryIcons: Record<Suggestion["category"], typeof Coffee> = {
    break: Coffee,
    exercise: Dumbbell,
    mindfulness: Brain,
    social: Users,
    rest: CalendarIcon,
  }

  const categoryColors: Record<Suggestion["category"], string> = {
    break: "text-amber-500",
    exercise: "text-green-500",
    mindfulness: "text-purple-500",
    social: "text-blue-500",
    rest: "text-indigo-500",
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
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-6">Suggestions</p>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif leading-[0.95] mb-6">
              Recovery <span className="text-accent">actions</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl">
              Personalized suggestions powered by Gemini 3 based on your voice analysis patterns.
            </p>
          </div>
        </div>

        {/* SUGGESTIONS LIST */}
        <div
          className={cn(
            "relative transition-all duration-1000 delay-200",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
          )}
        >
          {localSuggestions.length === 0 ? (
            <div className="rounded-2xl border border-border/70 bg-card/30 backdrop-blur-xl p-12">
              <Empty
                icon={Lightbulb}
                title="No suggestions yet"
                description="Record a voice sample to receive personalized recovery suggestions based on your stress and fatigue patterns."
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
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {localSuggestions.map((suggestion, index) => {
                const Icon = categoryIcons[suggestion.category]
                const isScheduling = schedulingId === suggestion.id
                const isScheduled = suggestion.status === "scheduled"

                return (
                  <div
                    key={suggestion.id}
                    className={cn(
                      "rounded-xl border border-border/70 bg-card/30 backdrop-blur-xl p-6 transition-all duration-500",
                      visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
                    )}
                    style={{ transitionDelay: `${(index + 2) * 100}ms` }}
                  >
                    {/* Category Badge */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className={cn("h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center", categoryColors[suggestion.category])}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium capitalize">{suggestion.category}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {suggestion.duration} min
                      </div>
                    </div>

                    {/* Content */}
                    <h3 className="font-semibold mb-2 leading-snug">{suggestion.content}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{suggestion.rationale}</p>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {isScheduled ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full bg-success/10 border-success/20 text-success hover:bg-success/20"
                          disabled
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Scheduled
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleSchedule(suggestion)}
                            disabled={!isConnected || isScheduling}
                          >
                            {isScheduling ? (
                              <>
                                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Scheduling...
                              </>
                            ) : (
                              <>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                Schedule
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setLocalSuggestions((prev) =>
                                prev.map((s) => (s.id === suggestion.id ? { ...s, status: "accepted" as const } : s))
                              )
                            }}
                          >
                            Accept
                          </Button>
                        </>
                      )}
                    </div>

                    {/* Calendar not connected hint */}
                    {!isConnected && !isScheduled && (
                      <p className="text-xs text-muted-foreground mt-3">
                        <Link href="/dashboard/settings" className="text-accent hover:underline">
                          Connect calendar
                        </Link>{" "}
                        to schedule recovery blocks
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* HOW SUGGESTIONS WORK */}
        <div
          className={cn(
            "relative mt-16 rounded-2xl border border-border/70 bg-card/20 backdrop-blur-xl p-8 md:p-12 transition-all duration-1000 delay-300",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
          )}
        >
          <h2 className="text-2xl md:text-3xl font-serif mb-6">How suggestions work</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <Mic className="h-5 w-5 text-accent" />
              </div>
              <h3 className="font-semibold mb-2">1. Record</h3>
              <p className="text-sm text-muted-foreground">
                Your voice is analyzed for stress and fatigue biomarkers entirely in your browser.
              </p>
            </div>
            <div>
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <Brain className="h-5 w-5 text-accent" />
              </div>
              <h3 className="font-semibold mb-2">2. Analyze</h3>
              <p className="text-sm text-muted-foreground">
                Only numerical scores are sent to Gemini 3—never your audio or transcript.
              </p>
            </div>
            <div>
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <CalendarIcon className="h-5 w-5 text-accent" />
              </div>
              <h3 className="font-semibold mb-2">3. Act</h3>
              <p className="text-sm text-muted-foreground">
                Accept suggestions and optionally schedule recovery blocks on your calendar.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
