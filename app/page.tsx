"use client"

import { useEffect, useState } from "react"
import { useSceneMode } from "@/lib/scene-context"
import { useLenis } from "@/hooks/use-lenis"
import { useSectionObserver } from "@/hooks/use-section-observer"
import { EnterButton } from "@/components/enter-button"
import { FeaturesSection } from "@/components/features-section"
import { Footer } from "@/components/footer"
import { ScrollReveal } from "@/components/scroll-reveal"
import { KanariTextLogo } from "@/components/kanari-text-logo"
import { HeroColorPicker } from "@/components/hero-color-picker"
import { DemoTriggerButton } from "@/components/demo"

export default function LandingPage() {
  const [heroVisible, setHeroVisible] = useState(false)
  const { resetToLanding, isLoading } = useSceneMode()

  // Smooth scroll with inertia
  useLenis()

  // Scroll-aware section detection for navbar
  useSectionObserver()

  // Reset scene to landing mode when this page mounts
  useEffect(() => {
    resetToLanding()
  }, [resetToLanding])

  // Show content after loading animation completes
  useEffect(() => {
    if (!isLoading) {
      // Loading just finished - show hero after small delay
      const heroTimer = setTimeout(() => setHeroVisible(true), 200)
      return () => clearTimeout(heroTimer)
    }
  }, [isLoading])

  return (
    <div className="min-h-screen bg-transparent overflow-x-hidden">
      {/* Hero */}
      <section className="relative min-h-screen flex flex-col justify-center px-6 md:px-12" data-demo-id="demo-hero">
        <div className="relative z-10 max-w-3xl">
          {/* Brand name - large and prominent, clickable for color picker */}
          <div
            className={`text-accent mb-4 transition-all duration-1000 delay-200 ${
              heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <HeroColorPicker>
              <KanariTextLogo className="text-6xl md:text-8xl lg:text-9xl" />
            </HeroColorPicker>
          </div>
          <h1
            className={`text-5xl md:text-7xl lg:text-8xl font-serif leading-[0.9] tracking-tight mb-8 transition-all duration-1000 delay-400 ${
              heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            Your voice
            <br />
            <span className="text-accent">knows</span>
            <br />
            before you do.
          </h1>
          <p
            className={`text-muted-foreground text-lg md:text-xl max-w-md leading-relaxed mb-12 transition-all duration-1000 delay-600 ${
              heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            kanari detects early signs of burnout through your voice, predicts risk days ahead, and schedules recovery time automatically.
          </p>
          <div
            className={`flex items-center gap-4 transition-all duration-1000 delay-800 ${
              heroVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <EnterButton variant="hero" />
            <DemoTriggerButton />
          </div>
        </div>

        {/* Scroll indicator */}
        <div
          className={`absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 transition-all duration-1000 delay-1000 ${
            heroVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="w-px h-12 bg-gradient-to-b from-transparent via-foreground/30 to-foreground/50 animate-pulse" />
          <span className="text-xs text-muted-foreground tracking-widest uppercase">Scroll</span>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-border/50 bg-background/40 backdrop-blur-xl">
        <ScrollReveal>
          <div className="grid grid-cols-2 md:grid-cols-4">
            {[
              { value: "76%", label: "of workers experience burnout" },
              { value: "3-7", label: "days advance warning" },
              { value: "100%", label: "client-side processing", highlight: true },
              { value: "30s", label: "daily check-in" },
            ].map((stat, i) => (
              <div
                key={i}
                className="p-8 md:p-12 border-r border-border/50 last:border-r-0 border-b md:border-b-0 group hover:bg-foreground/5 transition-colors"
              >
                <p
                  className={`text-3xl md:text-5xl font-serif mb-2 transition-colors stat-breathe ${
                    stat.highlight ? "text-accent" : "group-hover:text-accent"
                  }`}
                >
                  {stat.value}
                </p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </section>

      {/* The Problem */}
      <section className="py-32 px-6 md:px-12 bg-background/50 backdrop-blur-xl">
        <ScrollReveal>
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-12 gap-12 lg:gap-24">
              <div className="lg:col-span-5">
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">The Problem</p>
                <h2 className="text-4xl md:text-5xl font-serif leading-[1.1]">You don't notice burnout until it's too late.</h2>
              </div>
              <div className="lg:col-span-6 lg:col-start-7 space-y-6 text-muted-foreground text-lg leading-relaxed">
                <p>
                  Burnout creeps up silently. By the time you feel exhausted, overwhelmed, or detached—the damage is
                  already done. Self-assessment fails because burnout impairs the very self-awareness needed to detect it.
                </p>
                <p>
                  Your voice tells a different story. Speech patterns, pause frequency, vocal energy—these biomarkers
                  shift days before you consciously feel the strain.
                </p>
                <p className="text-foreground font-medium border-l-2 border-accent pl-4">
                  Gallup reports 76% of employees experience burnout. Most only recognize it after the crash.
                </p>
                <p className="text-foreground font-medium">kanari listens. Predicts. Acts.</p>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* Features */}
      <section id="features" className="bg-background/40 backdrop-blur-xl">
        <ScrollReveal>
          <FeaturesSection />
        </ScrollReveal>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-32 px-6 md:px-12 bg-card/50 backdrop-blur-xl" data-demo-id="demo-how-it-works">
        <ScrollReveal>
          <div className="max-w-7xl mx-auto">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-16">How It Works</p>

            <div className="space-y-0">
              {[
                {
                  num: "01",
                  title: "Check in",
                  desc: "Speak naturally for 30-60 seconds about your day. No scripts, no prompts—just talk. Your voice carries the signal.",
                },
                {
                  num: "02",
                  title: "Analyze",
                  desc: "AI extracts vocal biomarkers entirely in your browser. Speech rate, pause patterns, spectral features—processed locally, never uploaded.",
                },
                {
                  num: "03",
                  title: "Predict",
                  desc: "Compare today's patterns against your baseline. Forecast burnout risk 3-7 days ahead with Gemini-powered insights.",
                },
                {
                  num: "04",
                  title: "Act",
                  desc: "Receive personalized recovery suggestions. Optionally schedule rest blocks directly to your calendar before you hit the wall.",
                },
              ].map((step, i) => (
                <div
                  key={i}
                  className="grid md:grid-cols-12 gap-6 py-12 border-b border-border/50 last:border-b-0 group hover:bg-foreground/5 transition-colors -mx-6 px-6"
                >
                  <div className="md:col-span-2">
                    <span className="text-6xl md:text-8xl font-serif text-foreground/10 group-hover:text-accent/30 transition-colors">
                      {step.num}
                    </span>
                  </div>
                  <div className="md:col-span-4">
                    <h3 className="text-2xl md:text-3xl font-medium">{step.title}</h3>
                  </div>
                  <div className="md:col-span-5 md:col-start-8">
                    <p className="text-muted-foreground text-lg leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* CTA */}
      <section className="py-32 px-6 md:px-12 bg-background/50 backdrop-blur-xl">
        <ScrollReveal>
          <div className="max-w-7xl mx-auto text-center">
            <h2 className="text-5xl md:text-7xl font-serif mb-8">Prevent the crash.</h2>
            <p className="text-muted-foreground text-xl mb-12 max-w-md mx-auto">
              Your voice knows what you don't. Let it protect you.
            </p>
            <EnterButton variant="cta" />
          </div>
        </ScrollReveal>
      </section>

      {/* Footer */}
      <div className="bg-background/70 backdrop-blur-xl">
        <Footer />
        <div className="border-t border-border/30 py-4 px-6 text-center">
          <p className="text-xs text-muted-foreground">Built for Google DeepMind Gemini 3 Hackathon 2025</p>
        </div>
      </div>
    </div>
  )
}
