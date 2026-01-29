"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { motion, useReducedMotion } from "framer-motion"
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
import { cn } from "@/lib/utils"

export default function LandingPage() {
  const [heroVisible, setHeroVisible] = useState(false)
  const { resetToLanding, isLoading } = useSceneMode()
  const reduceMotion = useReducedMotion()

  const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]
  const stats = [
    { value: "76%", label: "of workers experience burnout" },
    { value: "3-7", label: "days advance warning" },
    { value: "100%", label: "client-side processing", highlight: true },
    { value: "30s", label: "daily check-in" },
  ]

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

  const heroContainer = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.14,
        delayChildren: reduceMotion ? 0 : 0.1,
      },
    },
  }

  const heroBrand = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985, filter: "blur(14px)" },
    show: reduceMotion
      ? { opacity: 1 }
      : {
          opacity: 1,
          y: 0,
          scale: 1,
          filter: "blur(0px)",
          transition: { duration: 1.0, ease: EASE },
        },
  }

  const heroLine = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: "110%", filter: "blur(10px)" },
    show: reduceMotion
      ? { opacity: 1 }
      : {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          transition: { duration: 1.15, ease: EASE },
        },
  }

  const heroFade = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 22, filter: "blur(10px)" },
    show: reduceMotion
      ? { opacity: 1 }
      : { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.9, ease: EASE } },
  }

  return (
    <div className="min-h-screen min-h-[100svh] bg-transparent overflow-x-hidden">
      {/* Hero */}
      <section
        className="relative min-h-screen min-h-[100svh] flex flex-col justify-center px-6 md:px-12 pt-24 pb-28 pt-[calc(6rem+env(safe-area-inset-top))] pb-[calc(7rem+env(safe-area-inset-bottom))] sm:pt-28 sm:pb-32 md:py-0"
        data-demo-id="demo-hero"
      >
        {/* Cinematic blooms */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden hidden sm:block">
          <motion.div
            className="absolute -top-32 sm:-top-40 left-1/2 h-[420px] w-[620px] sm:h-[520px] sm:w-[780px] -translate-x-1/2 rounded-full bg-accent/12 blur-3xl"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={
              heroVisible
                ? { opacity: 1, scale: 1, y: [0, -10, 0] }
                : { opacity: 0, scale: 0.96 }
            }
            transition={{
              opacity: { duration: 1.2, ease: EASE },
              scale: { duration: 1.2, ease: EASE },
              y: { duration: 6, repeat: heroVisible ? Infinity : 0, ease: "easeInOut" },
            }}
          />
          <motion.div
            className="absolute top-[55%] -left-40 sm:-left-48 h-[340px] w-[420px] sm:h-[420px] sm:w-[520px] rounded-full bg-foreground/5 blur-3xl"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={
              heroVisible
                ? { opacity: 1, scale: 1, y: [0, 14, 0] }
                : { opacity: 0, scale: 0.98 }
            }
            transition={{
              opacity: { duration: 1.35, ease: EASE, delay: 0.05 },
              scale: { duration: 1.35, ease: EASE, delay: 0.05 },
              y: { duration: 7.5, repeat: heroVisible ? Infinity : 0, ease: "easeInOut" },
            }}
          />
          <motion.div
            className="absolute bottom-[-180px] right-[-180px] sm:bottom-[-220px] sm:right-[-220px] h-[460px] w-[560px] sm:h-[620px] sm:w-[720px] rounded-full bg-accent/10 blur-3xl"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={
              heroVisible
                ? { opacity: 1, scale: 1, y: [0, -12, 0] }
                : { opacity: 0, scale: 0.98 }
            }
            transition={{
              opacity: { duration: 1.5, ease: EASE, delay: 0.1 },
              scale: { duration: 1.5, ease: EASE, delay: 0.1 },
              y: { duration: 8, repeat: heroVisible ? Infinity : 0, ease: "easeInOut" },
            }}
          />
        </div>

        <motion.div
          className="relative z-10 max-w-3xl"
          variants={heroContainer}
          initial="hidden"
          animate={heroVisible ? "show" : "hidden"}
        >
          {/* Brand name - large and prominent, clickable for color picker */}
          <motion.div className="text-accent mb-4" variants={heroBrand}>
            <HeroColorPicker>
              <KanariTextLogo className="text-[clamp(3.25rem,10vw,4.5rem)] sm:text-6xl md:text-8xl lg:text-9xl" />
            </HeroColorPicker>
          </motion.div>

          <h1 className="text-[clamp(2.5rem,8.5vw,3.25rem)] sm:text-5xl md:text-7xl lg:text-8xl font-serif leading-[0.95] sm:leading-[0.9] tracking-tight mb-8">
            <span className="block overflow-hidden">
              <motion.span className="block" variants={heroLine}>
                Your voice
              </motion.span>
            </span>
            <span className="block overflow-hidden">
              <motion.span className="block" variants={heroLine}>
                <span className="text-accent">knows</span>
              </motion.span>
            </span>
            <span className="block overflow-hidden">
              <motion.span className="block" variants={heroLine}>
                before you do.
              </motion.span>
            </span>
          </h1>

          <motion.p
            className="text-muted-foreground text-base sm:text-lg md:text-xl max-w-md leading-relaxed mb-10 sm:mb-12"
            variants={heroFade}
          >
            kanari detects early signs of burnout through your voice, predicts risk days ahead, and schedules recovery
            time automatically.
          </motion.p>

          <motion.div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 max-w-sm sm:max-w-none" variants={heroFade}>
            <motion.div
              whileHover={reduceMotion ? undefined : { scale: 1.03 }}
              whileTap={reduceMotion ? undefined : { scale: 0.99 }}
              className="w-full sm:w-auto"
            >
              <EnterButton variant="hero" className="w-full justify-center sm:w-auto sm:justify-start" />
            </motion.div>
            <motion.div
              whileHover={reduceMotion ? undefined : { scale: 1.03 }}
              whileTap={reduceMotion ? undefined : { scale: 0.99 }}
              className="w-full sm:w-auto"
            >
              <DemoTriggerButton className="w-full justify-center sm:w-auto sm:justify-start" />
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          initial={{ opacity: 0, y: 10 }}
          animate={heroVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.8, ease: EASE, delay: reduceMotion ? 0 : 1.1 }}
        >
          <div className="w-px h-12 bg-gradient-to-b from-transparent via-foreground/30 to-foreground/50 animate-pulse" />
          <span className="text-xs text-muted-foreground tracking-widest uppercase">Scroll</span>
        </motion.div>
      </section>

      {/* Stats */}
      <section className="border-t border-border/50 bg-background/40 backdrop-blur-none sm:backdrop-blur-xl">
        <ScrollReveal>
          <div className="grid grid-cols-2 md:grid-cols-4">
            {stats.map((stat, i) => (
              <div
                key={i}
                className={cn(
                  "p-6 sm:p-8 md:p-12 border-border/50 border-b group hover:bg-foreground/5 transition-colors",
                  i % 2 === 0 ? "border-r" : "border-r-0",
                  "md:border-b-0",
                  i === stats.length - 1 ? "md:border-r-0" : "md:border-r"
                )}
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
      <section className="py-20 sm:py-24 md:py-32 px-6 md:px-12 bg-background/50 backdrop-blur-none sm:backdrop-blur-xl">
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
      <section id="features" className="bg-background/40 backdrop-blur-none sm:backdrop-blur-xl">
        <ScrollReveal>
          <FeaturesSection />
        </ScrollReveal>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="py-20 sm:py-24 md:py-32 px-6 md:px-12 bg-card/50 backdrop-blur-none sm:backdrop-blur-xl"
        data-demo-id="demo-how-it-works"
      >
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
                <motion.div
                  key={i}
                  className="grid md:grid-cols-12 gap-6 py-12 border-b border-border/50 last:border-b-0 group hover:bg-foreground/5 transition-colors -mx-6 px-6"
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, filter: "blur(10px)" }}
                  whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
                  viewport={{ once: true, margin: "-120px 0px -80px 0px" }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { duration: 0.9, ease: EASE, delay: i * 0.08 }
                  }
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
                </motion.div>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-24 md:py-32 px-6 md:px-12 bg-background/50 backdrop-blur-none sm:backdrop-blur-xl">
        <ScrollReveal>
          <div className="max-w-7xl mx-auto text-center">
            <h2 className="text-4xl sm:text-5xl md:text-7xl font-serif mb-8">Prevent the crash.</h2>
            <p className="text-muted-foreground text-base sm:text-lg md:text-xl mb-12 max-w-md mx-auto">
              Your voice knows what you don't. Let it protect you.
            </p>
            <EnterButton variant="cta" />
          </div>
        </ScrollReveal>
      </section>

      {/* Cinematic artwork (endcap) */}
      <section className="py-14 sm:py-16 md:py-20 px-6 md:px-12 bg-background/60 backdrop-blur-none sm:backdrop-blur-xl">
        <ScrollReveal>
          <div className="max-w-7xl mx-auto">
            <figure className="group relative overflow-hidden rounded-[2rem] border border-border/50 bg-card/30 shadow-[0_30px_80px_-50px_rgba(0,0,0,0.9)]">
              <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                <div className="absolute inset-0 bg-gradient-to-tr from-accent/12 via-transparent to-foreground/5" />
                <div className="absolute inset-0 bg-accent/8 mix-blend-soft-light" />
                <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.08),transparent_55%)]" />
              </div>

              <motion.div
                className="relative"
                whileHover={reduceMotion ? undefined : { scale: 1.01 }}
                transition={reduceMotion ? undefined : { type: "spring", stiffness: 180, damping: 26 }}
              >
                <Image
                  src="/landing/kanari-orbital-crystal.png"
                  alt="A glowing crystal with orbital lines in a smoky atmosphere"
                  width={1600}
                  height={893}
                  sizes="(max-width: 768px) 100vw, 1200px"
                  className="w-full h-auto object-cover opacity-[0.96]"
                />
              </motion.div>

              <div aria-hidden="true" className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-foreground/10" />
            </figure>
          </div>
        </ScrollReveal>
      </section>

      {/* Footer */}
      <div className="bg-background/70 backdrop-blur-none sm:backdrop-blur-xl">
        <Footer />
        <div className="border-t border-border/30 py-4 px-6 text-center">
          <p className="text-xs text-muted-foreground">Built for Google DeepMind Gemini 3 Hackathon 2025</p>
        </div>
      </div>
    </div>
  )
}
