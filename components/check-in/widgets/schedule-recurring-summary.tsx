"use client"

import { Temporal } from "temporal-polyfill"
import { AlertTriangle, CalendarCheck, CalendarX, Loader2 } from "@/lib/icons"
import { Badge } from "@/components/ui/badge"
import { useTimeZone } from "@/lib/timezone-context"
import type { RecurrenceWeekday, ScheduleRecurringSummaryWidgetState } from "@/lib/types"
import { WidgetContainer } from "./widget-container"

const WEEKDAY_LABELS: Record<RecurrenceWeekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
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

function formatRecurrenceLabel(widget: ScheduleRecurringSummaryWidgetState, timeZone: string): string {
  const { args } = widget
  const start = formatZonedDateTime(args.startDate, args.time, timeZone)

  if (args.frequency === "daily") {
    return `Daily from ${start}`
  }

  if (args.frequency === "weekdays") {
    return `Weekdays from ${start}`
  }

  if (args.frequency === "weekly") {
    return `Weekly from ${start}`
  }

  if (args.weekdays?.length) {
    const weekdayLabel = args.weekdays.map((weekday) => WEEKDAY_LABELS[weekday]).join(", ")
    return `${weekdayLabel} from ${start}`
  }

  return `Recurring from ${start}`
}

interface ScheduleRecurringSummaryProps {
  widget: ScheduleRecurringSummaryWidgetState
  onDismiss?: () => void
}

export function ScheduleRecurringSummary({
  widget,
  onDismiss,
}: ScheduleRecurringSummaryProps) {
  const { timeZone } = useTimeZone()
  const isSyncing = widget.isSyncing === true

  const description = isSyncing
    ? "Scheduling recurring activities in your in-app calendar"
    : widget.status === "failed"
      ? "No activities were scheduled"
      : widget.status === "partial"
        ? "Some activities were not scheduled"
        : "Added to your in-app calendar"

  return (
    <WidgetContainer
      title="Recurring schedule"
      description={description}
      onDismiss={onDismiss}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{widget.args.title}</p>
          <p className="text-xs text-muted-foreground mt-1">{formatRecurrenceLabel(widget, timeZone)}</p>
        </div>
        <Badge
          className={
            isSyncing
              ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
              : widget.status === "scheduled"
                ? "bg-green-500/10 text-green-600 border-green-500/20"
                : widget.status === "partial"
                  ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
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
          ) : widget.status === "partial" ? (
            <>
              <AlertTriangle className="h-3 w-3" /> Partial
            </>
          ) : (
            <>
              <CalendarX className="h-3 w-3" /> Failed
            </>
          )}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">{widget.scheduledCount} scheduled</Badge>
        {widget.failedCount > 0 ? <Badge variant="secondary">{widget.failedCount} failed</Badge> : null}
        {widget.duplicateCount > 0 ? <Badge variant="secondary">{widget.duplicateCount} duplicate skipped</Badge> : null}
      </div>

      {widget.truncated ? (
        <p className="text-xs text-muted-foreground mt-3">Plan was capped at the maximum recurrence limit.</p>
      ) : null}

      {widget.error ? (
        <p
          className={
            widget.status === "failed"
              ? "text-xs text-destructive mt-2"
              : "text-xs text-muted-foreground mt-2"
          }
        >
          {widget.error}
        </p>
      ) : null}
    </WidgetContainer>
  )
}
