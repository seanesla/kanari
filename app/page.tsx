"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import Image from "next/image"
import { motion, useReducedMotion } from "framer-motion"
import { useRouter } from "next/navigation"
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
import { TrustSection } from "@/components/trust-section"

export default function LandingPage() {
  const [heroVisible, setHeroVisible] = useState(false)
  const heroSectionRef = useRef<HTMLElement | null>(null)
  const [heroOnScreen, setHeroOnScreen] = useState(true)
  const { resetToLanding, isLoading } = useSceneMode()
  const reduceMotion = useReducedMotion()
  const router = useRouter()

  const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]
  const stats = [
    { value: "30s", label: "daily voice check-in" },
    { value: "On-device", label: "acoustic features", highlight: true },
    { value: "Evidence", label: "quotes + breakdown" },
    { value: "3-7", label: "day trend forecast" },
  ]

  // Smooth scroll with inertia
  useLenis()

  // Scroll-aware section detection for navbar
  useSectionObserver()

  // Reset scene to landing mode when this page mounts
  useEffect(() => {
    resetToLanding()
  }, [resetToLanding])

  // Prefetch the app entry route early so the transition doesn't linger.
  useEffect(() => {
    router.prefetch("/overview")
  }, [router])

  // Show content after loading animation completes
  useEffect(() => {
    if (!isLoading) {
      // Loading just finished - show hero after small delay
      const heroTimer = setTimeout(() => setHeroVisible(true), 200)
      return () => clearTimeout(heroTimer)
    }
  }, [isLoading])

  useEffect(() => {
    const node = heroSectionRef.current
    if (!node) return
    if (typeof IntersectionObserver === "undefined") return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        setHeroOnScreen(entry.isIntersecting)
      },
      { threshold: 0.15 }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

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

  const bloomsVisible = heroVisible && heroOnScreen
  const bloomsActive = bloomsVisible && !reduceMotion

  return (
    <div className="min-h-screen min-h-[100svh] bg-transparent overflow-x-hidden">
      {/* Hero */}
      <section
        ref={heroSectionRef}
        className="relative min-h-screen min-h-[100svh] flex flex-col justify-center px-6 md:px-12 pt-24 pb-28 pt-[calc(6rem+env(safe-area-inset-top))] pb-[calc(7rem+env(safe-area-inset-bottom))] sm:pt-28 sm:pb-32 md:py-0"
        data-demo-id="demo-hero"
      >
        {/* Cinematic blooms */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -top-32 sm:-top-40 left-1/2 h-[420px] w-[620px] sm:h-[520px] sm:w-[780px] -translate-x-1/2 rounded-full bg-accent/12 blur-3xl"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={
              bloomsVisible
                ? { opacity: 1, scale: 1, y: bloomsActive ? [0, -10, 0] : 0 }
                : { opacity: 0, scale: 0.96, y: 0 }
            }
            transition={{
              opacity: { duration: 1.2, ease: EASE },
              scale: { duration: 1.2, ease: EASE },
              y: { duration: 6, repeat: bloomsActive ? Infinity : 0, ease: "easeInOut" },
            }}
          />
          <motion.div
            className="absolute top-[55%] -left-40 sm:-left-48 h-[340px] w-[420px] sm:h-[420px] sm:w-[520px] rounded-full bg-foreground/5 blur-3xl"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={
              bloomsVisible
                ? { opacity: 1, scale: 1, y: bloomsActive ? [0, 14, 0] : 0 }
                : { opacity: 0, scale: 0.98, y: 0 }
            }
            transition={{
              opacity: { duration: 1.35, ease: EASE, delay: 0.05 },
              scale: { duration: 1.35, ease: EASE, delay: 0.05 },
              y: { duration: 7.5, repeat: bloomsActive ? Infinity : 0, ease: "easeInOut" },
            }}
          />
          <motion.div
            className="absolute bottom-[-180px] right-[-180px] sm:bottom-[-220px] sm:right-[-220px] h-[460px] w-[560px] sm:h-[620px] sm:w-[720px] rounded-full bg-accent/10 blur-3xl"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={
              bloomsVisible
                ? { opacity: 1, scale: 1, y: bloomsActive ? [0, -12, 0] : 0 }
                : { opacity: 0, scale: 0.98, y: 0 }
            }
            transition={{
              opacity: { duration: 1.5, ease: EASE, delay: 0.1 },
              scale: { duration: 1.5, ease: EASE, delay: 0.1 },
              y: { duration: 8, repeat: bloomsActive ? Infinity : 0, ease: "easeInOut" },
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
            <span className="block overflow-hidden pb-[0.08em] -mb-[0.08em]">
              <motion.span className="block" variants={heroLine}>
                Your voice
              </motion.span>
            </span>
            <span className="block overflow-hidden pb-[0.08em] -mb-[0.08em]">
              <motion.span className="block" variants={heroLine}>
                <span className="text-accent">can hint</span>
              </motion.span>
            </span>
            <span className="block overflow-hidden pb-[0.08em] -mb-[0.08em]">
              <motion.span className="block" variants={heroLine}>
                before you notice.
              </motion.span>
            </span>
          </h1>

          <motion.p
            className="text-muted-foreground text-base sm:text-lg md:text-xl max-w-md leading-relaxed mb-10 sm:mb-12"
            variants={heroFade}
          >
            kanari estimates stress + fatigue signals from your voice patterns, tracks them over time, and turns rising
            risk into small recovery actions you can schedule. Not medical advice.
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

      {/* Single glass layer (reduces expensive backdrop-filter stacking) */}
      <div className="relative">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 bg-background/1 backdrop-blur-xl" />
        <div className="relative z-10">
          {/* Stats */}
          <section className="border-t border-border/50 bg-background/40">
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
                      className={`text-3xl md:text-5xl font-serif mb-2 transition-colors ${
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
          <section className="py-20 sm:py-24 md:py-32 px-6 md:px-12 bg-background/50">
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
                      can shift before you consciously feel the strain.
                    </p>
                    <p className="text-foreground font-medium border-l-2 border-accent pl-4">
                      Burnout is common. Most people only recognize it after the crash.
                    </p>
                    <p className="text-foreground font-medium">kanari listens. Estimates. Acts.</p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </section>

          {/* Features */}
          <section id="features" className="bg-background/40">
            <ScrollReveal>
              <FeaturesSection />
            </ScrollReveal>
          </section>

          <TrustSection />

          {/* How it works */}
          <section
            id="how-it-works"
            className="py-20 sm:py-24 md:py-32 px-6 md:px-12 bg-card/50"
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
                      desc: "Acoustic feature extraction runs in your browser (rhythm, pauses, energy, spectrum). During the live check-in, audio is streamed to Gemini for conversation and synthesis.",
                    },
                    {
                      num: "03",
                      title: "Predict",
                      desc: "Compare today against your baseline + recent trend. Compute a 3–7 day risk forecast (heuristic, not clinical) and generate evidence-backed insights.",
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
          <section className="py-20 sm:py-24 md:py-32 px-6 md:px-12 bg-background/50">
            <ScrollReveal>
              <div className="max-w-7xl mx-auto text-center">
                <h2 className="text-4xl sm:text-5xl md:text-7xl font-serif mb-8">Prevent the crash.</h2>
                <p className="text-muted-foreground text-base sm:text-lg md:text-xl mb-12 max-w-md mx-auto">
                  Your voice carries signals you may miss. Let it help you plan recovery.
                </p>
                <EnterButton variant="cta" />
              </div>
            </ScrollReveal>
          </section>

          {/* Cinematic artwork (endcap) */}
          <section className="py-14 sm:py-16 md:py-20 px-6 md:px-12 bg-background/60">
            <div className="max-w-7xl mx-auto">
              {/*
                Mobile browsers (esp. iOS Safari) can rasterize filtered + blended layers at a
                low internal resolution, which looks like pixelation. Keep the artwork clean
                on small screens; keep the cinematic treatment on desktop.
              */}
              <figure className="md:hidden kanari-artwork group relative overflow-hidden rounded-[2rem] border border-border/50 bg-card/30 shadow-[0_30px_80px_-50px_rgba(0,0,0,0.9)]">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                  <div className="absolute inset-0 bg-gradient-to-tr from-accent/12 via-transparent to-foreground/5" />
                  <div className="absolute inset-0 bg-accent/8" />
                  <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.08),transparent_55%)]" />
                </div>

                <Image
                  src="/landing/kanari-orbital-crystal.png"
                  alt="A glowing crystal with orbital lines in a smoky atmosphere"
                  width={1120}
                  height={625}
                  sizes="(max-width: 768px) 100vw, 1200px"
                  className="w-full h-auto object-cover opacity-[0.96]"
                />

                {/* Accent colorization pass (disabled on iOS/iPadOS Safari due to WebKit artifacts) */}
                <Image
                  src="/landing/kanari-orbital-crystal.png"
                  alt=""
                  aria-hidden="true"
                  width={1120}
                  height={625}
                  sizes="(max-width: 768px) 100vw, 1200px"
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none kanari-artwork-colorize"
                  style={
                    {
                      "--kanari-artwork-colorize-opacity": 0.55,
                      "--kanari-artwork-colorize-saturate": 2.0,
                      "--kanari-artwork-colorize-contrast": 1.03,
                    } as CSSProperties
                  }
                />

                <div aria-hidden="true" className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-foreground/10" />
              </figure>

              <motion.figure
                className="hidden md:block kanari-artwork group relative overflow-hidden rounded-[2rem] border border-border/50 bg-card/30 shadow-[0_30px_80px_-50px_rgba(0,0,0,0.9)]"
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, filter: "blur(10px)" }}
                  whileInView={
                    reduceMotion
                      ? { opacity: 1 }
                      : {
                          opacity: 1,
                          y: 0,
                          filter: "blur(0px)",
                          transition: { duration: 1.25, ease: EASE },
                        }
                  }
                  viewport={{ once: true, margin: "-120px 0px -80px 0px" }}
                >
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0">
                    <div className="absolute inset-0 bg-gradient-to-tr from-accent/12 via-transparent to-foreground/5" />
                    <div className="absolute inset-0 bg-accent/8 mix-blend-soft-light" />
                    <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.08),transparent_55%)]" />
                  </div>

                  {/* Minimalist reveal: clip-mask + soft focus settle */}
                  <motion.div
                    className="relative"
                    initial={
                      reduceMotion
                        ? { opacity: 1 }
                        : {
                            opacity: 0,
                            scale: 1.03,
                            filter: "blur(16px)",
                            clipPath: "inset(22% 26% 22% 26% round 28px)",
                          }
                    }
                    whileInView={
                      reduceMotion
                        ? { opacity: 1 }
                        : {
                            opacity: 1,
                            scale: 1,
                            filter: "blur(0px)",
                            clipPath: "inset(0% 0% 0% 0% round 32px)",
                            transition: { duration: 2.4, ease: EASE, delay: 0.22 },
                          }
                    }
                    viewport={{ once: true, margin: "-120px 0px -80px 0px" }}
                    whileHover={reduceMotion ? undefined : { scale: 1.01 }}
                    transition={reduceMotion ? undefined : { type: "spring", stiffness: 180, damping: 26 }}
                  >
                    <Image
                      src="/landing/kanari-orbital-crystal.png"
                      alt="A glowing crystal with orbital lines in a smoky atmosphere"
                      width={1120}
                      height={625}
                      sizes="(max-width: 768px) 100vw, 1200px"
                      className="w-full h-auto object-cover opacity-[0.96]"
                    />

                    {/* Accent colorization pass (disabled on iOS/iPadOS Safari due to WebKit artifacts) */}
                    <Image
                      src="/landing/kanari-orbital-crystal.png"
                      alt=""
                      aria-hidden="true"
                      width={1120}
                      height={625}
                      sizes="(max-width: 768px) 100vw, 1200px"
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none kanari-artwork-colorize"
                      style={
                        {
                          "--kanari-artwork-colorize-opacity": 0.6,
                          "--kanari-artwork-colorize-saturate": 2.2,
                          "--kanari-artwork-colorize-contrast": 1.05,
                        } as CSSProperties
                      }
                    />

                    {/* One-time sheen pass (ties to accent color) */}
                    {!reduceMotion && (
                      <motion.div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 mix-blend-soft-light"
                        initial={{ opacity: 0, x: "-120%" }}
                        whileInView={{ opacity: 1, x: "120%" }}
                        viewport={{ once: true, margin: "-120px 0px -80px 0px" }}
                        transition={{ duration: 2.2, ease: EASE, delay: 0.9 }}
                        style={{
                          background:
                            "linear-gradient(90deg, transparent 0%, oklch(from var(--accent) l c h / 0.10) 45%, transparent 60%)",
                        }}
                      />
                    )}
                  </motion.div>

                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-foreground/10" />
              </motion.figure>
            </div>
          </section>

          {/* Footer */}
          <div className="bg-background/70">
            <Footer />
            <div className="border-t border-border/30 py-4 px-6 text-center">
              <p className="text-xs text-muted-foreground">Built for Google DeepMind Gemini 3 Hackathon 2025</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
