"use client"

import { Clock, Calendar, Coffee, Dumbbell, Brain, Users, Moon, CheckCircle2, X, CalendarPlus } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Suggestion, SuggestionCategory } from "@/lib/types"

const categoryIcons: Record<SuggestionCategory, typeof Coffee> = {
  break: Coffee,
  exercise: Dumbbell,
  mindfulness: Brain,
  social: Users,
  rest: Moon,
}

const categoryColors: Record<SuggestionCategory, { text: string; bg: string }> = {
  break: { text: "text-amber-500", bg: "bg-amber-500/10" },
  exercise: { text: "text-green-500", bg: "bg-green-500/10" },
  mindfulness: { text: "text-purple-500", bg: "bg-purple-500/10" },
  social: { text: "text-blue-500", bg: "bg-blue-500/10" },
  rest: { text: "text-indigo-500", bg: "bg-indigo-500/10" },
}

interface SuggestionDetailDialogProps {
  suggestion: Suggestion | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSchedule?: (suggestion: Suggestion) => void
  onAccept?: (suggestion: Suggestion) => void
  onDismiss?: (suggestion: Suggestion) => void
  onComplete?: (suggestion: Suggestion) => void
  isCalendarConnected?: boolean
}

export function SuggestionDetailDialog({
  suggestion,
  open,
  onOpenChange,
  onSchedule,
  onAccept,
  onDismiss,
  onComplete,
  isCalendarConnected = false,
}: SuggestionDetailDialogProps) {
  if (!suggestion) return null

  const Icon = categoryIcons[suggestion.category]
  const colors = categoryColors[suggestion.category]
  const isPending = suggestion.status === "pending"
  const isScheduled = suggestion.status === "scheduled"
  const isCompleted = suggestion.status === "accepted" || suggestion.status === "completed"
  const isDismissed = suggestion.status === "dismissed"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/70 bg-card/95 backdrop-blur-xl max-w-lg">
        <DialogHeader>
          {/* Category badge */}
          <div className="flex items-center gap-3 mb-2">
            <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", colors.bg)}>
              <Icon className={cn("h-5 w-5", colors.text)} />
            </div>
            <div>
              <Badge variant="secondary" className={cn("capitalize", colors.text)}>
                {suggestion.category}
              </Badge>
            </div>
          </div>

          <DialogTitle className="text-lg leading-snug pr-8">
            {suggestion.content}
          </DialogTitle>

          <DialogDescription className="text-sm text-muted-foreground mt-2">
            {suggestion.rationale}
          </DialogDescription>
        </DialogHeader>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-4 py-4 border-y border-border/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{suggestion.duration} minutes</span>
          </div>

          {isScheduled && suggestion.scheduledFor && (
            <div className="flex items-center gap-2 text-sm text-blue-500">
              <Calendar className="h-4 w-4" />
              <span>{formatScheduledTime(suggestion.scheduledFor)}</span>
            </div>
          )}

          {isCompleted && (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" />
              <span>Completed</span>
            </div>
          )}

          {isDismissed && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <X className="h-4 w-4" />
              <span>Dismissed</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isPending && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDismiss?.(suggestion)}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4 mr-2" />
                Dismiss
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAccept?.(suggestion)}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Accept
              </Button>
              <Button
                size="sm"
                onClick={() => onSchedule?.(suggestion)}
                disabled={!isCalendarConnected}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <CalendarPlus className="h-4 w-4 mr-2" />
                Schedule
              </Button>
            </>
          )}

          {isScheduled && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDismiss?.(suggestion)}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => onComplete?.(suggestion)}
                className="bg-success text-success-foreground hover:bg-success/90"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark Complete
              </Button>
            </>
          )}

          {(isCompleted || isDismissed) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          )}
        </DialogFooter>

        {/* Calendar connection hint */}
        {isPending && !isCalendarConnected && (
          <p className="text-xs text-muted-foreground text-center -mt-2">
            Connect your calendar in Settings to schedule recovery blocks
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

function formatScheduledTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const isTomorrow = date.toDateString() === new Date(now.getTime() + 86400000).toDateString()

  const timeStr = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  const dateStr = date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })

  if (isToday) return `Today at ${timeStr}`
  if (isTomorrow) return `Tomorrow at ${timeStr}`
  return `${dateStr} at ${timeStr}`
}
