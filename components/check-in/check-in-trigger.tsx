"use client"

/**
 * Check-In Trigger Component
 *
 * Button to start a conversational check-in session.
 * Can be used standalone or integrated into other components.
 */

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { MessageSquare, Mic } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { CheckInDialog } from "./check-in-dialog"
import type { CheckInSession } from "@/lib/types"

type ButtonProps = React.ComponentProps<typeof Button>

interface CheckInTriggerProps extends Omit<ButtonProps, "onClick"> {
  /** Called when session completes */
  onSessionComplete?: (session: CheckInSession) => void
  /** Custom label */
  label?: string
  /** Show icon */
  showIcon?: boolean
}

export function CheckInTrigger({
  onSessionComplete,
  label = "Check in",
  showIcon = true,
  className,
  variant = "outline",
  size = "default",
  ...props
}: CheckInTriggerProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open)
  }, [])

  const handleSessionComplete = useCallback(
    (session: CheckInSession) => {
      onSessionComplete?.(session)
    },
    [onSessionComplete]
  )

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={cn("gap-2", className)}
        onClick={(event) => {
          // Avoid leaving focus on the trigger while the dialog applies `aria-hidden` to the page.
          // See: docs/error-patterns/aria-hidden-focused-descendant.md
          event.currentTarget.blur()
          setDialogOpen(true)
        }}
        {...props}
      >
        {showIcon && <MessageSquare className="h-4 w-4" />}
        {label}
      </Button>

      <CheckInDialog
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        onSessionComplete={handleSessionComplete}
      />
    </>
  )
}

/**
 * Floating action button variant for prominent placement
 */
export function CheckInFab({
  onSessionComplete,
  className,
}: Pick<CheckInTriggerProps, "onSessionComplete" | "className">) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <Button
        size="lg"
        className={cn(
          "h-14 w-14 rounded-full shadow-lg",
          "bg-accent hover:bg-accent/90 text-accent-foreground",
          "fixed bottom-6 right-6 z-50",
          className
        )}
        onClick={(event) => {
          // Avoid leaving focus on the trigger while the dialog applies `aria-hidden` to the page.
          // See: docs/error-patterns/aria-hidden-focused-descendant.md
          event.currentTarget.blur()
          setDialogOpen(true)
        }}
      >
        <Mic className="h-6 w-6" />
        <span className="sr-only">Start check-in</span>
      </Button>

      <CheckInDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSessionComplete={onSessionComplete}
      />
    </>
  )
}
