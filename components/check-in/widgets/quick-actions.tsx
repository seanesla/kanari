"use client"

import { Button } from "@/components/ui/button"
import type { QuickActionsWidgetState } from "@/lib/types"
import { WidgetContainer } from "./widget-container"

interface QuickActionsProps {
  widget: QuickActionsWidgetState
  onDismiss?: () => void
  onSelect?: (action: string, label: string) => void
}

export function QuickActions({ widget, onDismiss, onSelect }: QuickActionsProps) {
  return (
    <WidgetContainer
      title="Quick actions"
      description="Tap an option to continue"
      onDismiss={onDismiss}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {widget.args.options.map((opt) => (
          <Button
            key={`${opt.label}-${opt.action}`}
            variant="outline"
            className="justify-start h-auto py-3 whitespace-normal"
            onClick={() => onSelect?.(opt.action, opt.label)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </WidgetContainer>
  )
}

