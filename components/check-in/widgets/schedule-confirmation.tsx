"use client"

import { Temporal } from "temporal-polyfill"
import { CalendarCheck, CalendarX } from "@/lib/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useTimeZone } from "@/lib/timezone-context"
import type { ScheduleActivityWidgetState, SuggestionCategory } from "@/lib/types"
import { WidgetContainer } from "./widget-container"

function formatCategory(category: SuggestionCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1)
}

function formatZonedDateTime(date: string, time: string, timeZone: string): string {
  const [year, month, day] = date.split("-").map(Number)
  const [hour, minute] = time.split(":").map(Number)

  try {
    const zdt = Temporal.ZonedDateTime.from({
      timeZone,
      year,
      month,
      day,
      hour,
      minute,
    })

    return new Intl.DateTimeFormat([], {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(zdt.epochMilliseconds))
  } catch {
    const dt = new Date(year, month - 1, day, hour, minute, 0, 0)
    return dt.toLocaleString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
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

  return (
    <WidgetContainer
      title="Scheduled activity"
      description="Added to your in-app calendar"
      onDismiss={onDismiss}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{args.title}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatZonedDateTime(args.date, args.time, timeZone)} • {args.duration}m
          </p>
        </div>
        <Badge
          className={
            widget.status === "scheduled"
              ? "bg-green-500/10 text-green-600 border-green-500/20"
              : "bg-destructive/10 text-destructive border-destructive/20"
          }
          variant="outline"
        >
          {widget.status === "scheduled" ? (
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

      {widget.status === "scheduled" && widget.suggestionId && onUndo ? (
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
