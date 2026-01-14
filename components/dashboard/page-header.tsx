"use client"

import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  titleAccent?: string
  subtitle?: string
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  titleAccent,
  subtitle,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border/70 bg-card/30 backdrop-blur-xl px-4 py-3 md:px-6 md:py-4",
        className
      )}
    >
      {/* Wave glow effect */}
      <div
        className="pointer-events-none absolute inset-0 animate-gradient-sweep"
        style={{
          backgroundImage: `linear-gradient(90deg, transparent 0%, oklch(from var(--accent) l calc(c * 1.2) h / 0.04) 20%, oklch(from var(--accent) l calc(c * 1.2) h / 0.08) 50%, oklch(from var(--accent) l calc(c * 1.2) h / 0.04) 80%, transparent 100%)`,
          backgroundSize: "200% 100%",
        }}
      />

      <div className="relative flex flex-col gap-1">
        <h1 className="text-xl md:text-2xl font-serif tracking-tight">
          {titleAccent ? (
            <>
              {title} <span className="text-accent">{titleAccent}</span>
            </>
          ) : (
            title
          )}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground max-w-xl">{subtitle}</p>
        )}
      </div>

      {actions && <div className="relative flex items-center gap-2">{actions}</div>}
    </div>
  )
}
