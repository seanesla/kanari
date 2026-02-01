"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { useSceneMode } from "@/lib/scene-context"
import { ArrowLeft, ArrowRight, RotateCcw } from "@/lib/icons"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { getDemoVideoSources } from "@/lib/demo/demo-video-sources"

export type FeatureTourVariant = "page" | "section"

type FeatureTourSlide = {
  id: string
  title: string
  subtitle: string
  bullets: string[]
  media:
    | {
        kind: "video"
        poster: string
        webm?: string
        mp4?: string
        fallbackImage: string
        replaceHint: string
      }
    | {
        kind: "image"
        src: string
        alt: string
        replaceHint: string
      }
}

const SLIDES: FeatureTourSlide[] = [
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
      kind: "video",
      poster: "/demo/posters/01-checkin.svg",
      mp4: "/demo/01-checkin.mp4",
      fallbackImage: "/demo/posters/01-checkin.svg",
      replaceHint: "Drop your recording at public/demo/01-checkin.mp4",
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
      kind: "video",
      poster: "/demo/posters/02-biomarkers.svg",
      mp4: "/demo/02-biomarkers.mp4",
      fallbackImage: "/demo/posters/02-biomarkers.svg",
      replaceHint: "Drop your recording at public/demo/02-biomarkers.mp4",
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
      kind: "video",
      poster: "/demo/posters/03-insights.svg",
      mp4: "/demo/03-insights.mp4",
      fallbackImage: "/demo/posters/03-insights.svg",
      replaceHint: "Drop your recording at public/demo/03-insights.mp4",
    },
  },
  {
    id: "forecast",
    title: "3-7 day risk forecast",
    subtitle: "Heuristic trend-based forecasting with confidence (not diagnostic).",
    bullets: [
      "Turns recent biomarker trends into a risk level + confidence",
      "Explains contributing factors so the result feels actionable",
      "Shows trend charts to prove it's longitudinal, not a one-off score",
    ],
    media: {
      kind: "image",
      src: "/demo/04-forecast.png",
      alt: "Forecast trends chart",
      replaceHint: "Drop your screenshot at public/demo/04-forecast.png",
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
      kind: "image",
      src: "/demo/05-suggestions.png",
      alt: "Kanban suggestions board",
      replaceHint: "Drop your screenshot at public/demo/05-suggestions.png",
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
      kind: "video",
      poster: "/demo/posters/06-calendar.svg",
      mp4: "/demo/06-calendar.mp4",
      fallbackImage: "/demo/posters/06-calendar.svg",
      replaceHint: "Drop your recording at public/demo/06-calendar.mp4",
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
      kind: "video",
      poster: "/demo/posters/08-achievements.svg",
      mp4: "/demo/08-achievements.mp4",
      fallbackImage: "/demo/posters/08-achievements.svg",
      replaceHint: "Drop your recording at public/demo/08-achievements.mp4",
    },
  },
]

export function FeatureTour({ variant = "section" }: { variant?: FeatureTourVariant }) {
  const isPage = variant === "page"
  const { resetToLanding } = useSceneMode()

  const [index, setIndex] = useState(0)
  const [pendingIndex, setPendingIndex] = useState<number | null>(null)
  const pendingIndexRef = useRef<number | null>(null)
  const [showSlide, setShowSlide] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const replayTimerRef = useRef<number | null>(null)
  const [isMediaLoading, setIsMediaLoading] = useState(true)
  const [isReplaying, setIsReplaying] = useState(false)

  // We intentionally start in an "unknown" state so the first paint always
  // renders the media frame instead of flashing a dev-only "drop file" hint.
  const [mediaState, setMediaState] = useState<{
    slideId: string
    status: "unknown" | "available" | "missing"
  }>(() => ({ slideId: SLIDES[0]?.id ?? "", status: "unknown" }))

  useEffect(() => {
    resetToLanding()
  }, [resetToLanding])

  useEffect(() => {
    return () => {
      if (replayTimerRef.current) {
        window.clearTimeout(replayTimerRef.current)
        replayTimerRef.current = null
      }
    }
  }, [])

  const slide = SLIDES[index]!
  const videoSources = useMemo(() => {
    if (slide.media.kind !== "video") return []
    return getDemoVideoSources(slide.media)
  }, [slide.media])
  const mediaStatus = mediaState.slideId === slide.id ? mediaState.status : "unknown"

  // Use the latest requested index (if any) for button enable/disable.
  const effectiveIndex = pendingIndex ?? index
  const canPrev = effectiveIndex > 0
  const canNext = effectiveIndex < SLIDES.length - 1

  const requestIndex = useCallback(
    (nextIndex: number) => {
      const clamped = Math.min(Math.max(0, nextIndex), SLIDES.length - 1)

      pendingIndexRef.current = clamped
      setPendingIndex(clamped)

      if (!isTransitioning) {
        setIsTransitioning(true)
        setShowSlide(false)
      }
    },
    [isTransitioning]
  )

  const handleStartOver = useCallback(() => {
    requestIndex(0)
  }, [requestIndex])

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

    setIsMediaLoading(true)
    setIsReplaying(false)
    if (replayTimerRef.current) {
      window.clearTimeout(replayTimerRef.current)
      replayTimerRef.current = null
    }

    if (slide.media.kind !== "video") {
      setMediaState({ slideId: slide.id, status: "available" })
      return () => {
        cancelled = true
      }
    }

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
  }, [slide.id, slide.media.kind, videoSources])

  // Keyboard navigation (page only).
  useEffect(() => {
    if (!isPage) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        goPrev()
      }
      if (e.key === "ArrowRight") {
        goNext()
      }
      if (e.key === "Escape") {
        handleStartOver()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [goNext, goPrev, handleStartOver, isPage])

  const dots = useMemo(() => {
    return SLIDES.map((s, i) => ({ id: s.id, index: i, isActive: i === index }))
  }, [index])

  const handleVideoEnded = useCallback(() => {
    if (!videoRef.current) return
    setIsReplaying(true)
    replayTimerRef.current = window.setTimeout(() => {
      const el = videoRef.current
      if (!el) return
      try {
        el.currentTime = 0
      } catch {
        // ignore
      }
      const p = el.play()
      if (p) {
        p.catch(() => {
          // ignore autoplay rejection
        })
      }
    }, 800)
  }, [])

  const deck = (
    <>
      <div className={cn("relative", isPage ? "min-h-screen overflow-x-hidden" : "")}> 
        {isPage ? (
          <>
            {/* Dim overlay to soften the Kanari Core background */}
            <div className="pointer-events-none fixed inset-0 bg-background/80" />
            {/* Background atmosphere */}
            <div className="pointer-events-none fixed inset-0">
              <div className="absolute -top-24 left-1/2 h-[520px] w-[780px] -translate-x-1/2 rounded-full bg-accent/12 blur-3xl" />
              <div className="absolute top-[35vh] -left-32 h-[420px] w-[520px] rounded-full bg-foreground/6 blur-3xl" />
              <div className="absolute bottom-[-180px] right-[-140px] h-[520px] w-[680px] rounded-full bg-accent/10 blur-3xl" />
            </div>
          </>
        ) : null}

        <main
          className={cn(
            "relative",
            isPage
              ? "min-h-screen px-6 md:px-12 lg:px-16 pt-[calc(env(safe-area-inset-top)+6.5rem)] md:pt-[8.5rem] pb-[calc(env(safe-area-inset-bottom)+2.5rem)]"
              : ""
          )}
        >
          <div
            className={cn(
              "mx-auto flex flex-col",
              isPage
                ? "min-h-[calc(100vh-(env(safe-area-inset-top)+6.5rem)-(env(safe-area-inset-bottom)+2.5rem))] max-w-screen-2xl"
                : "max-w-screen-2xl"
            )}
          >
            {isPage ? (
              <header className="flex items-center justify-between gap-4 mb-10 md:mb-12">
                <Button
                  variant="outline"
                  onClick={handleStartOver}
                  className="gap-2 bg-background/70 backdrop-blur border-border/80"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span className="hidden sm:inline">Start over</span>
                  <span className="sm:hidden">Restart</span>
                </Button>

                <div className="text-xs uppercase tracking-widest text-foreground/60 tabular-nums">
                  Feature Tour - {index + 1}/{SLIDES.length}
                </div>
              </header>
            ) : (
              <div className="flex items-center justify-end mb-6">
                <div className="text-xs uppercase tracking-widest text-foreground/60 tabular-nums">
                  {index + 1}/{SLIDES.length}
                </div>
              </div>
            )}

            {/* Slide */}
            <div className={cn("flex-1 flex items-center", isPage ? "" : "")}> 
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
                      className={cn(
                        "grid gap-10 xl:gap-12 items-center",
                        isPage ? "lg:grid-cols-12" : "lg:grid-cols-12"
                      )}
                      onAnimationComplete={() => {
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
                          {slide.media.kind === "image" || mediaStatus === "missing" ? (
                            <Image
                              src={slide.media.kind === "image" ? slide.media.src : slide.media.fallbackImage}
                              alt={slide.media.kind === "image" ? slide.media.alt : `${slide.title} screenshot`}
                              fill
                              sizes="(max-width: 1024px) 100vw, 900px"
                              className="object-cover"
                              priority={isPage}
                              onLoadingComplete={() => setIsMediaLoading(false)}
                            />
                          ) : (
                            <video
                              ref={videoRef}
                              className="absolute inset-0 h-full w-full object-cover"
                              autoPlay
                              muted
                              playsInline
                              preload="metadata"
                              poster={slide.media.poster}
                              onLoadStart={() => setIsMediaLoading(true)}
                              onWaiting={() => setIsMediaLoading(true)}
                              onCanPlay={() => setIsMediaLoading(false)}
                              onPlaying={() => {
                                setIsMediaLoading(false)
                                setIsReplaying(false)
                              }}
                              onEnded={handleVideoEnded}
                              onError={() => {
                                setMediaState({ slideId: slide.id, status: "missing" })
                                setIsMediaLoading(false)
                              }}
                            >
                              {videoSources.map((source) => (
                                <source key={source.src} src={source.src} type={source.type} />
                              ))}
                              Your browser does not support the video tag.
                            </video>
                          )}

                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

                          <AnimatePresence>
                            {(isMediaLoading || mediaStatus === "unknown") && (
                              <motion.div
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                                className="absolute inset-0 grid place-items-center"
                                style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 100%)" }}
                              >
                                <motion.div
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 6 }}
                                  transition={{ duration: 0.25, ease: "easeOut" }}
                                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 backdrop-blur"
                                >
                                  <Spinner className="size-4 text-white" />
                                  <span className="text-sm text-white/90">Loading...</span>
                                </motion.div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <AnimatePresence>
                            {isReplaying && (
                              <motion.div
                                key="replaying"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                                className="absolute inset-0 grid place-items-center"
                                style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.55) 100%)" }}
                              >
                                <motion.div
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 6 }}
                                  transition={{ duration: 0.25, ease: "easeOut" }}
                                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 backdrop-blur"
                                >
                                  <Spinner className="size-4 text-white" />
                                  <span className="text-sm text-white/90">Replaying...</span>
                                </motion.div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {slide.media.kind === "video" && mediaStatus === "missing" ? (
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
                          <h3 className="mt-4 text-3xl md:text-4xl xl:text-5xl font-serif leading-[1.05] text-foreground">
                            {slide.title}
                          </h3>
                          <p className="mt-5 text-lg xl:text-xl text-foreground/85 leading-relaxed">{slide.subtitle}</p>

                          <div className="mt-8 rounded-xl border border-border/70 bg-card/60 p-5">
                            <p className="text-sm font-semibold text-foreground">What you see</p>
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

            {/* Navigation */}
            <div className="mt-10 md:mt-12 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <Button variant="outline" onClick={goPrev} disabled={!canPrev} className="min-w-28">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Prev
                </Button>

                <div className="flex items-center gap-2">
                  {dots.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => requestIndex(d.index)}
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
                  onClick={canNext ? goNext : handleStartOver}
                >
                  {canNext ? "Next" : "Start over"}
                  {canNext ? (
                    <ArrowRight className="h-4 w-4 ml-2" />
                  ) : (
                    <RotateCcw className="h-4 w-4 ml-2" />
                  )}
                </Button>
              </div>

              {isPage ? (
                <p className="text-xs text-foreground/60 text-center">Tip: Left/Right to navigate; Esc restarts.</p>
              ) : null}
            </div>
          </div>
        </main>
      </div>
    </>
  )

  if (!isPage) {
    return deck
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.22, ease: "easeOut" }}>
      {deck}
    </motion.div>
  )
}
