export function StatsSection() {
  const stats = [
    { value: "76%", label: "Workers experience burnout" },
    { value: "3-7", label: "Days advance warning" },
    { value: "100%", label: "Client-side processing" },
    { value: "30s", label: "Daily check-in" },
  ]

  return (
    <section className="border-y border-border bg-card/50">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <p className="text-4xl font-semibold tracking-tight md:text-5xl">{stat.value}</p>
              <p className="mt-2 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
