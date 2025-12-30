"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { Clock, CalendarPlus, Coffee, Dumbbell, Brain, Users, Moon } from "lucide-react"
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
import { createDatePicker } from "@schedule-x/date-picker"
import "@schedule-x/theme-default/dist/date-picker.css"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Suggestion, SuggestionCategory } from "@/lib/types"

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
  onSchedule: (suggestion: Suggestion, scheduledFor: string) => void
}

export function ScheduleTimeDialog({
  suggestion,
  open,
  onOpenChange,
  onSchedule,
}: ScheduleTimeDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedHour, setSelectedHour] = useState<string>("9")
  const [selectedMinute, setSelectedMinute] = useState<string>("0")
  const datePickerRef = useRef<HTMLDivElement>(null)
  const datePickerInstanceRef = useRef<any>(null)

  // Initialize Schedule-X date picker
  useEffect(() => {
    if (!datePickerRef.current || !open) return

    // Get today's date in YYYY-MM-DD format
    const now = new Date()
    const today = now.toISOString().split('T')[0]

    const datePicker = createDatePicker({
      locale: 'en-US',
      selectedDate: selectedDate ? selectedDate.toISOString().split('T')[0] : today,
      min: today, // Disable past dates
      style: {
        dark: true,
        fullWidth: false,
      },
      listeners: {
        onChange: (dateString) => {
          if (dateString) {
            // Convert YYYY-MM-DD string to Date object
            const [year, month, day] = dateString.split('-').map(Number)
            const date = new Date(year, month - 1, day)
            setSelectedDate(date)
          } else {
            setSelectedDate(undefined)
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
  }, [open])

  // Reset state when dialog opens with new suggestion
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && suggestion) {
      // Default to today or tomorrow if past 7 PM
      const now = new Date()
      if (now.getHours() >= 19) {
        const tomorrow = new Date(now)
        tomorrow.setDate(tomorrow.getDate() + 1)
        setSelectedDate(tomorrow)
        setSelectedHour("9")
      } else {
        setSelectedDate(now)
        // Default to next hour, clamped to 8-20
        const nextHour = Math.min(Math.max(now.getHours() + 1, 8), 20)
        setSelectedHour(String(nextHour))
      }
      setSelectedMinute("0")
    }
    onOpenChange(newOpen)
  }

  // Validate selected time is not in the past
  const isValidTime = useMemo(() => {
    if (!selectedDate) return false

    const now = new Date()
    const selected = new Date(selectedDate)
    selected.setHours(parseInt(selectedHour), parseInt(selectedMinute), 0, 0)

    return selected > now
  }, [selectedDate, selectedHour, selectedMinute])

  const handleSchedule = () => {
    if (!suggestion || !selectedDate || !isValidTime) return

    const scheduledFor = new Date(selectedDate)
    scheduledFor.setHours(parseInt(selectedHour), parseInt(selectedMinute), 0, 0)

    onSchedule(suggestion, scheduledFor.toISOString())
  }

  if (!suggestion) return null

  const Icon = categoryIcons[suggestion.category]
  const colors = categoryColors[suggestion.category]

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

        {/* Validation message */}
        {selectedDate && !isValidTime && (
          <p className="text-xs text-destructive">
            Please select a time in the future
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSchedule}
            disabled={!selectedDate || !isValidTime}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <CalendarPlus className="h-4 w-4 mr-2" />
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
