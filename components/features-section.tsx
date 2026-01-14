import { Mic, Brain, TrendingUp, Calendar } from "@/lib/icons"

export function FeaturesSection() {
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
    <section id="features" className="py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl text-balance">
            Everything you need to stay ahead of burnout
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Privacy-first. Browser-based. Powered by Gemini 3.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative rounded-lg border border-border bg-card p-8 transition-all hover:border-accent/50 hover:bg-card/80"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
