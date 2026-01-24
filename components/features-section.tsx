"use client"

import Image from "next/image"
import { motion, useReducedMotion } from "framer-motion"
import { Mic, Brain, TrendingUp, Calendar } from "@/lib/icons"

export function FeaturesSection() {
  const reduceMotion = useReducedMotion()
  const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

  const container = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduceMotion ? 0 : 0.12,
      },
    },
  }

  const item = {
    hidden: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 26, filter: "blur(10px)" },
    show: reduceMotion
      ? { opacity: 1 }
      : {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          transition: { duration: 0.85, ease: EASE },
        },
  }

  const features = [
    {
      icon: Mic,
      title: "Voice Biomarker Analysis",
      description: "Extract stress and fatigue signals from speech patterns, pause frequency, and vocal energy—all processed in your browser.",
    },
    {
      icon: Brain,
      title: "Predictive Forecasting",
      description: "AI models detect subtle pattern shifts that precede burnout, giving you 3-7 days of advance warning.",
    },
    {
      icon: TrendingUp,
      title: "Longitudinal Tracking",
      description: "Build your personal baseline over time. Understand your patterns and catch deviations before they become problems.",
    },
    {
      icon: Calendar,
      title: "Calendar Integration",
      description: "Automatically schedule recovery blocks when risk is elevated. Prevention is better than cure.",
    },
  ]

  return (
    <div className="py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-120px 0px -80px 0px" }}
        >
          <motion.div className="mb-16 max-w-2xl" variants={item}>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl text-balance">
              Everything you need to stay ahead of burnout
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                Privacy-first. Browser-based. Powered by Gemini 3.
                <Image src="/gemini-logo.svg" alt="Gemini" width={16} height={16} />
              </span>
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                variants={item}
                whileHover={reduceMotion ? undefined : { y: -6, scale: 1.01 }}
                whileTap={reduceMotion ? undefined : { scale: 0.99 }}
                transition={reduceMotion ? undefined : { type: "spring", stiffness: 280, damping: 22 }}
                className="group relative rounded-lg border border-border bg-card p-8 transition-colors hover:border-accent/50 hover:bg-card/80"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
