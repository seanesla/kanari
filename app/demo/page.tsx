"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { useSceneMode } from "@/lib/scene-context"
import { X, ArrowLeft, ArrowRight } from "@/lib/icons"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getDemoVideoSources } from "@/lib/demo/demo-video-sources"

type DemoSlide = {
  id: string
  title: string
  subtitle: string
  bullets: string[]
  media: {
    poster: string
    webm?: string
    mp4?: string
    fallbackImage: string
    replaceHint: string
  }
}

const SLIDES: DemoSlide[] = [
  {
    id: "check-in",
    title: "Voice check-in (Gemini Live)",
    subtitle: "A 30-60s conversation that feels natural, not like a form.",
    bullets: [
      "Real-time streaming with Gemini Live (mic -> conversation -> live responses)",
      "Captures session + transcript for later review in History",
      "Designed for daily use: low friction, fast feedback",
    ],
    media: {
      poster: "/demo/posters/01-checkin.svg",
      webm: "/demo/01-checkin.webm",
      mp4: "/demo/01-checkin.mp4",
      fallbackImage: "/demo/posters/01-checkin.svg",
      replaceHint: "Drop your recording at public/demo/01-checkin.webm (or .mp4)",
    },
  },
  {
    id: "biomarkers",
    title: "Client-side acoustic biomarkers",
    subtitle: "Stress/fatigue signal extraction happens in the browser for privacy.",
    bullets: [
      "Acoustic features extracted locally (no server needed for biomarker math)",
      "Only audio semantics go to Gemini; raw trends stay on-device",
      "This is the privacy-first core: analysis near the user",
    ],
    media: {
      poster: "/demo/posters/02-biomarkers.svg",
      webm: "/demo/02-biomarkers.webm",
      mp4: "/demo/02-biomarkers.mp4",
      fallbackImage: "/demo/posters/02-biomarkers.svg",
      replaceHint: "Drop your recording at public/demo/02-biomarkers.webm (or .mp4)",
    },
  },
  {
    id: "insights",
    title: "Insights + journal synthesis",
    subtitle: "Gemini turns a check-in into insights and a short journal entry.",
    bullets: [
      "Post-check-in synthesis (Gemini Flash) generates insights + journaling",
      "Saved locally (IndexedDB) so users keep ownership of their data",
      "Creates a longitudinal narrative, not just a score",
    ],
    media: {
      poster: "/demo/posters/03-insights.svg",
      webm: "/demo/03-insights.webm",
      mp4: "/demo/03-insights.mp4",
      fallbackImage: "/demo/posters/03-insights.svg",
      replaceHint: "Drop your recording at public/demo/03-insights.webm (or .mp4)",
    },
  },
  {
    id: "forecast",
    title: "Burnout risk forecast (3-7 days)",
    subtitle: "Trend-based forecasting that flags risk before you consciously feel it.",
    bullets: [
      "Turns recent biomarker trends into a risk level + confidence",
      "Explains contributing factors so the result feels actionable",
      "Shows trend charts to prove it's longitudinal, not a one-off score",
    ],
    media: {
      poster: "/demo/posters/04-forecast.svg",
      webm: "/demo/04-forecast.webm",
      mp4: "/demo/04-forecast.mp4",
      fallbackImage: "/demo/posters/04-forecast.svg",
      replaceHint: "Drop your recording at public/demo/04-forecast.webm (or .mp4)",
    },
  },
  {
    id: "suggestions",
    title: "Recovery suggestions (Kanban)",
    subtitle: "A clear action list that stays lightweight: Pending -> Scheduled -> Completed.",
    bullets: [
      "Suggestions generated from today + historical context",
      "Regenerate with a diff so the user sees what changed",
      "Workflow-friendly: triage, schedule, complete",
    ],
    media: {
      poster: "/demo/posters/05-suggestions.svg",
      webm: "/demo/05-suggestions.webm",
      mp4: "/demo/05-suggestions.mp4",
      fallbackImage: "/demo/posters/05-suggestions.svg",
      replaceHint: "Drop your recording at public/demo/05-suggestions.webm (or .mp4)",
    },
  },
  {
    id: "calendar",
    title: "Calendar scheduling + recovery blocks",
    subtitle: "Turn recommendations into protected time (prevention loop).",
    bullets: [
      "Schedule blocks with drag/drop + quick time picker",
      "Persists scheduled recovery blocks locally",
      "Optional Google Calendar integration for real-world follow-through",
    ],
    media: {
      poster: "/demo/posters/06-calendar.svg",
      webm: "/demo/06-calendar.webm",
      mp4: "/demo/06-calendar.mp4",
      fallbackImage: "/demo/posters/06-calendar.svg",
      replaceHint: "Drop your recording at public/demo/06-calendar.webm (or .mp4)",
    },
  },
  {
    id: "history",
    title: "Check-in history timeline",
    subtitle: "A unified place to browse past sessions and outcomes.",
    bullets: [
      "ChatGPT-style history layout with fast navigation",
      "Stores sessions locally (offline-first, instant load)",
      "Supports bulk selection + delete for control",
    ],
    media: {
      poster: "/demo/posters/07-history.svg",
      webm: "/demo/07-history.webm",
      mp4: "/demo/07-history.mp4",
      fallbackImage: "/demo/posters/07-history.svg",
      replaceHint: "Drop your recording at public/demo/07-history.webm (or .mp4)",
    },
  },
  {
    id: "achievements",
    title: "Achievements + streaks (auto-tracked)",
    subtitle: "Lightweight motivation to help users actually form the habit.",
    bullets: [
      "Daily challenges + streaks are generated from real usage",
      "Progress is auto-tracked from recordings/suggestions/sessions",
      "Keeps engagement without turning the app into a game",
    ],
    media: {
      poster: "/demo/posters/08-achievements.svg",
      webm: "/demo/08-achievements.webm",
      mp4: "/demo/08-achievements.mp4",
      fallbackImage: "/demo/posters/08-achievements.svg",
      replaceHint: "Drop your recording at public/demo/08-achievements.webm (or .mp4)",
    },
  },
  {
    id: "coach",
    title: "Personalized coach (voice + avatar)",
    subtitle: "A more human interface that makes check-ins easier to stick with.",
    bullets: [
      "Voice selection + previews during onboarding",
      "Avatar generation for a consistent coach identity",
      "Preferences: reminders + accountability mode",
    ],
    media: {
      poster: "/demo/posters/09-coach.svg",
      webm: "/demo/09-coach.webm",
      mp4: "/demo/09-coach.mp4",
      fallbackImage: "/demo/posters/09-coach.svg",
      replaceHint: "Drop your recording at public/demo/09-coach.webm (or .mp4)",
    },
  },
  {
    id: "privacy",
    title: "Privacy-first + BYO Gemini API key",
    subtitle: "No accounts required; users keep control of credentials and data.",
    bullets: [
      "User supplies Gemini API key in Settings (no server env fallback)",
      "Local-first data model: IndexedDB sessions, suggestions, journals",
      "Designed for trust: clear boundaries on what leaves the device",
    ],
    media: {
      poster: "/demo/posters/10-privacy.svg",
      webm: "/demo/10-privacy.webm",
      mp4: "/demo/10-privacy.mp4",
      fallbackImage: "/demo/posters/10-privacy.svg",
      replaceHint: "Drop your recording at public/demo/10-privacy.webm (or .mp4)",
    },
  },
]

function DemoFeatureTour() {
  const router = useRouter()
  const { resetToLanding } = useSceneMode()

  const [index, setIndex] = useState(0)
  const [pendingIndex, setPendingIndex] = useState<number | null>(null)
  const pendingIndexRef = useRef<number | null>(null)
  const [showSlide, setShowSlide] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)
  // We intentionally start in an "unknown" state so the first paint always
  // renders the video frame (with poster) instead of briefly flashing the
  // dev-only "drop file" hint.
  //
  // Also: keep status scoped to the active slide so we never momentarily reuse
  // the previous slide's status during transitions.
  const [mediaState, setMediaState] = useState<{
    slideId: string
    status: "unknown" | "available" | "missing"
  }>(() => ({ slideId: SLIDES[0]?.id ?? "", status: "unknown" }))
  const [isClosing, setIsClosing] = useState(false)

  // Keep the landing scene/background while we show the demo.
  useEffect(() => {
    resetToLanding()
  }, [resetToLanding])

  const slide = SLIDES[index]!
  const videoSources = useMemo(() => getDemoVideoSources(slide.media), [slide.media.mp4, slide.media.webm])
  const mediaStatus = mediaState.slideId === slide.id ? mediaState.status : "unknown"

  // Use the latest requested index (if any) for button enable/disable.
  const effectiveIndex = pendingIndex ?? index
  const canPrev = effectiveIndex > 0
  const canNext = effectiveIndex < SLIDES.length - 1

  const handleExit = useCallback(() => {
    setIsClosing(true)
  }, [])

  const requestIndex = useCallback(
    (nextIndex: number) => {
      if (isClosing) return
      const clamped = Math.min(Math.max(0, nextIndex), SLIDES.length - 1)

      pendingIndexRef.current = clamped
      setPendingIndex(clamped)

      if (!isTransitioning) {
        setIsTransitioning(true)
        setShowSlide(false)
      }
    },
    [isClosing, isTransitioning]
  )

  const goPrev = useCallback(() => {
    const base = pendingIndexRef.current ?? index
    requestIndex(base - 1)
  }, [index, requestIndex])

  const goNext = useCallback(() => {
    const base = pendingIndexRef.current ?? index
    requestIndex(base + 1)
  }, [index, requestIndex])

  // Avoid broken video controls in dev: only show <video> if the file exists.
  useEffect(() => {
    let cancelled = false

    const check = async () => {
      setMediaState({ slideId: slide.id, status: "unknown" })
      const candidates = videoSources.map((source) => source.src)
      for (const url of candidates) {
        try {
          const res = await fetch(url, { method: "HEAD" })
          if (res.ok) {
            if (!cancelled) setMediaState({ slideId: slide.id, status: "available" })
            return
          }
        } catch {
          // ignore
        }
      }

      if (!cancelled) setMediaState({ slideId: slide.id, status: "missing" })
    }

    void check()
    return () => {
      cancelled = true
    }
  }, [slide.id, videoSources])

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        goPrev()
      }
      if (e.key === "ArrowRight") {
        goNext()
      }
      if (e.key === "Escape") {
        handleExit()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [goNext, goPrev, handleExit])

  const dots = useMemo(() => {
    return SLIDES.map((s, i) => ({ id: s.id, index: i, isActive: i === index }))
  }, [index])

  return (
    <motion.div
      className="min-h-screen overflow-x-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: isClosing ? 0 : 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      onAnimationComplete={() => {
        if (isClosing) router.push("/")
      }}
    >
      {/* Dim overlay to soften the Kanari Core background */}
      <div className="pointer-events-none fixed inset-0 bg-background/80" />

      {/* Background atmosphere */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-[520px] w-[780px] -translate-x-1/2 rounded-full bg-accent/12 blur-3xl" />
        <div className="absolute top-[35vh] -left-32 h-[420px] w-[520px] rounded-full bg-foreground/6 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[-140px] h-[520px] w-[680px] rounded-full bg-accent/10 blur-3xl" />
      </div>

      <main className="relative min-h-screen px-6 md:px-12 lg:px-16 pt-[calc(env(safe-area-inset-top)+6.5rem)] md:pt-[8.5rem] pb-[calc(env(safe-area-inset-bottom)+2.5rem)]">
        <div className="mx-auto flex min-h-[calc(100vh-(env(safe-area-inset-top)+6.5rem)-(env(safe-area-inset-bottom)+2.5rem))] max-w-screen-2xl flex-col">
          <header className="flex items-center justify-between gap-4 mb-10 md:mb-12">
            <Button
              variant="outline"
              onClick={handleExit}
              disabled={isClosing}
              className="gap-2 bg-background/70 backdrop-blur border-border/80"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Exit demo</span>
              <span className="sm:hidden">Exit</span>
            </Button>

            <div className="text-xs uppercase tracking-widest text-foreground/60 tabular-nums">
              Demo - {index + 1}/{SLIDES.length}
            </div>
          </header>

          {/*
            Important: the slide content must NOT be mounted twice in normal document flow.
            If both the exiting + entering slides are present simultaneously, the page height
            doubles briefly and everything "teleports" down, then returns.

            We avoid that by explicitly unmounting/remounting the slide content and using
            AnimatePresence mode="wait".
          */}
          <div className="flex-1 flex items-center">
            <div className="w-full">
              <AnimatePresence
                initial={false}
                mode="wait"
                onExitComplete={() => {
                  const next = pendingIndexRef.current
                  pendingIndexRef.current = null
                  setPendingIndex(null)
                  if (typeof next === "number" && next !== index) {
                    setIndex(next)
                  }
                  setShowSlide(true)
                }}
              >
                {showSlide && (
                  <motion.div
                    key={slide.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="grid gap-10 xl:gap-12 lg:grid-cols-12 items-center"
                    onAnimationComplete={() => {
                      // Slide has finished animating in.
                      // If the user clicked multiple times during the transition,
                      // run one more transition to the latest requested slide.
                      setIsTransitioning(false)
                      const queued = pendingIndexRef.current
                      if (typeof queued === "number" && queued !== index) {
                        setIsTransitioning(true)
                        setShowSlide(false)
                      }
                    }}
                  >
                    {/* Media (left) */}
                    <div className="lg:col-span-7">
                      <AspectRatio
                        ratio={16 / 9}
                        className={cn(
                          "relative overflow-hidden rounded-2xl border border-border bg-card",
                          "shadow-[0_18px_60px_rgba(0,0,0,0.22)]"
                        )}
                      >
                        {mediaStatus === "missing" ? (
                          <Image
                            src={slide.media.fallbackImage}
                            alt={`${slide.title} screenshot`}
                            fill
                            sizes="(max-width: 1024px) 100vw, 900px"
                            className="object-cover"
                            priority
                          />
                        ) : (
                          <video
                            className="absolute inset-0 h-full w-full object-cover"
                            autoPlay
                            loop
                            muted
                            playsInline
                            preload="metadata"
                            poster={slide.media.poster}
                            onCanPlay={() => setMediaState({ slideId: slide.id, status: "available" })}
                            onError={() => setMediaState({ slideId: slide.id, status: "missing" })}
                          >
                            {videoSources.map((source) => (
                              <source key={source.src} src={source.src} type={source.type} />
                            ))}
                            Your browser does not support the video tag.
                          </video>
                        )}

                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

                        {mediaStatus === "missing" ? (
                          <div className="pointer-events-none absolute left-0 right-0 bottom-0 p-4 md:p-6">
                            <p className="text-xs text-white/80 font-mono truncate">{slide.media.replaceHint}</p>
                          </div>
                        ) : null}
                      </AspectRatio>
                    </div>

                    {/* Description (right) */}
                    <div className="lg:col-span-5 flex flex-col">
                      <div className="rounded-2xl border border-border bg-background/88 backdrop-blur-xl p-6 md:p-8 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
                        <p className="text-xs uppercase tracking-widest text-foreground/70">Feature</p>
                        <h1 className="mt-4 text-4xl md:text-5xl xl:text-6xl font-serif leading-[1.05] text-foreground">
                          {slide.title}
                        </h1>
                        <p className="mt-5 text-lg xl:text-xl text-foreground/85 leading-relaxed">
                          {slide.subtitle}
                        </p>

                        <div className="mt-8 rounded-xl border border-border/70 bg-card/60 p-5">
                          <p className="text-sm font-semibold text-foreground">How it works</p>
                          <ul className="mt-4 space-y-2.5 text-sm text-foreground/85">
                            {slide.bullets.map((b) => (
                              <li key={b} className="flex items-start gap-2">
                                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-accent" />
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Navigation (same layout as before) */}
          <div className="mt-10 md:mt-12 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" onClick={goPrev} disabled={!canPrev || isClosing} className="min-w-28">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Prev
              </Button>

              <div className="flex items-center gap-2">
                {dots.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => requestIndex(d.index)}
                    disabled={isClosing}
                    aria-label={`Go to ${d.id}`}
                    className={cn(
                      "h-2.5 w-2.5 rounded-full transition-all",
                      d.isActive ? "bg-accent" : "bg-foreground/25 hover:bg-foreground/45"
                    )}
                  />
                ))}
              </div>

              <Button
                className="min-w-28 bg-foreground text-background hover:bg-accent"
                disabled={isClosing}
                onClick={canNext ? goNext : handleExit}
              >
                {canNext ? "Next" : "Exit"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>

            <p className="text-xs text-foreground/60 text-center">Tip: Left/Right to navigate; Esc exits.</p>
          </div>
        </div>
      </main>
    </motion.div>
  )
}

export default function DemoPage() {
  return <DemoFeatureTour />
}
