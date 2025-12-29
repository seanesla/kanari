"use client"

import { useEffect, useState } from "react"
import { Link } from "next-view-transitions"
import { Lightbulb, Mic, Calendar, Coffee, Dumbbell, Brain, Users } from "lucide-react"
import { useSceneMode } from "@/lib/scene-context"
import { cn } from "@/lib/utils"
import { DecorativeGrid } from "@/components/ui/decorative-grid"
import { Button } from "@/components/ui/button"
import { Empty } from "@/components/ui/empty"

export default function SuggestionsPage() {
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

  // Placeholder - will be populated by Gemini API
  const suggestions: unknown[] = []

  const categoryIcons: Record<string, typeof Coffee> = {
    break: Coffee,
    exercise: Dumbbell,
    mindfulness: Brain,
    social: Users,
    rest: Calendar,
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
          {suggestions.length === 0 ? (
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
              {/* Suggestion cards will go here */}
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
