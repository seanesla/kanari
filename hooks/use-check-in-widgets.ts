"use client"

import { useCallback, useEffect, useRef } from "react"
import type { Dispatch } from "react"
import type { GeminiWidgetEvent } from "@/lib/gemini/live-client"
import { useLocalCalendar } from "@/hooks/use-local-calendar"
import { useTimeZone } from "@/lib/timezone-context"
import type {
  CheckInMessage,
  JournalEntry,
  ScheduleActivityToolArgs,
  Suggestion,
  RecoveryBlock,
} from "@/lib/types"
import {
  clampDurationMinutes,
  extractDateISOFromText,
  extractExplicitTimeFromText,
  formatTimeHHMM,
  formatZonedDateTimeForMessage,
  inferScheduleCategory,
  inferScheduleDurationMinutes,
  inferScheduleTitle,
  isScheduleRequest,
  normalizeTimeToHHMM,
  parseZonedDateTimeInstant,
} from "@/lib/scheduling"
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

export function useCheckInWidgets(options: UseCheckInWidgetsOptions): UseCheckInWidgetsResult {
  const { data, dispatch, sendText, addUserTextMessage } = options
  const { scheduleEvent } = useLocalCalendar()
  const { timeZone } = useTimeZone()

  const widgetsRef = useRef(data.widgets)
  useEffect(() => {
    widgetsRef.current = data.widgets
  }, [data.widgets])

  // ========================================
  // Scheduling dedupe (prevents double events)
  // ========================================

  // Pattern doc: docs/error-patterns/schedule-activity-double-schedules.md
  const scheduledInstantsRef = useRef<Set<string>>(new Set())
  const lastSessionIdForDedupeRef = useRef<string | null>(null)

  useEffect(() => {
    const sessionId = data.session?.id ?? null
    if (sessionId !== lastSessionIdForDedupeRef.current) {
      scheduledInstantsRef.current.clear()
      lastSessionIdForDedupeRef.current = sessionId
    }
  }, [data.session?.id])

  const isDuplicateScheduledInstant = useCallback((scheduledFor: string): boolean => {
    return scheduledInstantsRef.current.has(scheduledFor)
  }, [])

  const markScheduledInstant = useCallback((scheduledFor: string) => {
    scheduledInstantsRef.current.add(scheduledFor)
  }, [])

  const unmarkScheduledInstant = useCallback((scheduledFor: string) => {
    scheduledInstantsRef.current.delete(scheduledFor)
  }, [])

  // ========================================
  // Storage Helpers (dynamic import)
  // ========================================

  const importStorageDb = useCallback(async () => {
    if (typeof indexedDB === "undefined") {
      throw new Error("IndexedDB not available")
    }
    return import("@/lib/storage/db")
  }, [])

  const addSuggestionToDb = useCallback(async (suggestion: Suggestion) => {
    const { db, fromSuggestion } = await importStorageDb()
    await db.suggestions.add(fromSuggestion(suggestion))
  }, [importStorageDb])

  const deleteSuggestionFromDb = useCallback(async (suggestionId: string) => {
    const { db } = await importStorageDb()
    await db.suggestions.delete(suggestionId)
  }, [importStorageDb])

  const addJournalEntryToDb = useCallback(async (entry: JournalEntry) => {
    const { db, fromJournalEntry } = await importStorageDb()
    await db.journalEntries.add(fromJournalEntry(entry))
  }, [importStorageDb])

  const addRecoveryBlockToDb = useCallback(async (block: RecoveryBlock) => {
    const { db, fromRecoveryBlock } = await importStorageDb()
    await db.recoveryBlocks.put(fromRecoveryBlock(block))
  }, [importStorageDb])

  const getRecoveryBlocksBySuggestionId = useCallback(async (suggestionId: string): Promise<RecoveryBlock[]> => {
    const { db, toRecoveryBlock } = await importStorageDb()
    const records = await db.recoveryBlocks.where("suggestionId").equals(suggestionId).toArray()
    return records.map(toRecoveryBlock)
  }, [importStorageDb])

  const deleteRecoveryBlockFromDb = useCallback(async (recoveryBlockId: string) => {
    const { db } = await importStorageDb()
    await db.recoveryBlocks.delete(recoveryBlockId)
  }, [importStorageDb])

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

          const normalizedTime = normalizeTimeToHHMM(args.time as string) ?? (args.time as string)
          const scheduledFor = parseZonedDateTimeInstant(args.date as string, normalizedTime, timeZone)

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
                  time: normalizedTime,
                  duration: args.duration,
                } as ScheduleActivityToolArgs,
                status: "failed",
                error: "Invalid date/time",
              },
            })
            return
          }

          if (isDuplicateScheduledInstant(scheduledFor)) {
            return
          }
          markScheduledInstant(scheduledFor)

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
                time: normalizedTime,
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
              unmarkScheduledInstant(scheduledFor)
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
        const normalizedToolTime = normalizeTimeToHHMM(event.args.time)
        const resolvedTime = userTime
          ? formatTimeHHMM(userTime)
          : normalizedToolTime ?? event.args.time

        const resolvedArgs: ScheduleActivityToolArgs = {
          ...event.args,
          time: resolvedTime,
        }

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

        if (isDuplicateScheduledInstant(scheduledFor)) {
          return
        }
        markScheduledInstant(scheduledFor)

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
            unmarkScheduledInstant(scheduledFor)
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

    if (!isScheduleRequest(lastUserMessage.content)) return

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

      const title = inferScheduleTitle(lastUserMessage.content)
      const category = inferScheduleCategory(lastUserMessage.content)
      const duration = clampDurationMinutes(inferScheduleDurationMinutes(lastUserMessage.content))

      const args: ScheduleActivityToolArgs = {
        title,
        category,
        date: dateISO,
        time: timeHHMM,
        duration,
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

      if (isDuplicateScheduledInstant(scheduledFor)) {
        return
      }
      markScheduledInstant(scheduledFor)

      const suggestion: Suggestion = {
        id: suggestionId,
        content: title,
        rationale: "Scheduled from chat (fallback)",
        duration,
        category,
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
              content: `Done — scheduled “${title}” for ${formatZonedDateTimeForMessage(args.date, args.time, timeZone)}.`,
              timestamp: new Date().toISOString(),
            }
            dispatch({ type: "ADD_MESSAGE", message: confirmationMessage })
          }
        } catch (error) {
          unmarkScheduledInstant(scheduledFor)
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
