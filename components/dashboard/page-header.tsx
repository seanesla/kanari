"use client"

import { cn } from "@/lib/utils"
import { Deck } from "@/components/dashboard/deck"

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
    <Deck
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 px-4 py-3 md:px-6 md:py-4",
        className
      )}
    >
      <div className="flex flex-col gap-1">
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

      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </Deck>
  )
}
