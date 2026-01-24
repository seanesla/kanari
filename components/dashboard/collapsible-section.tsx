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
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  open,
  onOpenChange,
}: CollapsibleSectionProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const isControlled = open !== undefined
  const isOpen = isControlled ? open : uncontrolledOpen

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
  }

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
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
