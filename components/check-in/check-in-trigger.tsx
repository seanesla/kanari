"use client"

/**
 * Check-In Trigger Component
 *
 * Button to start a conversational check-in session.
 * Can be used standalone or integrated into other components.
 */

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { MessageSquare, Mic } from "lucide-react"
import { cn } from "@/lib/utils"
import { CheckInDialog } from "./check-in-dialog"
import type { CheckInSession, VoicePatterns } from "@/lib/types"

type ButtonProps = React.ComponentProps<typeof Button>

interface CheckInTriggerProps extends Omit<ButtonProps, "onClick"> {
  /** If provided, triggers check-in with recording context */
  recordingContext?: {
    recordingId: string
    stressScore: number
    fatigueScore: number
    patterns: VoicePatterns
  }
  /** Called when session completes */
  onSessionComplete?: (session: CheckInSession) => void
  /** Custom label */
  label?: string
  /** Show icon */
  showIcon?: boolean
}

export function CheckInTrigger({
  recordingContext,
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
        onClick={() => setDialogOpen(true)}
        {...props}
      >
        {showIcon && <MessageSquare className="h-4 w-4" />}
        {label}
      </Button>

      <CheckInDialog
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        recordingContext={recordingContext}
        onSessionComplete={handleSessionComplete}
      />
    </>
  )
}

/**
 * Floating action button variant for prominent placement
 */
export function CheckInFab({
  recordingContext,
  onSessionComplete,
  className,
}: Pick<CheckInTriggerProps, "recordingContext" | "onSessionComplete" | "className">) {
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
        onClick={() => setDialogOpen(true)}
      >
        <Mic className="h-6 w-6" />
        <span className="sr-only">Start check-in</span>
      </Button>

      <CheckInDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        recordingContext={recordingContext}
        onSessionComplete={onSessionComplete}
      />
    </>
  )
}

/**
 * Post-recording prompt to encourage check-in
 * Shown when stress/fatigue scores are concerning
 */
interface PostRecordingPromptProps {
  recordingId: string
  stressScore: number
  fatigueScore: number
  patterns: VoicePatterns
  onDismiss?: () => void
  onSessionComplete?: (session: CheckInSession) => void
  className?: string
}

export function PostRecordingPrompt({
  recordingId,
  stressScore,
  fatigueScore,
  patterns,
  onDismiss,
  onSessionComplete,
  className,
}: PostRecordingPromptProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  // Determine message based on scores
  const getMessage = () => {
    if (stressScore > 70 || fatigueScore > 70) {
      return "Your voice shows some signs of stress or fatigue. Want to talk about it?"
    }
    if (stressScore > 50 || fatigueScore > 50) {
      return "I noticed some tension in your voice. Would you like to chat?"
    }
    return "Would you like to talk about how you're feeling?"
  }

  const handleStartCheckIn = () => {
    setDialogOpen(true)
  }

  const handleSessionComplete = (session: CheckInSession) => {
    onSessionComplete?.(session)
    onDismiss?.()
  }

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-4 p-4 rounded-lg bg-accent/5 border border-accent/20",
          className
        )}
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-accent" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Check in with kanari</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {getMessage()}
          </p>
        </div>

        <div className="flex-shrink-0 flex gap-2">
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Not now
          </Button>
          <Button variant="default" size="sm" onClick={handleStartCheckIn}>
            Let's talk
          </Button>
        </div>
      </div>

      <CheckInDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        recordingContext={{
          recordingId,
          stressScore,
          fatigueScore,
          patterns,
        }}
        onSessionComplete={handleSessionComplete}
      />
    </>
  )
}
