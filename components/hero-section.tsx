import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-32">
      {/* Subtle grid background */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:64px_64px]" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="grid gap-16 lg:grid-cols-2 lg:gap-24 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-4 py-1.5 text-sm">
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              Privacy-first burnout detection
            </div>

            <h1 className="text-5xl font-semibold leading-[1.1] tracking-tight md:text-6xl lg:text-7xl text-balance">
              Listen to
              <br />
              <span className="text-accent">your voice.</span>
            </h1>

            <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
              kanari analyzes your voice to detect early signs of burnout, predict risk days ahead, and schedule
              recovery time automatically—all processed in your browser.
            </p>

            <div className="flex flex-wrap gap-4">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90" asChild>
                <Link href="/dashboard">
                  Start Recording
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="#how-it-works">See How It Works</Link>
              </Button>
            </div>
          </div>

          {/* Hero visual - abstract data representation */}
          <div className="relative hidden lg:block">
            <HeroVisual />
          </div>
        </div>
      </div>
    </section>
  )
}

function HeroVisual() {
  return (
    <div className="relative h-[500px] w-full">
      {/* Main card */}
      <div className="absolute top-0 right-0 w-[380px] rounded-lg border border-border bg-card p-6 shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between mb-6">
          <span className="text-sm text-muted-foreground">Today's Check-in</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/20 px-2.5 py-0.5 text-xs font-medium text-success">
            LOW RISK
          </span>
        </div>

        <div className="space-y-4">
          <div className="flex items-end justify-between border-b border-border pb-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Stress Score</p>
              <p className="text-3xl font-semibold tabular-nums">24</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">Fatigue Score</p>
              <p className="text-3xl font-semibold tabular-nums">31</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">7-day trend</span>
            <span className="font-mono text-success">Stable</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Prediction</span>
            <span className="font-mono">Low risk next 5 days</span>
          </div>
        </div>
      </div>

      {/* Secondary card - offset */}
      <div className="absolute bottom-8 left-0 w-[320px] rounded-lg border border-border bg-card p-5 shadow-xl shadow-black/30">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground">Yesterday</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-medium text-accent">
            ELEVATED
          </span>
        </div>

        <div className="flex items-end gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Stress</p>
            <p className="text-2xl font-semibold tabular-nums">58</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Fatigue</p>
            <p className="text-2xl font-semibold tabular-nums text-accent">67</p>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">Recovery break scheduled for 3pm</p>
      </div>

      {/* Decorative elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-accent/5 blur-3xl" />
    </div>
  )
}
