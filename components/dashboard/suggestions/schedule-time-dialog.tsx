"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { Clock, CalendarPlus, Coffee, Dumbbell, Brain, Users, Moon } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { useTimeZone } from "@/lib/timezone-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { createDatePicker } from "@schedule-x/date-picker"
import "@schedule-x/theme-default/dist/date-picker.css"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { RecurringMutationScope, Suggestion, SuggestionCategory } from "@/lib/types"

type DatePickerInstance = ReturnType<typeof createDatePicker> & {
  destroy?: () => void
}

const categoryIcons: Record<SuggestionCategory, typeof Coffee> = {
  break: Coffee,
  exercise: Dumbbell,
  mindfulness: Brain,
  social: Users,
  rest: Moon,
}

const categoryColors: Record<SuggestionCategory, { text: string; bg: string }> = {
  break: { text: "text-accent", bg: "bg-accent/10" },
  exercise: { text: "text-green-500", bg: "bg-green-500/10" },
  mindfulness: { text: "text-purple-500", bg: "bg-purple-500/10" },
  social: { text: "text-blue-500", bg: "bg-blue-500/10" },
  rest: { text: "text-indigo-500", bg: "bg-indigo-500/10" },
}

// Hours 8 AM - 8 PM (matching WeekCalendar)
const HOURS = [
  { value: "8", label: "8 AM" },
  { value: "9", label: "9 AM" },
  { value: "10", label: "10 AM" },
  { value: "11", label: "11 AM" },
  { value: "12", label: "12 PM" },
  { value: "13", label: "1 PM" },
  { value: "14", label: "2 PM" },
  { value: "15", label: "3 PM" },
  { value: "16", label: "4 PM" },
  { value: "17", label: "5 PM" },
  { value: "18", label: "6 PM" },
  { value: "19", label: "7 PM" },
  { value: "20", label: "8 PM" },
]

const MINUTES = [
  { value: "0", label: "00" },
  { value: "15", label: "15" },
  { value: "30", label: "30" },
  { value: "45", label: "45" },
]

interface ScheduleTimeDialogProps {
  suggestion: Suggestion | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSchedule: (suggestion: Suggestion, scheduledFor: string, scope?: RecurringMutationScope) => void
  allSuggestions?: Suggestion[]
  /** Pre-fill date when dropping from calendar */
  defaultDateISO?: string
  /** Pre-fill hour when dropping from calendar */
  defaultHour?: number
  /** Pre-fill minute when dropping from calendar */
  defaultMinute?: number
}

export function ScheduleTimeDialog({
  suggestion,
  open,
  onOpenChange,
  onSchedule,
  allSuggestions = [],
  defaultDateISO,
  defaultHour,
  defaultMinute,
}: ScheduleTimeDialogProps) {
  const { timeZone } = useTimeZone()
  const [selectedDateISO, setSelectedDateISO] = useState<string | undefined>(undefined)
  const [selectedHour, setSelectedHour] = useState<string>("9")
  const [selectedMinute, setSelectedMinute] = useState<string>("0")
  const [selectedScope, setSelectedScope] = useState<RecurringMutationScope>("single")
  const datePickerRef = useRef<HTMLDivElement>(null)
  const datePickerInstanceRef = useRef<DatePickerInstance | null>(null)

  const seriesSuggestions = suggestion?.seriesId
    ? allSuggestions.filter((candidate) => candidate.seriesId === suggestion.seriesId)
    : []
  const hasRecurringSeries = suggestion != null && seriesSuggestions.length > 1
  const futureSeriesOccurrences = hasRecurringSeries && suggestion?.scheduledFor
    ? seriesSuggestions.filter((candidate) => {
        if (candidate.id === suggestion.id) return false
        if (candidate.status === "dismissed") return false
        if (!candidate.scheduledFor) return false
        return new Date(candidate.scheduledFor).getTime() > new Date(suggestion.scheduledFor!).getTime()
      }).length
    : 0
  const canApplyFuture = futureSeriesOccurrences > 0

  // Initialize defaults when `open` is controlled by the parent.
  // Radix Dialog's `onOpenChange` won't run on programmatic opens, so we must
  // set date/time defaults in an effect tied to `open`.
  //
  // See: docs/error-patterns/controlled-dialog-state-init.md
  useEffect(() => {
    if (!open || !suggestion) return
    setSelectedScope("single")

    // Use defaults if provided (from calendar drop), otherwise calculate.
    if (defaultDateISO !== undefined) {
      setSelectedDateISO(defaultDateISO)
      setSelectedHour(String(defaultHour ?? 9))
      setSelectedMinute(String(defaultMinute ?? 0))
      return
    }

    const now = Temporal.Now.zonedDateTimeISO(timeZone)
    if (now.hour >= 19) {
      setSelectedDateISO(now.toPlainDate().add({ days: 1 }).toString())
      setSelectedHour("9")
    } else {
      setSelectedDateISO(now.toPlainDate().toString())
      const nextHour = Math.min(Math.max(now.hour + 1, 8), 20)
      setSelectedHour(String(nextHour))
    }
    setSelectedMinute("0")
  }, [open, suggestion?.id, defaultDateISO, defaultHour, defaultMinute, timeZone])

  // Initialize Schedule-X date picker
  useEffect(() => {
    if (!datePickerRef.current || !open) return

    const today = Temporal.Now.zonedDateTimeISO(timeZone).toPlainDate()

    const selectedPlainDate = selectedDateISO ? Temporal.PlainDate.from(selectedDateISO) : today

    const datePicker = createDatePicker({
      locale: 'en-US',
      selectedDate: selectedPlainDate,
      min: today, // Disable past dates
      style: {
        dark: true,
        fullWidth: false,
      },
      listeners: {
        onChange: (plainDate) => {
          if (plainDate) {
            setSelectedDateISO(plainDate.toString())
          } else {
            setSelectedDateISO(undefined)
          }
        },
      },
    })

    datePicker.render(datePickerRef.current)
    datePickerInstanceRef.current = datePicker

    return () => {
      if (datePickerInstanceRef.current) {
        datePickerInstanceRef.current.destroy?.()
      }
    }
  }, [open, selectedDateISO, timeZone])

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen)
  }

  // Validate selected time is not in the past
  const isValidTime = useMemo(() => {
    if (!selectedDateISO) return false

    try {
      const now = Temporal.Now.zonedDateTimeISO(timeZone)
      const plainDate = Temporal.PlainDate.from(selectedDateISO)
      const selected = Temporal.ZonedDateTime.from({
        timeZone,
        year: plainDate.year,
        month: plainDate.month,
        day: plainDate.day,
        hour: parseInt(selectedHour, 10),
        minute: parseInt(selectedMinute, 10),
      })

      return Temporal.Instant.compare(selected.toInstant(), now.toInstant()) === 1
    } catch {
      return false
    }
  }, [selectedDateISO, selectedHour, selectedMinute, timeZone])

  const handleSchedule = () => {
    if (!suggestion || !selectedDateISO || !isValidTime) return

    const plainDate = Temporal.PlainDate.from(selectedDateISO)
    const scheduled = Temporal.ZonedDateTime.from({
      timeZone,
      year: plainDate.year,
      month: plainDate.month,
      day: plainDate.day,
      hour: parseInt(selectedHour, 10),
      minute: parseInt(selectedMinute, 10),
    })

    onSchedule(suggestion, scheduled.toInstant().toString(), selectedScope)
  }

  if (!suggestion) return null

  const Icon = categoryIcons[suggestion.category]
  const colors = categoryColors[suggestion.category]
  const isReschedule = suggestion.status === "scheduled"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-border/70 bg-card/95 backdrop-blur-xl max-w-md !left-1/2 !top-1/2 !-translate-x-1/2 !-translate-y-1/2">
        <DialogHeader>
          {/* Category badge */}
          <div className="flex items-center gap-3 mb-2">
            <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", colors.bg)}>
              <Icon className={cn("h-5 w-5", colors.text)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
                Schedule
              </p>
              <DialogTitle className="text-base leading-snug line-clamp-2 w-full">
                {suggestion.content}
              </DialogTitle>
            </div>
          </div>

          <DialogDescription className="sr-only">
            Pick a date and time to schedule this recovery activity
          </DialogDescription>
        </DialogHeader>

        {/* Date picker */}
        <div className="flex justify-center py-2">
          <div
            ref={datePickerRef}
            className="sx-date-picker-wrapper rounded-md border border-border/50"
          />
        </div>

        {/* Time picker */}
        <div className="flex items-center gap-4 py-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Time:</span>
          </div>

          <div className="flex items-center gap-2 flex-1">
            <Select value={selectedHour} onValueChange={setSelectedHour}>
              <SelectTrigger className="w-24">
                <SelectValue placeholder="Hour" />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((hour) => (
                  <SelectItem key={hour.value} value={hour.value}>
                    {hour.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-muted-foreground">:</span>

            <Select value={selectedMinute} onValueChange={setSelectedMinute}>
              <SelectTrigger className="w-20">
                <SelectValue placeholder="Min" />
              </SelectTrigger>
              <SelectContent>
                {MINUTES.map((minute) => (
                  <SelectItem key={minute.value} value={minute.value}>
                    {minute.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Duration info */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2 border-t border-border/50">
          <Clock className="h-4 w-4" />
          <span>Duration: {suggestion.duration} minutes</span>
        </div>

        {hasRecurringSeries ? (
          <div className="space-y-2 py-2 border-t border-border/50">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Apply to</p>
            <RadioGroup
              value={selectedScope}
              onValueChange={(value) => setSelectedScope(value as RecurringMutationScope)}
              className="gap-2"
            >
              <label className="flex items-start gap-2 rounded-md border border-border/60 p-2 cursor-pointer">
                <RadioGroupItem value="single" id="reschedule-scope-single" className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">This event only</p>
                  <p className="text-xs text-muted-foreground">Update only this occurrence.</p>
                </div>
              </label>

              {canApplyFuture ? (
                <label className="flex items-start gap-2 rounded-md border border-border/60 p-2 cursor-pointer">
                  <RadioGroupItem value="future" id="reschedule-scope-future" className="mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">This and future</p>
                    <p className="text-xs text-muted-foreground">
                      Update this occurrence and {futureSeriesOccurrences} upcoming one{futureSeriesOccurrences === 1 ? "" : "s"}.
                    </p>
                  </div>
                </label>
              ) : null}

              <label className="flex items-start gap-2 rounded-md border border-border/60 p-2 cursor-pointer">
                <RadioGroupItem value="all" id="reschedule-scope-all" className="mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Entire series</p>
                  <p className="text-xs text-muted-foreground">Shift every remaining occurrence in this series.</p>
                </div>
              </label>
            </RadioGroup>
          </div>
        ) : null}

        {/* Validation message */}
        {selectedDateISO && !isValidTime && (
          <p className="text-xs text-destructive">
            Please select a time in the future
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSchedule}
            disabled={!selectedDateISO || !isValidTime}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <CalendarPlus className="h-4 w-4 mr-2" />
            {isReschedule ? "Reschedule" : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
