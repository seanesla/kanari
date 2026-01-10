"use client"

import { useCallback, useEffect, useRef } from "react"
import type { Dispatch } from "react"
import type { GeminiWidgetEvent } from "@/lib/gemini/live-client"
import { useLocalCalendar } from "@/hooks/use-local-calendar"
import { useTimeZone } from "@/lib/timezone-context"
import { Temporal } from "temporal-polyfill"
import type {
  CheckInMessage,
  JournalEntry,
  ScheduleActivityToolArgs,
  Suggestion,
  RecoveryBlock,
} from "@/lib/types"
import { generateId, type CheckInAction, type CheckInData } from "./use-check-in-messages"

export interface UseCheckInWidgetsOptions {
  data: CheckInData
  dispatch: Dispatch<CheckInAction>
  sendText: (text: string) => void
  addUserTextMessage: (text: string) => void
}

export interface CheckInWidgetsGeminiHandlers {
  onWidget: (event: GeminiWidgetEvent) => void
}

export interface UseCheckInWidgetsResult {
  dismissWidget: (widgetId: string) => void
  undoScheduledActivity: (widgetId: string, suggestionId: string) => Promise<void>
  runQuickAction: (widgetId: string, action: string, label?: string) => void
  saveJournalEntry: (widgetId: string, content: string) => Promise<void>
  triggerManualTool: (toolName: string, args: Record<string, unknown>) => void
  handlers: CheckInWidgetsGeminiHandlers
}

interface ParsedTime {
  hour: number
  minute: number
}

function parseTimeHHMM(time: string): ParsedTime | null {
  const [hourStr, minuteStr] = time.split(":")
  const hour = Number(hourStr)
  const minute = Number(minuteStr)

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null
  if (hour < 0 || hour > 23) return null
  if (minute < 0 || minute > 59) return null

  return { hour, minute }
}

function formatTimeHHMM(time: ParsedTime): string {
  return `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`
}

function to24Hour(hour12: number, meridiem: "am" | "pm"): number {
  const normalized = hour12 % 12
  return meridiem === "pm" ? normalized + 12 : normalized
}

function extractExplicitTimeFromText(text: string): ParsedTime | null {
  // This is intentionally conservative: only treat a time as "explicit" when
  // the user provides AM/PM (or 24h time with hour>=13). This prevents us from
  // overriding the model when the user says something ambiguous like "at 9:30".
  const input = text.toLowerCase()

  const foundTimes = new Map<string, ParsedTime>()

  const push = (t: ParsedTime) => {
    const key = formatTimeHHMM(t)
    foundTimes.set(key, t)
  }

  // e.g. "9:30pm", "9:30 pm", "9.30 p.m."
  for (const match of input.matchAll(/\b(1[0-2]|0?[1-9])\s*[:.]\s*([0-5]\d)\s*(a\.?m|p\.?m)\b/g)) {
    const hour12 = Number(match[1])
    const minute = Number(match[2])
    const meridiem = match[3]?.startsWith("p") ? "pm" : "am"
    push({ hour: to24Hour(hour12, meridiem), minute })
  }

  // e.g. "9 30 pm" (common speech-to-text variant)
  for (const match of input.matchAll(/\b(1[0-2]|0?[1-9])\s+([0-5]\d)\s*(a\.?m|p\.?m)\b/g)) {
    const hour12 = Number(match[1])
    const minute = Number(match[2])
    const meridiem = match[3]?.startsWith("p") ? "pm" : "am"
    push({ hour: to24Hour(hour12, meridiem), minute })
  }

  // e.g. "9pm", "9 pm", "9 p.m."
  for (const match of input.matchAll(/\b(1[0-2]|0?[1-9])\s*(a\.?m|p\.?m)\b/g)) {
    const hour12 = Number(match[1])
    const meridiem = match[2]?.startsWith("p") ? "pm" : "am"
    push({ hour: to24Hour(hour12, meridiem), minute: 0 })
  }

  // e.g. "21:30" (24h). Only accept hour>=13 to avoid ambiguity with "9:30".
  for (const match of input.matchAll(/\b([01]?\d|2[0-3])\s*[:.]\s*([0-5]\d)\b/g)) {
    const hour = Number(match[1])
    if (hour < 13) continue
    const minute = Number(match[2])
    push({ hour, minute })
  }

  if (foundTimes.size !== 1) return null
  return foundTimes.values().next().value ?? null
}

function extractDateISOFromText(text: string, timeZone: string): string | null {
  const input = text.toLowerCase()

  const explicitDate = input.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0]
  if (explicitDate) return explicitDate

  const today = Temporal.Now.zonedDateTimeISO(timeZone).toPlainDate()

  if (input.includes("tomorrow")) {
    return today.add({ days: 1 }).toString()
  }

  if (input.includes("today") || input.includes("tonight")) {
    return today.toString()
  }

  return null
}

function isCheckInScheduleRequest(text: string): boolean {
  const input = text.toLowerCase()
  return input.includes("schedule") && (input.includes("check-in") || input.includes("check in"))
}

function formatZonedDateTimeForMessage(dateISO: string, timeHHMM: string, timeZone: string): string {
  const [year, month, day] = dateISO.split("-").map(Number)
  const [hour, minute] = timeHHMM.split(":").map(Number)

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

function parseZonedDateTimeInstant(date: string, time: string, timeZone: string): string | null {
  const [yearStr, monthStr, dayStr] = date.split("-")
  const [hourStr, minuteStr] = time.split(":")

  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)
  const hour = Number(hourStr)
  const minute = Number(minuteStr)

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return null
  }

  if (month < 1 || month > 12) return null
  if (hour < 0 || hour > 23) return null
  if (minute < 0 || minute > 59) return null

  try {
    // Parse via ISO string to reject overflow dates like 2024-02-31.
    const plainDateTime = Temporal.PlainDateTime.from(`${yearStr}-${monthStr}-${dayStr}T${hourStr}:${minuteStr}`)
    const zdt = plainDateTime.toZonedDateTime(timeZone)
    return zdt.toInstant().toString()
  } catch {
    return null
  }
}

export function useCheckInWidgets(options: UseCheckInWidgetsOptions): UseCheckInWidgetsResult {
  const { data, dispatch, sendText, addUserTextMessage } = options
  const { isConnected: isCalendarConnected, scheduleEvent, deleteEvent } = useLocalCalendar()
  const { timeZone } = useTimeZone()

  const widgetsRef = useRef(data.widgets)
  useEffect(() => {
    widgetsRef.current = data.widgets
  }, [data.widgets])

  // ========================================
  // Storage Helpers (dynamic import)
  // ========================================

  const addSuggestionToDb = useCallback(async (suggestion: Suggestion) => {
    if (typeof indexedDB === "undefined") {
      throw new Error("IndexedDB not available")
    }
    const { db, fromSuggestion } = await import("@/lib/storage/db")
    await db.suggestions.add(fromSuggestion(suggestion))
  }, [])

  const deleteSuggestionFromDb = useCallback(async (suggestionId: string) => {
    if (typeof indexedDB === "undefined") {
      throw new Error("IndexedDB not available")
    }
    const { db } = await import("@/lib/storage/db")
    await db.suggestions.delete(suggestionId)
  }, [])

  const addJournalEntryToDb = useCallback(async (entry: JournalEntry) => {
    if (typeof indexedDB === "undefined") {
      throw new Error("IndexedDB not available")
    }
    const { db, fromJournalEntry } = await import("@/lib/storage/db")
    await db.journalEntries.add(fromJournalEntry(entry))
  }, [])

  const addRecoveryBlockToDb = useCallback(async (block: RecoveryBlock) => {
    if (typeof indexedDB === "undefined") {
      throw new Error("IndexedDB not available")
    }
    const { db, fromRecoveryBlock } = await import("@/lib/storage/db")
    await db.recoveryBlocks.put(fromRecoveryBlock(block))
  }, [])

  const getRecoveryBlocksBySuggestionId = useCallback(async (suggestionId: string): Promise<RecoveryBlock[]> => {
    if (typeof indexedDB === "undefined") {
      throw new Error("IndexedDB not available")
    }
    const { db, toRecoveryBlock } = await import("@/lib/storage/db")
    const records = await db.recoveryBlocks.where("suggestionId").equals(suggestionId).toArray()
    return records.map(toRecoveryBlock)
  }, [])

  const deleteRecoveryBlockFromDb = useCallback(async (recoveryBlockId: string) => {
    if (typeof indexedDB === "undefined") {
      throw new Error("IndexedDB not available")
    }
    const { db } = await import("@/lib/storage/db")
    await db.recoveryBlocks.delete(recoveryBlockId)
  }, [])

  // ========================================
  // Widget Controls
  // ========================================

  const dismissWidget = useCallback(
    (widgetId: string) => {
      dispatch({ type: "DISMISS_WIDGET", widgetId })
    },
    [dispatch]
  )

  const undoScheduledActivity = useCallback(
    async (widgetId: string, suggestionId: string) => {
      try {
        // Cleanup local recovery blocks for this suggestion.
        try {
          const recoveryBlocks = await getRecoveryBlocksBySuggestionId(suggestionId)
          await Promise.all(recoveryBlocks.map((block) => deleteRecoveryBlockFromDb(block.id)))
        } catch (cleanupError) {
          // Don't block undo if cleanup fails; surface the error on the widget.
          dispatch({
            type: "UPDATE_WIDGET",
            widgetId,
            updates: {
              error:
                cleanupError instanceof Error
                  ? cleanupError.message
                  : "Failed to remove calendar event",
            },
          })
        }

        await deleteSuggestionFromDb(suggestionId)
        dispatch({ type: "DISMISS_WIDGET", widgetId })
      } catch (error) {
        dispatch({
          type: "UPDATE_WIDGET",
          widgetId,
          updates: {
            error: error instanceof Error ? error.message : "Failed to undo",
          },
        })
      }
    },
    [
      deleteRecoveryBlockFromDb,
      deleteSuggestionFromDb,
      dispatch,
      getRecoveryBlocksBySuggestionId,
    ]
  )

  const syncSuggestionToCalendar = useCallback(async (widgetId: string, suggestion: Suggestion): Promise<boolean> => {
    // Local calendar is always connected
    const block = await scheduleEvent(suggestion, { timeZone })
    if (!block) {
      dispatch({
        type: "UPDATE_WIDGET",
        widgetId,
        updates: {
          error: "Failed to save calendar event",
        },
      })
      return false
    }

    try {
      await addRecoveryBlockToDb(block)
      return true
    } catch (persistError) {
      dispatch({
        type: "UPDATE_WIDGET",
        widgetId,
        updates: {
          error:
            persistError instanceof Error
              ? persistError.message
              : "Failed to persist calendar event",
        },
      })
      return false
    }
  }, [addRecoveryBlockToDb, dispatch, scheduleEvent, timeZone])

  const runQuickAction = useCallback(
    (widgetId: string, action: string, label?: string) => {
      const textToShow = (label?.trim() || action).trim()
      if (!textToShow) return

      addUserTextMessage(textToShow)
      dispatch({ type: "SET_PROCESSING" })
      sendText(action)
      dispatch({ type: "DISMISS_WIDGET", widgetId })
    },
    [addUserTextMessage, dispatch, sendText]
  )

  const saveJournalEntry = useCallback(
    async (widgetId: string, content: string) => {
      const trimmed = content.trim()
      if (!trimmed) return

      const widget = data.widgets.find((w) => w.id === widgetId && w.type === "journal_prompt")

      if (!widget || widget.type !== "journal_prompt") {
        console.warn("[useCheckIn] Journal widget not found:", widgetId)
        return
      }

      const entry: JournalEntry = {
        id: generateId(),
        createdAt: new Date().toISOString(),
        category: widget.args.category || "journal",
        prompt: widget.args.prompt,
        content: trimmed,
        checkInSessionId: data.session?.id,
      }

      try {
        await addJournalEntryToDb(entry)
        dispatch({
          type: "UPDATE_WIDGET",
          widgetId,
          updates: {
            status: "saved",
            entryId: entry.id,
            error: undefined,
          },
        })
      } catch (error) {
        dispatch({
          type: "UPDATE_WIDGET",
          widgetId,
          updates: {
            status: "failed",
            error: error instanceof Error ? error.message : "Failed to save",
          },
        })
      }
    },
    [addJournalEntryToDb, data.session?.id, data.widgets, dispatch]
  )

  // ========================================
  // Manual Tool Triggering
  // ========================================

  const triggerManualTool = useCallback(
    (toolName: string, args: Record<string, unknown>) => {
      const now = new Date().toISOString()

      switch (toolName) {
        case "show_breathing_exercise": {
          dispatch({
            type: "ADD_WIDGET",
            widget: {
              id: generateId(),
              type: "breathing_exercise",
              createdAt: now,
              args: {
                type: (args.type as "box" | "478" | "relaxing") || "box",
                duration: (args.duration as number) || 120,
              },
            },
          })
          break
        }

        case "schedule_activity": {
          const widgetId = generateId()
          const suggestionId = generateId()

          const scheduledFor = parseZonedDateTimeInstant(args.date as string, args.time as string, timeZone)

          if (!scheduledFor) {
            dispatch({
              type: "ADD_WIDGET",
              widget: {
                id: widgetId,
                type: "schedule_activity",
                createdAt: now,
                args: {
                  title: args.title,
                  category: args.category,
                  date: args.date,
                  time: args.time,
                  duration: args.duration,
                } as ScheduleActivityToolArgs,
                status: "failed",
                error: "Invalid date/time",
              },
            })
            return
          }

          const suggestion: Suggestion = {
            id: suggestionId,
            content: args.title as string,
            rationale: "Manually scheduled from chat",
            duration: args.duration as number,
            category: args.category as "break" | "exercise" | "mindfulness" | "social" | "rest",
            status: "scheduled",
            createdAt: now,
            scheduledFor,
          }

          dispatch({
            type: "ADD_WIDGET",
            widget: {
              id: widgetId,
              type: "schedule_activity",
              createdAt: now,
              args: {
                title: args.title,
                category: args.category,
                date: args.date,
                time: args.time,
                duration: args.duration,
              } as ScheduleActivityToolArgs,
              status: "scheduled",
              suggestionId,
            },
          })

          void (async () => {
            try {
              await addSuggestionToDb(suggestion)
              await syncSuggestionToCalendar(widgetId, suggestion)
            } catch (error) {
              dispatch({
                type: "UPDATE_WIDGET",
                widgetId,
                updates: {
                  status: "failed",
                  error: error instanceof Error ? error.message : "Failed to save",
                  suggestionId: undefined,
                },
              })
            }
          })()
          break
        }

        case "show_stress_gauge": {
          // For manual trigger without args, use defaults or latest mismatch data
          dispatch({
            type: "ADD_WIDGET",
            widget: {
              id: generateId(),
              type: "stress_gauge",
              createdAt: now,
              args: {
                stressLevel:
                  (args.stressLevel as number) ??
                  (data.latestMismatch?.acousticSignal === "stressed" ? 70 : 40),
                fatigueLevel:
                  (args.fatigueLevel as number) ??
                  (data.latestMismatch?.acousticSignal === "fatigued" ? 70 : 40),
                message: (args.message as string) || "Manual check-in",
              },
            },
          })
          break
        }

        case "show_journal_prompt": {
          // Generate a default prompt based on category or use provided
          const category = (args.category as string) || "reflection"
          const defaultPrompts: Record<string, string> = {
            reflection: "What's on your mind right now?",
            gratitude: "What are you grateful for today?",
            stress: "What's causing you stress, and how can you address it?",
          }

          dispatch({
            type: "ADD_WIDGET",
            widget: {
              id: generateId(),
              type: "journal_prompt",
              createdAt: now,
              args: {
                prompt: (args.prompt as string) || defaultPrompts[category] || defaultPrompts.reflection,
                placeholder: (args.placeholder as string) || "Write your thoughts here...",
                category,
              },
              status: "draft",
            },
          })
          break
        }

        default:
          console.warn("[useCheckIn] Unknown manual tool:", toolName)
      }
    },
    [addSuggestionToDb, data.latestMismatch, dispatch, syncSuggestionToCalendar, timeZone]
  )

  // ========================================
  // Gemini Live widget handler
  // ========================================

  const onWidget = useCallback(
    (event: GeminiWidgetEvent) => {
      const now = new Date().toISOString()

      if (event.widget === "schedule_activity") {
        const widgetId = generateId()
        const suggestionId = generateId()

        // Some models occasionally mis-convert (or round) times even when the user
        // explicitly says "9:30PM" etc. We conservatively prefer the explicit time
        // from the most recent user message when it is unambiguous.
        // Pattern doc: docs/error-patterns/schedule-activity-user-time-mismatch.md
        const lastUserMessage = [...data.messages].reverse().find((m) => m.role === "user")?.content ?? ""
        const userTime = extractExplicitTimeFromText(lastUserMessage)
        const toolTime = parseTimeHHMM(event.args.time)
        const resolvedTime = userTime
          ? formatTimeHHMM(userTime)
          : event.args.time

        // Only override if tool time parses (it always should) and user time is explicit.
        const resolvedArgs: ScheduleActivityToolArgs = toolTime && userTime
          ? { ...event.args, time: resolvedTime }
          : event.args

        const scheduledFor = parseZonedDateTimeInstant(resolvedArgs.date, resolvedArgs.time, timeZone)
        if (!scheduledFor) {
          dispatch({
            type: "ADD_WIDGET",
            widget: {
              id: widgetId,
              type: "schedule_activity",
              createdAt: now,
              args: event.args,
              status: "failed",
              error: "Invalid date/time",
            },
          })
          return
        }

        const suggestion: Suggestion = {
          id: suggestionId,
          content: resolvedArgs.title,
          rationale: "Scheduled from AI chat",
          duration: resolvedArgs.duration,
          category: resolvedArgs.category,
          status: "scheduled",
          createdAt: now,
          scheduledFor,
        }

        // Optimistically show confirmation, then mark failed if Dexie write fails.
        dispatch({
          type: "ADD_WIDGET",
          widget: {
            id: widgetId,
            type: "schedule_activity",
            createdAt: now,
            args: resolvedArgs,
            status: "scheduled",
            suggestionId,
          },
        })

        void (async () => {
          try {
            await addSuggestionToDb(suggestion)
            const synced = await syncSuggestionToCalendar(widgetId, suggestion)
            if (synced) {
              const confirmationMessage: CheckInMessage = {
                id: generateId(),
                role: "assistant",
                content: `Done — scheduled “${resolvedArgs.title}” for ${formatZonedDateTimeForMessage(resolvedArgs.date, resolvedArgs.time, timeZone)}.`,
                timestamp: new Date().toISOString(),
              }
              dispatch({ type: "ADD_MESSAGE", message: confirmationMessage })
            }
          } catch (error) {
            dispatch({
              type: "UPDATE_WIDGET",
              widgetId,
              updates: {
                status: "failed",
                error: error instanceof Error ? error.message : "Failed to save",
                suggestionId: undefined,
              },
            })
          }
        })()
        return
      }

      if (event.widget === "breathing_exercise") {
        dispatch({
          type: "ADD_WIDGET",
          widget: {
            id: generateId(),
            type: "breathing_exercise",
            createdAt: now,
            args: event.args,
          },
        })
        return
      }

      if (event.widget === "stress_gauge") {
        dispatch({
          type: "ADD_WIDGET",
          widget: {
            id: generateId(),
            type: "stress_gauge",
            createdAt: now,
            args: event.args,
          },
        })
        return
      }

      if (event.widget === "quick_actions") {
        dispatch({
          type: "ADD_WIDGET",
          widget: {
            id: generateId(),
            type: "quick_actions",
            createdAt: now,
            args: event.args,
          },
        })
        return
      }

      if (event.widget === "journal_prompt") {
        dispatch({
          type: "ADD_WIDGET",
          widget: {
            id: generateId(),
            type: "journal_prompt",
            createdAt: now,
            args: event.args,
            status: "draft",
          },
        })
      }
    },
    [addSuggestionToDb, data.messages, dispatch, syncSuggestionToCalendar, timeZone]
  )

  // ========================================
  // Client-side fallback: schedule next check-in
  // ========================================

  const autoScheduleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAutoScheduledMessageIdRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (autoScheduleTimeoutRef.current) {
        clearTimeout(autoScheduleTimeoutRef.current)
        autoScheduleTimeoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const lastUserMessage = [...data.messages].reverse().find((m) => m.role === "user")
    if (!lastUserMessage) return
    if (lastAutoScheduledMessageIdRef.current === lastUserMessage.id) return

    if (!isCheckInScheduleRequest(lastUserMessage.content)) return

    const dateISO = extractDateISOFromText(lastUserMessage.content, timeZone)
    const timeParts = extractExplicitTimeFromText(lastUserMessage.content)
    if (!dateISO || !timeParts) return

    lastAutoScheduledMessageIdRef.current = lastUserMessage.id

    if (autoScheduleTimeoutRef.current) {
      clearTimeout(autoScheduleTimeoutRef.current)
      autoScheduleTimeoutRef.current = null
    }

    // Give Gemini a brief window to issue `schedule_activity` so we don't double-schedule.
    // Pattern doc: docs/error-patterns/schedule-check-in-doesnt-create-event.md
    const messageTimestampMs = new Date(lastUserMessage.timestamp).getTime()
    autoScheduleTimeoutRef.current = setTimeout(() => {
      const alreadyScheduledByGemini = widgetsRef.current.some((w) => {
        if (w.type !== "schedule_activity") return false
        if (w.status !== "scheduled") return false
        return new Date(w.createdAt).getTime() >= messageTimestampMs - 250
      })

      if (alreadyScheduledByGemini) return

      const widgetId = generateId()
      const suggestionId = generateId()
      const now = new Date().toISOString()
      const timeHHMM = formatTimeHHMM(timeParts)
      const scheduledFor = parseZonedDateTimeInstant(dateISO, timeHHMM, timeZone)

      const args: ScheduleActivityToolArgs = {
        title: "Check-in",
        category: "rest",
        date: dateISO,
        time: timeHHMM,
        duration: 20,
      }

      if (!scheduledFor) {
        dispatch({
          type: "ADD_WIDGET",
          widget: {
            id: widgetId,
            type: "schedule_activity",
            createdAt: now,
            args,
            status: "failed",
            error: "Invalid date/time",
          },
        })
        return
      }

      const suggestion: Suggestion = {
        id: suggestionId,
        content: "Check-in",
        rationale: "Scheduled check-in reminder",
        duration: args.duration,
        category: args.category,
        status: "scheduled",
        createdAt: now,
        scheduledFor,
      }

      dispatch({
        type: "ADD_WIDGET",
        widget: {
          id: widgetId,
          type: "schedule_activity",
          createdAt: now,
          args,
          status: "scheduled",
          suggestionId,
        },
      })

      void (async () => {
        try {
          await addSuggestionToDb(suggestion)
          const synced = await syncSuggestionToCalendar(widgetId, suggestion)
          if (synced) {
            const confirmationMessage: CheckInMessage = {
              id: generateId(),
              role: "assistant",
              content: `Done — scheduled “Check-in” for ${formatZonedDateTimeForMessage(args.date, args.time, timeZone)}.`,
              timestamp: new Date().toISOString(),
            }
            dispatch({ type: "ADD_MESSAGE", message: confirmationMessage })
          }
        } catch (error) {
          dispatch({
            type: "UPDATE_WIDGET",
            widgetId,
            updates: {
              status: "failed",
              error: error instanceof Error ? error.message : "Failed to save",
              suggestionId: undefined,
            },
          })
        }
      })()
    }, 1200)
  }, [addSuggestionToDb, data.messages, dispatch, syncSuggestionToCalendar, timeZone, widgetsRef])

  const handlers: CheckInWidgetsGeminiHandlers = {
    onWidget,
  }

  return {
    dismissWidget,
    undoScheduledActivity,
    runQuickAction,
    saveJournalEntry,
    triggerManualTool,
    handlers,
  }
}
