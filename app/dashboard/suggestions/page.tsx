"use client"

import { useEffect, useState } from "react"
import { Link } from "next-view-transitions"
import { Lightbulb, Mic, Calendar, Coffee, Dumbbell, Brain, Users, Check, X, Clock, Loader2 } from "lucide-react"
import { useSceneMode } from "@/lib/scene-context"
import { usePersistentSuggestions } from "@/hooks/use-suggestions"
import { cn } from "@/lib/utils"
import { DecorativeGrid } from "@/components/ui/decorative-grid"
import { Button } from "@/components/ui/button"
import { Empty } from "@/components/ui/empty"
import type { Suggestion } from "@/lib/types"

export default function SuggestionsPage() {
  const { setMode } = useSceneMode()
  const [visible, setVisible] = useState(false)
  const { suggestions, loading, error, updateSuggestion } = usePersistentSuggestions()

  // Set scene to dashboard mode
  useEffect(() => {
    setMode("dashboard")
  }, [setMode])

  // Trigger entry animation
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  // Filter to show only pending and accepted suggestions
  const activeSuggestions = suggestions.filter((s) => s.status === "pending" || s.status === "accepted")

  const categoryIcons: Record<Suggestion["category"], typeof Coffee> = {
    break: Coffee,
    exercise: Dumbbell,
    mindfulness: Brain,
    social: Users,
    rest: Calendar,
  }

  const categoryColors: Record<Suggestion["category"], string> = {
    break: "text-accent",
    exercise: "text-success",
    mindfulness: "text-purple-400",
    social: "text-blue-400",
    rest: "text-amber-400",
  }

  const handleAccept = (id: string) => {
    updateSuggestion(id, "accepted")
  }

  const handleDismiss = (id: string) => {
    updateSuggestion(id, "dismissed")
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

        {/* ERROR STATE */}
        {error && (
          <div
            className={cn(
              "relative mb-8 rounded-lg border border-destructive/50 bg-destructive/10 backdrop-blur-xl p-4 transition-all duration-1000 delay-150",
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
            )}
          >
            <p className="text-sm text-destructive">Error loading suggestions: {error}</p>
          </div>
        )}

        {/* LOADING STATE */}
        {loading && (
          <div
            className={cn(
              "relative mb-8 rounded-2xl border border-border/70 bg-card/30 backdrop-blur-xl p-12 transition-all duration-1000 delay-150",
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
            )}
          >
            <div className="flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
              <p className="text-muted-foreground">Generating personalized suggestions...</p>
            </div>
          </div>
        )}

        {/* SUGGESTIONS LIST */}
        <div
          className={cn(
            "relative transition-all duration-1000 delay-200",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
          )}
        >
          {!loading && activeSuggestions.length === 0 ? (
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
              {activeSuggestions.map((suggestion, index) => {
                const Icon = categoryIcons[suggestion.category]
                const colorClass = categoryColors[suggestion.category]

                return (
                  <div
                    key={suggestion.id}
                    className={cn(
                      "group relative rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl p-6 transition-all duration-500 hover:border-accent/50 hover:bg-card/40",
                      suggestion.status === "accepted" && "border-success/50 bg-success/5"
                    )}
                    style={{ transitionDelay: `${index * 50}ms` }}
                  >
                    {/* Category icon and duration */}
                    <div className="flex items-center justify-between mb-4">
                      <div className={cn("h-10 w-10 rounded-lg bg-card/50 flex items-center justify-center", colorClass)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{suggestion.duration} min</span>
                      </div>
                    </div>

                    {/* Status badge */}
                    {suggestion.status === "accepted" && (
                      <div className="absolute top-4 right-4">
                        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-success/20 text-success text-xs">
                          <Check className="h-3 w-3" />
                          <span>Accepted</span>
                        </div>
                      </div>
                    )}

                    {/* Category label */}
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
                      {suggestion.category}
                    </p>

                    {/* Content */}
                    <p className="text-sm leading-relaxed mb-4">{suggestion.content}</p>

                    {/* Rationale */}
                    <p className="text-xs text-muted-foreground mb-6 pb-6 border-b border-border/50">
                      {suggestion.rationale}
                    </p>

                    {/* Actions */}
                    {suggestion.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-success text-white hover:bg-success/90"
                          onClick={() => handleAccept(suggestion.id)}
                        >
                          <Check className="mr-1 h-3 w-3" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleDismiss(suggestion.id)}
                        >
                          <X className="mr-1 h-3 w-3" />
                          Dismiss
                        </Button>
                      </div>
                    )}

                    {suggestion.status === "accepted" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        asChild
                      >
                        <Link href="/dashboard/settings">
                          <Calendar className="mr-2 h-4 w-4" />
                          Schedule
                        </Link>
                      </Button>
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
                <Calendar className="h-5 w-5 text-accent" />
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
