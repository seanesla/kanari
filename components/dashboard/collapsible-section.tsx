"use client"

import { useState } from "react"
import { ChevronDown } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { Deck } from "@/components/dashboard/deck"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface CollapsibleSectionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

export function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Deck
        tone={isOpen ? "raised" : "quiet"}
        className={cn(
          "overflow-hidden transition-colors",
          isOpen && "border-accent/35 ring-accent/15"
        )}
      >
        <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 hover:bg-muted/10 transition-colors">
          <span className="text-sm font-medium">{title}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4">{children}</div>
        </CollapsibleContent>
      </Deck>
    </Collapsible>
  )
}
