export function HowItWorksSection() {
  const steps = [
    {
      number: "01",
      title: "Record your voice",
      description: "Speak naturally for 30-60 seconds about your day. No scripts needed—your voice carries the signal.",
    },
    {
      number: "02",
      title: "Analyze locally",
      description: "AI extracts vocal biomarkers entirely in your browser. Speech patterns, pause frequency, spectral features—processed privately.",
    },
    {
      number: "03",
      title: "Predict and act",
      description: "Compare patterns against your baseline. Get 3-7 day burnout forecasts and personalized recovery suggestions.",
    },
  ]

  return (
    <section id="how-it-works" className="border-y border-border bg-card/30 py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16 max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">How it works</h2>
          <p className="mt-4 text-lg text-muted-foreground">30 seconds a day. Zero data uploaded.</p>
        </div>

        <div className="grid gap-12 md:grid-cols-3">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              <span className="mb-4 block text-6xl font-semibold text-accent/20">{step.number}</span>
              <h3 className="mb-3 text-xl font-semibold">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
