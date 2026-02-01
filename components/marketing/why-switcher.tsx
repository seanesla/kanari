"use client"

import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { motion } from "framer-motion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Deck } from "@/components/dashboard/deck"
import { SourcesAccordion, type SourceLink } from "@/components/marketing/sources-accordion"
import { User, Users, ArrowUpRight } from "@/lib/icons"
import { cn } from "@/lib/utils"

function Citation({ n }: { n: number }) {
  return (
    <sup className="ml-0.5 align-super">
      <a
        href="#sources"
        onClick={() => {
          // If the hash is already #sources, hashchange won't fire.
          // We still want the Sources accordion to expand.
          if (window.location.hash === "#sources") {
            try {
              window.dispatchEvent(new HashChangeEvent("hashchange"))
            } catch {
              window.dispatchEvent(new Event("hashchange"))
            }
          }
        }}
        className="text-[11px] tabular-nums text-muted-foreground hover:text-foreground transition-colors"
        aria-label={`Source ${n}`}
      >
        [{n}]
      </a>
    </sup>
  )
}

function StatCard({
  value,
  label,
  detail,
  accent = false,
}: {
  value: string
  label: ReactNode
  detail?: ReactNode
  accent?: boolean
}) {
  return (
    <Deck tone="quiet" className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={cn("text-3xl sm:text-4xl font-serif leading-none", accent ? "text-accent" : "text-foreground")}>
            {value}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{label}</p>
          {detail ? <div className="mt-3 text-sm text-muted-foreground leading-relaxed">{detail}</div> : null}
        </div>
        <ArrowUpRight className="h-4 w-4 text-foreground/35 shrink-0" />
      </div>
    </Deck>
  )
}

export function WhySwitcher({ className }: { className?: string }) {
  const [audience, setAudience] = useState<"people" | "teams">("people")

  const sources: SourceLink[] = useMemo(
    () => [
      {
        id: 1,
        label: "Forbes (2025): Burnout at 66% of U.S. employees (reported)",
        href: "https://www.forbes.com/sites/bryanrobinson/2025/02/08/job-burnout-at-66-in-2025-new-study-shows/",
      },
      {
        id: 2,
        label: "NIH/PMC (2025): Review of vocal/acoustic features linked to stress",
        href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12293195/",
      },
      {
        id: 3,
        label: "Forbes (2025): Estimated employer cost of burnout per employee",
        href: "https://www.forbes.com/sites/julianhayesii/2025/03/17/employee-burnout-the-hidden-threat-costing-companies-millions/",
      },
      {
        id: 4,
        label: "Gallup (2025): Remote work paradox (engaged, but more distressed)",
        href: "https://www.gallup.com/workplace/660236/remote-work-paradox-engaged-distressed.aspx",
      },
    ],
    []
  )

  return (
    <div className={cn("mt-8", className)} aria-label="Why Kanari exists">
      <Tabs value={audience} onValueChange={(value) => setAudience(value as "people" | "teams")}>
        <TabsList
          className={cn(
            "w-full max-w-[420px]",
            "relative h-11 p-1 rounded-2xl",
            "border border-white/10",
            "bg-[rgba(255,255,255,0.03)] backdrop-blur-2xl backdrop-saturate-150",
            "ring-1 ring-white/6",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_50px_rgba(0,0,0,0.35)]"
          )}
        >
          <TabsTrigger
            value="people"
            className={cn(
              "relative h-9 rounded-xl px-4 overflow-hidden",
              "text-sm font-semibold tracking-tight",
              "text-muted-foreground/90 hover:text-foreground",
              "hover:bg-muted/20",
              "data-[state=active]:text-foreground",
              "transition-all duration-200"
            )}
          >
            {audience === "people" ? (
              <motion.div
                layoutId="landing-why-tabs-indicator"
                transition={{ type: "spring", stiffness: 520, damping: 42 }}
                className={cn(
                  "absolute inset-0 rounded-xl",
                  "bg-[rgba(255,255,255,0.06)] backdrop-blur-xl backdrop-saturate-150",
                  "border border-white/10",
                  "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_40px_rgba(0,0,0,0.35)]"
                )}
              />
            ) : null}
            <span className="relative z-10 inline-flex items-center gap-2">
              <User className={cn("h-4 w-4", audience === "people" ? "text-foreground/80" : "")} />
              For people
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="teams"
            className={cn(
              "relative h-9 rounded-xl px-4 overflow-hidden",
              "text-sm font-semibold tracking-tight",
              "text-muted-foreground/90 hover:text-foreground",
              "hover:bg-muted/20",
              "data-[state=active]:text-foreground",
              "transition-all duration-200"
            )}
          >
            {audience === "teams" ? (
              <motion.div
                layoutId="landing-why-tabs-indicator"
                transition={{ type: "spring", stiffness: 520, damping: 42 }}
                className={cn(
                  "absolute inset-0 rounded-xl",
                  "bg-[rgba(255,255,255,0.06)] backdrop-blur-xl backdrop-saturate-150",
                  "border border-white/10",
                  "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_40px_rgba(0,0,0,0.35)]"
                )}
              />
            ) : null}
            <span className="relative z-10 inline-flex items-center gap-2">
              <Users className={cn("h-4 w-4", audience === "teams" ? "text-foreground/80" : "")} />
              For teams
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              value="66%"
              label={
                <>
                  report experiencing burnout (U.S., 2025)
                  <Citation n={1} />
                </>
              }
              detail={
                <>
                  Burnout often shows up late because self-assessment fails when you are already depleted.
                </>
              }
              accent
            />
            <StatCard
              value="Voice"
              label={
                <>
                  can reflect stress-linked acoustic shifts
                  <Citation n={2} />
                </>
              }
              detail={
                <>
                  Research links stress with changes in pitch, pauses, and energy variability. Kanari treats these as
                  signals, not a diagnosis.
                </>
              }
            />
          </div>
          <p className="mt-5 text-sm text-muted-foreground leading-relaxed max-w-xl">
            Kanari turns a 30-60s voice check-in into trends and small recovery actions you can schedule. Not medical advice.
          </p>
        </TabsContent>

        <TabsContent value="teams" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              value="$4k-$21k"
              label={
                <>
                  estimated annual burnout cost per employee
                  <Citation n={3} />
                </>
              }
              detail={
                <>
                  Prevention beats churn: catching early signals enables smaller interventions before performance drops.
                </>
              }
              accent
            />
            <StatCard
              value="Remote"
              label={
                <>
                  can be engaged and still distressed
                  <Citation n={4} />
                </>
              }
              detail={
                <>
                  Kanari is privacy-first: acoustic trends stay on-device; Gemini is used for the conversation and
                  transcript-backed synthesis.
                </>
              }
            />
          </div>
          <p className="mt-5 text-sm text-muted-foreground leading-relaxed max-w-xl">
            Built for low-friction daily use and clear accountability: evidence-linked summaries and quality-gated trends.
          </p>
        </TabsContent>
      </Tabs>

      <div className="mt-6">
        <Deck tone="quiet" className="px-5 sm:px-6">
          <SourcesAccordion sources={sources} />
        </Deck>
      </div>
    </div>
  )
}
