"use client"

import { ScrollReveal } from "@/components/scroll-reveal"
import { TransitionLink } from "@/components/transition-link"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

function GlossaryTerm({ term, description }: { term: string; description: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="underline decoration-dotted underline-offset-4 decoration-foreground/40 hover:decoration-foreground/70 transition-colors"
        >
          {term}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {description}
      </TooltipContent>
    </Tooltip>
  )
}

export function TrustSection() {
  return (
    <section
      id="trust"
      className="scroll-mt-28 py-20 sm:py-24 md:py-32 px-6 md:px-12 bg-background/50"
      aria-label="Trust"
    >
      <ScrollReveal>
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-24 items-start">
            <div className="lg:col-span-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Trust</p>
              <h2 className="text-4xl md:text-5xl font-serif leading-[1.1]">No black box.</h2>
              <p className="mt-6 text-muted-foreground text-lg leading-relaxed max-w-xl">
                Kanari is built to <span className="text-foreground">show its work</span>: what is computed on-device,
                what is sent to Gemini, and why a session does (or doesn’t) count toward your trend.
              </p>

              <div className="mt-8 flex flex-wrap gap-2">
                <Badge variant="outline" className="bg-muted/10 border-border/60 text-muted-foreground">
                  On-device features
                </Badge>
                <Badge variant="outline" className="bg-muted/10 border-border/60 text-muted-foreground">
                  Evidence-linked quotes
                </Badge>
                <Badge variant="outline" className="bg-muted/10 border-border/60 text-muted-foreground">
                  Quality gated trends
                </Badge>
              </div>

              <p className="mt-6 text-sm text-muted-foreground">
                Tip: hover or tap the underlined words for quick definitions.
              </p>
            </div>

            <div className="lg:col-span-6 lg:col-start-7">
              <div className="rounded-2xl border border-border/60 bg-background/40 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-medium">Trust drawer</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Expand any item. This matches what you can inspect inside a saved check-in.
                    </p>
                  </div>

                  <Badge
                    variant="secondary"
                    className="bg-muted/20 text-muted-foreground whitespace-nowrap"
                    asChild
                  >
                    <TransitionLink href="/check-ins">See it in app</TransitionLink>
                  </Badge>
                </div>

                <div className="mt-4 rounded-xl border border-border/50 bg-muted/10 px-4">
                  <Accordion type="single" collapsible defaultValue="local">
                    <AccordionItem value="local">
                      <AccordionTrigger>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">What stays on your device</div>
                          <div className="text-xs text-muted-foreground">Acoustic features, baselines, trends</div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        <p>
                          Kanari extracts <GlossaryTerm term="acoustic features" description="Numbers measured from your audio signal (like energy, pauses, rhythm, and spectral shape)." />
                          {" "}in your browser and stores sessions in <GlossaryTerm term="IndexedDB" description="A browser database used for offline-first storage. Data stays on this device unless you export/share it." />.
                        </p>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl border border-border/60 bg-background/30 p-4">
                            <p className="text-sm font-medium text-foreground">Local-only</p>
                            <ul className="mt-2 space-y-2 text-sm">
                              <li>Feature extraction (rhythm, pauses, energy, spectral features)</li>
                              <li>Baseline + calibration math</li>
                              <li>Trend aggregation + 3–7 day heuristic forecast</li>
                            </ul>
                          </div>
                          <div className="rounded-xl border border-border/60 bg-background/30 p-4">
                            <p className="text-sm font-medium text-foreground">What you can inspect</p>
                            <ul className="mt-2 space-y-2 text-sm">
                              <li>Per-feature values + thresholds/weights</li>
                              <li>Intermediate scores (acoustic, semantic, blended)</li>
                              <li>Confidence + data quality</li>
                            </ul>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="gemini">
                      <AccordionTrigger>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">What goes to Gemini (and why)</div>
                          <div className="text-xs text-muted-foreground">Conversation + transcript-backed synthesis</div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        <p>
                          During the live check-in, audio is streamed to Gemini for the conversation. Afterward, Gemini
                          produces structured synthesis from the transcript (insights + suggestions).
                        </p>
                        <div className="mt-3 rounded-xl border border-border/60 bg-background/30 p-4">
                          <p className="text-sm font-medium text-foreground">Sent to Gemini</p>
                          <ul className="mt-2 space-y-2 text-sm">
                            <li>Live check-in audio stream (conversation semantics)</li>
                            <li>Transcript text (used for evidence-backed summaries)</li>
                            <li>Semantic estimates with required supporting quotes</li>
                          </ul>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="evidence">
                      <AccordionTrigger>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">Evidence-linked insights</div>
                          <div className="text-xs text-muted-foreground">Every claim points to a message</div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        <p>
                          When Gemini produces an insight, it must attach evidence quotes with a transcript
                          {" "}<GlossaryTerm term="message id" description="A stable identifier for a single chat turn. Quotes link back to that exact message so you can verify context." />.
                          Clicking a quote jumps you to the source message.
                        </p>
                        <div className="mt-3 rounded-xl border border-border/60 bg-background/30 p-4">
                          <p className="text-sm font-medium text-foreground">Why this matters</p>
                          <p className="mt-2 text-sm">
                            If the model can’t point to text it actually saw, the app treats it as unreliable.
                          </p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="quality">
                      <AccordionTrigger>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">Quality gates</div>
                          <div className="text-xs text-muted-foreground">Bad audio shouldn’t move your trend</div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        <p>
                          Kanari computes a data-quality score (noise, speech duration, VAD confidence). If quality is
                          below a threshold, that session won’t update trends or forecasts.
                        </p>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl border border-border/60 bg-background/30 p-4">
                            <p className="text-sm font-medium text-foreground">Helps prevent</p>
                            <ul className="mt-2 space-y-2 text-sm">
                              <li>One noisy check-in “spiking” your risk</li>
                              <li>Too-short speech producing fake certainty</li>
                              <li>Trends drifting from low-signal days</li>
                            </ul>
                          </div>
                          <div className="rounded-xl border border-border/60 bg-background/30 p-4">
                            <p className="text-sm font-medium text-foreground">What you’ll see</p>
                            <ul className="mt-2 space-y-2 text-sm">
                              <li>Lower confidence</li>
                              <li>“Didn’t count toward trend” indicators</li>
                              <li>More conservative forecasts</li>
                            </ul>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>

                <p className="mt-4 text-xs text-muted-foreground">
                  Not medical advice. Kanari estimates patterns and trends; it does not diagnose burnout.
                </p>
              </div>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  )
}
