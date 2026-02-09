"use client"

import { useCallback, useEffect, useRef } from "react"
import type { Dispatch } from "react"
import { Temporal } from "temporal-polyfill"
import type { GeminiWidgetEvent } from "@/lib/gemini/live-client"
import { useLocalCalendar } from "@/hooks/use-local-calendar"
import { useTimeZone } from "@/lib/timezone-context"
import type {
  CancelRecurringActivityToolArgs,
  CheckInMessage,
  EditRecurringActivityToolArgs,
  RecurringMutationScope,
  JournalEntry,
  RecurringSeries,
  ScheduleActivityToolArgs,
  ScheduleRecurringActivityToolArgs,
  Suggestion,
  RecoveryBlock,
} from "@/lib/types"
import {
  MAX_RECURRING_SCHEDULE_OCCURRENCES,
  clampDurationMinutes,
  expandRecurringScheduleOccurrences,
  extractDurationMinutesFromText,
  extractDateISOFromText,
  extractExplicitTimeFromText,
  formatTimeHHMM,
  formatZonedDateTimeForMessage,
  inferScheduleCategory,
  inferScheduleTitle,
  isScheduleRequest,
  normalizeTimeToHHMM,
  parseZonedDateTimeInstant,
} from "@/lib/scheduling"
import {
  createRecurringSeriesRecord,
  deleteRecurringSeriesRecord,
  dismissSuggestionWithScope,
  findActiveRecurringSeriesByTitle,
  findSeriesAnchorSuggestion,
  getSuggestionsForSeries,
  rescheduleSuggestionWithScope,
} from "@/lib/scheduling/series-store"
import { generateId, type CheckInAction, type CheckInData } from "./use-check-in-messages"

type StorageDbModule = typeof import("@/lib/storage/db")

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

const GENERIC_ACTIVITY_TITLES = new Set([
  "activity",
  "scheduled activity",
  "rest activity",
  "recovery activity",
  "self-care activity",
])

const CHECK_IN_ACTIVITY_TITLES = new Set([
  "check-in",
  "check in",
  "checkin",
])

function isGenericActivityTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase()
  return GENERIC_ACTIVITY_TITLES.has(normalized)
}

function isCheckInActivityTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase()
  return CHECK_IN_ACTIVITY_TITLES.has(normalized)
}

function userRequestedCheckIn(text: string): boolean {
  return /\bcheck[\s-]?in\b/i.test(text)
}

function normalizeScheduleDedupeTitle(title: string): string {
  const normalized = title.trim().toLowerCase().replace(/\s+/g, " ")
  return normalized || "untitled"
}

function formatInstantToSeriesParts(
  instantISO: string,
  timeZone: string
): { date: string; time: string } | null {
  try {
    const zdt = Temporal.Instant.from(instantISO).toZonedDateTimeISO(timeZone)
    return {
      date: zdt.toPlainDate().toString(),
      time: `${String(zdt.hour).padStart(2, "0")}:${String(zdt.minute).padStart(2, "0")}`,
    }
  } catch {
    return null
  }
}

function formatScopeLabel(scope: RecurringMutationScope): string {
  if (scope === "single") return "this occurrence"
  if (scope === "future") return "this and future occurrences"
  return "the entire series"
}

function resolveScheduleArgsFromUserMessage(
  toolArgs: ScheduleActivityToolArgs,
  userScheduleContext: string
): ScheduleActivityToolArgs {
  const explicitDurationMinutes = extractDurationMinutesFromText(userScheduleContext)
  const inferredUserTitle = inferScheduleTitle(userScheduleContext)
  const userAskedForCheckIn = userRequestedCheckIn(userScheduleContext)

  // Pattern doc: docs/error-patterns/schedule-activity-generic-title-duration-drift.md
  // Pattern doc: docs/error-patterns/schedule-activity-title-duration-override-miss.md
  const shouldPreferUserTitle =
    inferredUserTitle !== "Scheduled activity"
    && (
      isGenericActivityTitle(toolArgs.title)
      || !toolArgs.title.trim()
      || (isCheckInActivityTitle(toolArgs.title) && !userAskedForCheckIn)
    )

  const resolvedTitle = shouldPreferUserTitle ? inferredUserTitle : toolArgs.title

  // Pattern doc: docs/error-patterns/schedule-activity-user-time-mismatch.md
  const userTime = extractExplicitTimeFromText(userScheduleContext)
  const normalizedToolTime = normalizeTimeToHHMM(toolArgs.time)
  const resolvedTime = userTime
    ? formatTimeHHMM(userTime)
    : normalizedToolTime ?? toolArgs.time

  return {
    ...toolArgs,
    title: resolvedTitle,
    time: resolvedTime,
    duration: clampDurationMinutes(explicitDurationMinutes ?? toolArgs.duration),
  }
}

function getLatestScheduleIntentUserContext(messages: CheckInMessage[]): string {
  // Build context from the latest scheduling intent, not just the latest user bubble.
  // This preserves details when users provide time/title/duration across short pauses.
  // Pattern doc: docs/error-patterns/schedule-transcript-short-pause-context-loss.md
  const userMessages = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter(Boolean)

  if (userMessages.length === 0) return ""

  let latestScheduleRequestIndex = -1
  for (let index = userMessages.length - 1; index >= 0; index -= 1) {
    if (isScheduleRequest(userMessages[index] ?? "")) {
      latestScheduleRequestIndex = index
      break
    }
  }

  const relevantMessages =
    latestScheduleRequestIndex >= 0
      ? userMessages.slice(latestScheduleRequestIndex)
      : userMessages.slice(-1)

  return relevantMessages
    .slice(-8)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
}

export function useCheckInWidgets(options: UseCheckInWidgetsOptions): UseCheckInWidgetsResult {
  const { data, dispatch, sendText, addUserTextMessage } = options
  const { scheduleEvent } = useLocalCalendar()
  const { timeZone } = useTimeZone()

  const widgetsRef = useRef(data.widgets)
  useEffect(() => {
    widgetsRef.current = data.widgets
  }, [data.widgets])

  // Cache one dynamic storage-module import per hook instance.
  // Concurrent scheduling writes can otherwise resolve mixed module instances in
  // tests, which may bypass mocks and call real Dexie (`indexedDB.open`).
  // Pattern doc: docs/error-patterns/check-in-widgets-dynamic-db-import-race.md
  const storageDbModuleRef = useRef<StorageDbModule | null>(null)
  const storageDbImportPromiseRef = useRef<Promise<StorageDbModule> | null>(null)

  // ========================================
  // Scheduling dedupe (prevents double events)
  // ========================================

  // Pattern doc: docs/error-patterns/schedule-activity-double-schedules.md
  const scheduledEventKeysRef = useRef<Set<string>>(new Set())
  const lastSessionIdForDedupeRef = useRef<string | null>(null)

  useEffect(() => {
    const sessionId = data.session?.id ?? null
    if (sessionId !== lastSessionIdForDedupeRef.current) {
      scheduledEventKeysRef.current.clear()
      lastSessionIdForDedupeRef.current = sessionId
    }
  }, [data.session?.id])

  const buildScheduleDedupeKey = useCallback((scheduledFor: string, title: string): string => {
    return `${scheduledFor}::${normalizeScheduleDedupeTitle(title)}`
  }, [])

  const isDuplicateScheduledEvent = useCallback((scheduledFor: string, title: string): boolean => {
    return scheduledEventKeysRef.current.has(buildScheduleDedupeKey(scheduledFor, title))
  }, [buildScheduleDedupeKey])

  const markScheduledEvent = useCallback((scheduledFor: string, title: string) => {
    scheduledEventKeysRef.current.add(buildScheduleDedupeKey(scheduledFor, title))
  }, [buildScheduleDedupeKey])

  const unmarkScheduledEvent = useCallback((scheduledFor: string, title: string) => {
    scheduledEventKeysRef.current.delete(buildScheduleDedupeKey(scheduledFor, title))
  }, [buildScheduleDedupeKey])

  // ========================================
  // Storage Helpers (dynamic import)
  // ========================================

  const importStorageDb = useCallback(async () => {
    if (typeof indexedDB === "undefined") {
      throw new Error("IndexedDB not available")
    }

    if (storageDbModuleRef.current) {
      return storageDbModuleRef.current
    }

    if (!storageDbImportPromiseRef.current) {
      storageDbImportPromiseRef.current = import("@/lib/storage/db")
        .then((module) => {
          storageDbModuleRef.current = module
          return module
        })
        .catch((error) => {
          storageDbImportPromiseRef.current = null
          throw error
        })
    }

    return storageDbImportPromiseRef.current
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

  const syncSuggestionToCalendar = useCallback(async (suggestion: Suggestion): Promise<void> => {
    // Local calendar is always connected
    const block = await scheduleEvent(suggestion, { timeZone })
    if (!block) {
      throw new Error("Failed to save calendar event")
    }

    await addRecoveryBlockToDb({
      ...block,
      seriesId: suggestion.seriesId,
      occurrenceDate: suggestion.occurrenceDate,
    })
  }, [addRecoveryBlockToDb, scheduleEvent, timeZone])

  const scheduleSingleActivity = useCallback(
    async (
      args: ScheduleActivityToolArgs,
      options: {
        rationale: string
        createdAt?: string
        scheduledForOverride?: string
        checkInSessionId?: string
        seriesId?: string
        occurrenceDate?: string
        occurrenceIndex?: number
        emitWidget?: boolean
      }
    ): Promise<"scheduled" | "failed" | "duplicate"> => {
      const createdAt = options.createdAt ?? new Date().toISOString()
      // Pattern doc: docs/error-patterns/recurring-schedule-per-occurrence-confirmation-spam.md
      const emitWidget = options.emitWidget ?? true
      const normalizedTime = normalizeTimeToHHMM(args.time) ?? args.time
      const resolvedArgs: ScheduleActivityToolArgs = {
        ...args,
        time: normalizedTime,
        duration: clampDurationMinutes(args.duration),
      }

      const widgetId = emitWidget ? generateId() : null
      const suggestionId = generateId()
      const scheduledFor = options.scheduledForOverride ?? parseZonedDateTimeInstant(
        resolvedArgs.date,
        resolvedArgs.time,
        timeZone
      )

      if (!scheduledFor) {
        if (emitWidget && widgetId) {
          dispatch({
            type: "ADD_WIDGET",
            widget: {
              id: widgetId,
              type: "schedule_activity",
              createdAt,
              args: resolvedArgs,
              status: "failed",
              error: "Invalid date/time",
            },
          })
        }
        return "failed"
      }

      if (isDuplicateScheduledEvent(scheduledFor, resolvedArgs.title)) {
        return "duplicate"
      }
      markScheduledEvent(scheduledFor, resolvedArgs.title)

      const suggestion: Suggestion = {
        id: suggestionId,
        checkInSessionId: options.checkInSessionId,
        seriesId: options.seriesId,
        occurrenceDate: options.occurrenceDate,
        occurrenceIndex: options.occurrenceIndex,
        content: resolvedArgs.title,
        rationale: options.rationale,
        duration: resolvedArgs.duration,
        category: resolvedArgs.category,
        status: "scheduled",
        createdAt,
        scheduledFor,
      }

      if (emitWidget && widgetId) {
        dispatch({
          type: "ADD_WIDGET",
          widget: {
            id: widgetId,
            type: "schedule_activity",
            createdAt,
            args: resolvedArgs,
            status: "scheduled",
            suggestionId,
            isSyncing: true,
          },
        })
      }

      try {
        await addSuggestionToDb(suggestion)
        await syncSuggestionToCalendar(suggestion)
        if (emitWidget && widgetId) {
          dispatch({
            type: "UPDATE_WIDGET",
            widgetId,
            updates: {
              isSyncing: false,
            },
          })
        }
        return "scheduled"
      } catch (error) {
        unmarkScheduledEvent(scheduledFor, resolvedArgs.title)
        if (emitWidget && widgetId) {
          dispatch({
            type: "UPDATE_WIDGET",
            widgetId,
            updates: {
              status: "failed",
              error: error instanceof Error ? error.message : "Failed to save",
              suggestionId: undefined,
              isSyncing: false,
            },
          })
        }
        return "failed"
      }
    },
    [
      addSuggestionToDb,
      dispatch,
      isDuplicateScheduledEvent,
      markScheduledEvent,
      syncSuggestionToCalendar,
      timeZone,
      unmarkScheduledEvent,
    ]
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
          const manualArgs: ScheduleActivityToolArgs = {
            title: String(args.title ?? "Scheduled activity"),
            category: (args.category as ScheduleActivityToolArgs["category"]) ?? "rest",
            date: String(args.date ?? ""),
            time: String(args.time ?? ""),
            duration: Number(args.duration ?? 20),
          }

          void scheduleSingleActivity(manualArgs, {
            rationale: "Manually scheduled from chat",
            createdAt: now,
            checkInSessionId: data.session?.id,
          })
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
    [data.latestMismatch, data.session?.id, dispatch, scheduleSingleActivity]
  )

  // ========================================
  // Gemini Live widget handler
  // ========================================

  const onWidget = useCallback(
    (event: GeminiWidgetEvent) => {
      const now = new Date().toISOString()

      if (event.widget === "schedule_activity") {
        const scheduleContext = getLatestScheduleIntentUserContext(data.messages)
        const resolvedArgs = resolveScheduleArgsFromUserMessage(event.args, scheduleContext)

        // Gemini already provides a post-tool confirmation in the same turn.
        // Adding another app-generated confirmation here creates duplicate
        // assistant replies and can trigger chat auto-scroll jitter while waiting.
        // Pattern doc: docs/error-patterns/schedule-activity-double-confirmation.md
        void scheduleSingleActivity(resolvedArgs, {
          rationale: "Scheduled from AI chat",
          createdAt: now,
          checkInSessionId: data.session?.id,
        })
        return
      }

      if (event.widget === "schedule_recurring_activity") {
        const scheduleContext = getLatestScheduleIntentUserContext(data.messages)
        const baseArgs = resolveScheduleArgsFromUserMessage({
          title: event.args.title,
          category: event.args.category,
          date: event.args.startDate,
          time: event.args.time,
          duration: event.args.duration,
        }, scheduleContext)

        const resolvedRecurringArgs: ScheduleRecurringActivityToolArgs = {
          ...event.args,
          title: baseArgs.title,
          time: baseArgs.time,
          duration: baseArgs.duration,
        }

        let expansion
        try {
          expansion = expandRecurringScheduleOccurrences({
            startDate: resolvedRecurringArgs.startDate,
            time: resolvedRecurringArgs.time,
            timeZone,
            frequency: resolvedRecurringArgs.frequency,
            weekdays: resolvedRecurringArgs.weekdays,
            count: resolvedRecurringArgs.count,
            untilDate: resolvedRecurringArgs.untilDate,
            maxOccurrences: MAX_RECURRING_SCHEDULE_OCCURRENCES,
          })
        } catch (error) {
          const failureMessage: CheckInMessage = {
            id: generateId(),
            role: "assistant",
            content: error instanceof Error ? error.message : "Couldn't schedule that recurring plan.",
            timestamp: new Date().toISOString(),
          }
          dispatch({ type: "ADD_MESSAGE", message: failureMessage })
          return
        }

        if (expansion.occurrences.length === 0) {
          const noMatchesMessage: CheckInMessage = {
            id: generateId(),
            role: "assistant",
            content: `I couldn't find any valid dates to schedule for "${baseArgs.title}".`,
            timestamp: new Date().toISOString(),
          }
          dispatch({ type: "ADD_MESSAGE", message: noMatchesMessage })
          return
        }

        void (async () => {
          const summaryWidgetId = generateId()
          const requestedCount = expansion.occurrences.length + expansion.skippedInvalidDateTimes

          // Pattern doc: docs/error-patterns/recurring-schedule-per-occurrence-confirmation-spam.md
          dispatch({
            type: "ADD_WIDGET",
            widget: {
              id: summaryWidgetId,
              type: "schedule_recurring_summary",
              createdAt: now,
              args: resolvedRecurringArgs,
              status: "pending",
              requestedCount,
              scheduledCount: 0,
              failedCount: 0,
              duplicateCount: 0,
              skippedInvalidDateTimes: expansion.skippedInvalidDateTimes,
              truncated: expansion.truncated,
              isSyncing: true,
            },
          })

          const seriesId = generateId()
          const recurringSeries: RecurringSeries = {
            id: seriesId,
            title: baseArgs.title,
            category: baseArgs.category,
            duration: baseArgs.duration,
            timeZone,
            recurrence: {
              startDate: resolvedRecurringArgs.startDate,
              time: resolvedRecurringArgs.time,
              frequency: resolvedRecurringArgs.frequency,
              weekdays: resolvedRecurringArgs.weekdays,
              count: resolvedRecurringArgs.count,
              untilDate: resolvedRecurringArgs.untilDate,
            },
            status: "active",
            createdAt: now,
          }

          let seriesPersisted = false
          try {
            await createRecurringSeriesRecord(recurringSeries)
            seriesPersisted = true
          } catch (error) {
            dispatch({
              type: "UPDATE_WIDGET",
              widgetId: summaryWidgetId,
              updates: {
                status: "failed",
                requestedCount,
                scheduledCount: 0,
                failedCount: requestedCount,
                duplicateCount: 0,
                skippedInvalidDateTimes: expansion.skippedInvalidDateTimes,
                truncated: expansion.truncated,
                error: error instanceof Error ? error.message : "Failed to save recurring plan",
                isSyncing: false,
              },
            })

            const failureMessage: CheckInMessage = {
              id: generateId(),
              role: "assistant",
              content: "I couldn't save that recurring plan right now.",
              timestamp: new Date().toISOString(),
            }
            dispatch({ type: "ADD_MESSAGE", message: failureMessage })
            return
          }

          const results = await Promise.all(
            expansion.occurrences.map((occurrence, occurrenceIndex) =>
              scheduleSingleActivity(
                {
                  ...baseArgs,
                  date: occurrence.date,
                  time: occurrence.time,
                },
                {
                  rationale: "Scheduled from AI chat (recurring)",
                  createdAt: now,
                  scheduledForOverride: occurrence.scheduledFor,
                  checkInSessionId: data.session?.id,
                  seriesId,
                  occurrenceDate: occurrence.date,
                  occurrenceIndex,
                  emitWidget: false,
                }
              )
            )
          )

          const scheduledCount = results.filter((result) => result === "scheduled").length
          const failedCount =
            results.filter((result) => result === "failed").length
            + expansion.skippedInvalidDateTimes
          const duplicateCount = results.filter((result) => result === "duplicate").length

          if (scheduledCount === 0 && seriesPersisted) {
            try {
              await deleteRecurringSeriesRecord(seriesId)
            } catch {
              // Best effort: scheduling already failed and user already receives the summary.
            }
          }

          const summaryStatus =
            scheduledCount === 0
              ? "failed"
              : failedCount > 0 || duplicateCount > 0
                ? "partial"
                : "scheduled"

          dispatch({
            type: "UPDATE_WIDGET",
            widgetId: summaryWidgetId,
            updates: {
              status: summaryStatus,
              requestedCount,
              scheduledCount,
              failedCount,
              duplicateCount,
              skippedInvalidDateTimes: expansion.skippedInvalidDateTimes,
              truncated: expansion.truncated,
              error: undefined,
              isSyncing: false,
            },
          })

          const summaryParts: string[] = []
          if (scheduledCount > 0) {
            summaryParts.push(
              `Scheduled ${scheduledCount} block${scheduledCount === 1 ? "" : "s"} for "${baseArgs.title}".`
            )
          } else {
            summaryParts.push(`I couldn't schedule any blocks for "${baseArgs.title}".`)
          }

          if (failedCount > 0) {
            summaryParts.push(`${failedCount} failed.`)
          }

          if (duplicateCount > 0) {
            summaryParts.push(
              `${duplicateCount} duplicate${duplicateCount === 1 ? " was" : "s were"} skipped.`
            )
          }

          if (expansion.truncated) {
            summaryParts.push(`Capped at ${MAX_RECURRING_SCHEDULE_OCCURRENCES} occurrences.`)
          }

          const summaryMessage: CheckInMessage = {
            id: generateId(),
            role: "assistant",
            content: summaryParts.join(" "),
            timestamp: new Date().toISOString(),
          }

          dispatch({ type: "ADD_MESSAGE", message: summaryMessage })
        })()
        return
      }

      if ((event as { widget: string }).widget === "edit_recurring_activity") {
        void (async () => {
          const args = (event as { args: EditRecurringActivityToolArgs }).args
          const series = await findActiveRecurringSeriesByTitle(args.title, args.category)

          if (!series) {
            const notFoundMessage: CheckInMessage = {
              id: generateId(),
              role: "assistant",
              content: `I couldn't find an active recurring series named "${args.title}".`,
              timestamp: new Date().toISOString(),
            }
            dispatch({ type: "ADD_MESSAGE", message: notFoundMessage })
            return
          }

          const seriesSuggestions = await getSuggestionsForSeries(series.id)
          const anchor = findSeriesAnchorSuggestion({
            suggestions: seriesSuggestions,
            scope: args.scope,
            fromDate: args.fromDate,
            timeZone: series.timeZone,
          })

          if (!anchor || !anchor.scheduledFor) {
            const noAnchorMessage: CheckInMessage = {
              id: generateId(),
              role: "assistant",
              content: "I couldn't find a matching upcoming occurrence to update.",
              timestamp: new Date().toISOString(),
            }
            dispatch({ type: "ADD_MESSAGE", message: noAnchorMessage })
            return
          }

          let nextAnchorScheduledFor = anchor.scheduledFor
          const changingDateOrTime = Boolean(args.newDate || args.newTime)

          if (changingDateOrTime) {
            const anchorParts = formatInstantToSeriesParts(anchor.scheduledFor, series.timeZone)
            if (!anchorParts) {
              const invalidAnchorMessage: CheckInMessage = {
                id: generateId(),
                role: "assistant",
                content: "I couldn't parse the existing schedule for that series.",
                timestamp: new Date().toISOString(),
              }
              dispatch({ type: "ADD_MESSAGE", message: invalidAnchorMessage })
              return
            }

            const nextDate = args.newDate ?? anchorParts.date
            const nextTime = args.newTime ?? anchorParts.time
            const parsed = parseZonedDateTimeInstant(nextDate, nextTime, series.timeZone)

            if (!parsed) {
              const invalidTargetMessage: CheckInMessage = {
                id: generateId(),
                role: "assistant",
                content: "I couldn't parse the updated date/time for that recurring plan.",
                timestamp: new Date().toISOString(),
              }
              dispatch({ type: "ADD_MESSAGE", message: invalidTargetMessage })
              return
            }

            nextAnchorScheduledFor = parsed
          }

          try {
            const result = await rescheduleSuggestionWithScope({
              suggestionId: anchor.id,
              newScheduledFor: nextAnchorScheduledFor,
              scope: args.scope,
              durationOverride: args.duration,
            })

            const summaryText = result.updatedCount === 0
              ? "I couldn't update any occurrences for that recurring plan."
              : (() => {
                  const updatedParts = formatInstantToSeriesParts(nextAnchorScheduledFor, series.timeZone)
                  const updates: string[] = [
                    `Updated ${result.updatedCount} occurrence${result.updatedCount === 1 ? "" : "s"} in ${formatScopeLabel(args.scope)} for "${series.title}".`,
                  ]

                  if (changingDateOrTime && updatedParts) {
                    updates.push(`New anchor time: ${updatedParts.date} at ${updatedParts.time}.`)
                  }

                  if (typeof args.duration === "number") {
                    updates.push(`Duration is now ${Math.max(1, Math.round(args.duration))} minutes.`)
                  }

                  return updates.join(" ")
                })()

            const summaryMessage: CheckInMessage = {
              id: generateId(),
              role: "assistant",
              content: summaryText,
              timestamp: new Date().toISOString(),
            }
            dispatch({ type: "ADD_MESSAGE", message: summaryMessage })
          } catch (error) {
            const failureMessage: CheckInMessage = {
              id: generateId(),
              role: "assistant",
              content: error instanceof Error ? error.message : "I couldn't update that recurring plan.",
              timestamp: new Date().toISOString(),
            }
            dispatch({ type: "ADD_MESSAGE", message: failureMessage })
          }
        })()
        return
      }

      if ((event as { widget: string }).widget === "cancel_recurring_activity") {
        void (async () => {
          const args = (event as { args: CancelRecurringActivityToolArgs }).args
          const series = await findActiveRecurringSeriesByTitle(args.title, args.category)

          if (!series) {
            const notFoundMessage: CheckInMessage = {
              id: generateId(),
              role: "assistant",
              content: `I couldn't find an active recurring series named "${args.title}".`,
              timestamp: new Date().toISOString(),
            }
            dispatch({ type: "ADD_MESSAGE", message: notFoundMessage })
            return
          }

          const seriesSuggestions = await getSuggestionsForSeries(series.id)
          const anchor = findSeriesAnchorSuggestion({
            suggestions: seriesSuggestions,
            scope: args.scope,
            fromDate: args.fromDate,
            timeZone: series.timeZone,
          })

          if (!anchor) {
            const noAnchorMessage: CheckInMessage = {
              id: generateId(),
              role: "assistant",
              content: "I couldn't find a matching upcoming occurrence to cancel.",
              timestamp: new Date().toISOString(),
            }
            dispatch({ type: "ADD_MESSAGE", message: noAnchorMessage })
            return
          }

          try {
            const result = await dismissSuggestionWithScope({
              suggestionId: anchor.id,
              scope: args.scope,
            })

            const summaryMessage: CheckInMessage = {
              id: generateId(),
              role: "assistant",
              content:
                result.updatedCount === 0
                  ? "I couldn't cancel any upcoming occurrences for that series."
                  : `Cancelled ${result.updatedCount} occurrence${result.updatedCount === 1 ? "" : "s"} in ${formatScopeLabel(args.scope)} for "${series.title}".`,
              timestamp: new Date().toISOString(),
            }
            dispatch({ type: "ADD_MESSAGE", message: summaryMessage })
          } catch (error) {
            const failureMessage: CheckInMessage = {
              id: generateId(),
              role: "assistant",
              content: error instanceof Error ? error.message : "I couldn't cancel that recurring plan.",
              timestamp: new Date().toISOString(),
            }
            dispatch({ type: "ADD_MESSAGE", message: failureMessage })
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
    [data.messages, data.session?.id, dispatch, scheduleSingleActivity, timeZone]
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

    // Fallback scheduling must not guess the duration.
    // If duration is missing, let Gemini ask a clarifying question first.
    // Pattern doc: docs/error-patterns/schedule-fallback-missing-duration-assumption.md
    const explicitDurationMinutes = extractDurationMinutesFromText(lastUserMessage.content)
    if (explicitDurationMinutes === null) return

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

      const now = new Date().toISOString()
      const timeHHMM = formatTimeHHMM(timeParts)

      const title = inferScheduleTitle(lastUserMessage.content)
      const category = inferScheduleCategory(lastUserMessage.content)
      const duration = clampDurationMinutes(explicitDurationMinutes)

      const args: ScheduleActivityToolArgs = {
        title,
        category,
        date: dateISO,
        time: timeHHMM,
        duration,
      }

      void (async () => {
        const result = await scheduleSingleActivity(args, {
          rationale: "Scheduled from chat (fallback)",
          createdAt: now,
          checkInSessionId: data.session?.id,
        })

        if (result === "scheduled") {
          const confirmationMessage: CheckInMessage = {
            id: generateId(),
            role: "assistant",
            content: `Done — scheduled “${title}” for ${formatZonedDateTimeForMessage(args.date, args.time, timeZone)}.`,
            timestamp: new Date().toISOString(),
          }
          dispatch({ type: "ADD_MESSAGE", message: confirmationMessage })
        }
      })()
    }, 1200)
  }, [data.messages, data.session?.id, dispatch, scheduleSingleActivity, timeZone, widgetsRef])

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
