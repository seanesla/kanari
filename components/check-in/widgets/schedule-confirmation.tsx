"use client"

import { Temporal } from "temporal-polyfill"
import { CalendarCheck, CalendarX, Loader2 } from "@/lib/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useTimeZone } from "@/lib/timezone-context"
import type { ScheduleActivityWidgetState, SuggestionCategory } from "@/lib/types"
import { WidgetContainer } from "./widget-container"

function formatCategory(category: SuggestionCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1)
}

function formatScheduleWindow(date: string, time: string, duration: number, timeZone: string): string {
  const [year, month, day] = date.split("-").map(Number)
  const [hour, minute] = time.split(":").map(Number)
  const safeDurationMinutes = Math.max(1, Math.round(duration))

  try {
    const start = Temporal.ZonedDateTime.from({
      timeZone,
      year,
      month,
      day,
      hour,
      minute,
    })
    const end = start.add({ minutes: safeDurationMinutes })

    const dateText = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(start.epochMilliseconds))

    const timeText = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
    })

    const startText = timeText.format(new Date(start.epochMilliseconds))
    const endText = timeText.format(new Date(end.epochMilliseconds))

    return `${dateText}, ${startText} to ${endText}`
  } catch {
    const start = new Date(year, month - 1, day, hour, minute, 0, 0)
    const end = new Date(start.getTime() + safeDurationMinutes * 60_000)

    const dateText = start.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
    const startText = start.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })
    const endText = end.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })

    return `${dateText}, ${startText} to ${endText}`
  }
}

interface ScheduleConfirmationProps {
  widget: ScheduleActivityWidgetState
  onDismiss?: () => void
  onUndo?: (suggestionId: string) => void
}

export function ScheduleConfirmation({
  widget,
  onDismiss,
  onUndo,
}: ScheduleConfirmationProps) {
  const { args } = widget
  const { timeZone } = useTimeZone()
  const isSyncing = widget.isSyncing === true

  return (
    <WidgetContainer
      title="Scheduled activity"
      description={isSyncing ? "Saving to your in-app calendar" : "Added to your in-app calendar"}
      onDismiss={onDismiss}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{args.title}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatScheduleWindow(args.date, args.time, args.duration, timeZone)}
          </p>
        </div>
        <Badge
          className={
            isSyncing
              ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
              : widget.status === "scheduled"
              ? "bg-green-500/10 text-green-600 border-green-500/20"
              : "bg-destructive/10 text-destructive border-destructive/20"
          }
          variant="outline"
        >
          {isSyncing ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Scheduling
            </>
          ) : widget.status === "scheduled" ? (
            <>
              <CalendarCheck className="h-3 w-3" /> Scheduled
            </>
          ) : (
            <>
              <CalendarX className="h-3 w-3" /> Failed
            </>
          )}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <Badge variant="secondary">{formatCategory(args.category)}</Badge>
        {widget.error ? (
          <span
            className={
              widget.status === "failed"
                ? "text-xs text-destructive"
                : "text-xs text-muted-foreground"
            }
          >
            {widget.error}
          </span>
        ) : null}
      </div>

      {widget.status === "scheduled" && !isSyncing && widget.suggestionId && onUndo ? (
        <div className="mt-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUndo(widget.suggestionId!)}
          >
            Undo
          </Button>
        </div>
      ) : null}
    </WidgetContainer>
  )
}
