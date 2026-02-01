"use client"

import Image from "next/image"
import { FeatureTour } from "@/components/feature-tour/feature-tour"
import { FeaturesSection } from "@/components/features-section"
import { ScrollReveal } from "@/components/scroll-reveal"
import { SectionHeader } from "@/components/marketing/section-header"

export function ProductSection() {
  return (
    <section id="features" className="scroll-mt-28 py-20 sm:py-24 md:py-32 px-6 md:px-12 bg-background/40">
      <ScrollReveal>
        <div className="max-w-7xl mx-auto">
          <SectionHeader
            eyebrow="Product"
            title="From a 30-second voice check-in to a recovery plan."
            description="Gemini Live runs the conversation. On-device biomarkers track trends. Gemini Flash synthesizes evidence-linked insights and lightweight actions you can schedule."
          />

          <p className="mt-6 text-lg text-muted-foreground max-w-xl">
            <span className="inline-flex items-center gap-2">
              Privacy-first. Browser-based. Powered by Gemini 3.
              <Image src="/gemini-logo.svg" alt="Gemini" width={16} height={16} className="h-4 w-4" />
            </span>
          </p>

          <div className="mt-12">
            <FeaturesSection variant="embedded" />
          </div>

          <div id="walkthrough" className="scroll-mt-28 mt-14 sm:mt-20">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4">Walkthrough</p>
              <h3 className="text-3xl md:text-4xl font-serif leading-[1.05]">See it in action.</h3>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                A quick, visual tour of the full flow: check-in, on-device biomarkers, insights, 3-7 day forecast, recovery actions.
              </p>
            </div>

            <div className="mt-10" data-demo-id="demo-feature-tour">
              <FeatureTour variant="section" />
            </div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  )
}
