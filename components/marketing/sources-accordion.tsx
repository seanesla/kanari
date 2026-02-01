"use client"

import { useEffect, useState } from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ExternalLink } from "@/lib/icons"
import { cn } from "@/lib/utils"

export type SourceLink = {
  id: number
  label: string
  href: string
}

export function SourcesAccordion({
  sources,
  className,
}: {
  sources: SourceLink[]
  className?: string
}) {
  const [open, setOpen] = useState<string | undefined>(undefined)

  useEffect(() => {
    const syncFromHash = () => {
      if (window.location.hash === "#sources") {
        setOpen("sources")
      }
    }

    syncFromHash()
    window.addEventListener("hashchange", syncFromHash)
    return () => window.removeEventListener("hashchange", syncFromHash)
  }, [])

  return (
    <div id="sources" className={cn("scroll-mt-28", className)} aria-label="Sources">
      <Accordion type="single" collapsible value={open} onValueChange={(v) => setOpen(v || undefined)}>
        <AccordionItem value="sources" className="border-b-0">
          <AccordionTrigger className="py-3 hover:no-underline">
            <span className="text-sm font-medium">Sources</span>
          </AccordionTrigger>
          <AccordionContent className="pb-0">
            <ol className="space-y-2 text-sm text-muted-foreground">
              {sources.map((source) => (
                <li key={source.id} className="leading-relaxed">
                  <a
                    className="inline-flex items-start gap-2 underline decoration-dotted underline-offset-4 hover:text-foreground transition-colors"
                    href={source.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="tabular-nums shrink-0">[{source.id}]</span>
                    <span className="min-w-0">{source.label}</span>
                    <ExternalLink className="mt-[2px] h-3.5 w-3.5 shrink-0 opacity-70" />
                  </a>
                </li>
              ))}
            </ol>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
