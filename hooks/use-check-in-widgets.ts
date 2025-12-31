"use client"

import { useCallback } from "react"
import type { Dispatch } from "react"
import type { GeminiWidgetEvent } from "@/lib/gemini/live-client"
import type {
  JournalEntry,
  ScheduleActivityToolArgs,
  Suggestion,
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

function parseLocalDateTime(date: string, time: string): Date | null {
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
  if (day < 1 || day > 31) return null
  if (hour < 0 || hour > 23) return null
  if (minute < 0 || minute > 59) return null

  const dt = new Date(year, month - 1, day, hour, minute, 0, 0)

  // Guard against Date overflow rollovers (e.g., 2025-02-31)
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day ||
    dt.getHours() !== hour ||
    dt.getMinutes() !== minute
  ) {
    return null
  }

  return dt
}

export function useCheckInWidgets(options: UseCheckInWidgetsOptions): UseCheckInWidgetsResult {
  const { data, dispatch, sendText, addUserTextMessage } = options

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
    [deleteSuggestionFromDb, dispatch]
  )

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

          const scheduledAt = parseLocalDateTime(args.date as string, args.time as string)

          if (!scheduledAt) {
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
            scheduledFor: scheduledAt.toISOString(),
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
    [addSuggestionToDb, data.latestMismatch, dispatch]
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

        const scheduledAt = parseLocalDateTime(event.args.date, event.args.time)
        if (!scheduledAt) {
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
          content: event.args.title,
          rationale: "Scheduled from AI chat",
          duration: event.args.duration,
          category: event.args.category,
          status: "scheduled",
          createdAt: now,
          scheduledFor: scheduledAt.toISOString(),
        }

        // Optimistically show confirmation, then mark failed if Dexie write fails.
        dispatch({
          type: "ADD_WIDGET",
          widget: {
            id: widgetId,
            type: "schedule_activity",
            createdAt: now,
            args: event.args,
            status: "scheduled",
            suggestionId,
          },
        })

        void (async () => {
          try {
            await addSuggestionToDb(suggestion)
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
    [addSuggestionToDb, dispatch]
  )

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
