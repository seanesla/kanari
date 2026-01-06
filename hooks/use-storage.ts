"use client"

import { useCallback } from "react"
import { logDebug } from "@/lib/logger"
import { useLiveQuery } from "dexie-react-hooks"
import { getWeekStart, getWeekEnd } from "@/lib/date-utils"
import {
  db,
  toRecording,
  toTrendData,
  toSuggestion,
  toRecoveryBlock,
  toCheckInSession,
  toJournalEntry,
  fromRecording,
  fromTrendData,
  fromSuggestion,
  fromRecoveryBlock,
  fromCheckInSession,
  fromJournalEntry,
  type DBTrendData,
} from "@/lib/storage/db"
import type {
  Recording,
  TrendData,
  DashboardStats,
  Suggestion,
  RecoveryBlock,
  CheckInSession,
  JournalEntry,
} from "@/lib/types"

// ===========================================
// Recording operations
// ===========================================

export function useRecordings(limit?: number) {
  const recordings = useLiveQuery(async () => {
    let query = db.recordings.orderBy("createdAt").reverse()
    if (limit) {
      query = query.limit(limit)
    }
    const results = await query.toArray()
    return results.map(toRecording)
  }, [limit])

  return recordings ?? []
}

export function useRecording(id: string | undefined) {
  return useLiveQuery(async () => {
    if (!id) return undefined
    const record = await db.recordings.get(id)
    return record ? toRecording(record) : undefined
  }, [id])
}

export function useRecordingActions() {
  const addRecording = useCallback(async (recording: Recording) => {
    await db.recordings.add(fromRecording(recording))
    return recording.id
  }, [])

  const updateRecording = useCallback(
    async (id: string, updates: Partial<Recording>) => {
      const existing = await db.recordings.get(id)
      if (!existing) throw new Error(`Recording ${id} not found`)

      await db.recordings.update(id, {
        ...updates,
        createdAt: updates.createdAt
          ? new Date(updates.createdAt)
          : existing.createdAt,
      })
    },
    []
  )

  const deleteRecording = useCallback(async (id: string) => {
    await db.recordings.delete(id)
  }, [])

  const clearAllRecordings = useCallback(async () => {
    await db.recordings.clear()
  }, [])

  return { addRecording, updateRecording, deleteRecording, clearAllRecordings }
}

// ===========================================
// Trend data operations
// ===========================================

export function useTrendData(days: number = 30) {
  const trendData = useLiveQuery(async () => {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    const results = await db.trendData
      .where("date")
      .above(cutoffDate)
      .sortBy("date")

    return results.map(toTrendData)
  }, [days])

  return trendData ?? []
}

export function useTrendDataActions() {
  /**
   * Add trend data with daily aggregation.
   * If data already exists for this date, it averages the scores.
   */
  const addTrendData = useCallback(async (data: TrendData) => {
    const existing = await db.trendData.get(data.date)

    if (existing) {
      // Aggregate: average the scores with existing data
      const count = (existing.recordingCount || 1) + 1
      const newStress = ((existing.stressScore * (count - 1)) + data.stressScore) / count
      const newFatigue = ((existing.fatigueScore * (count - 1)) + data.fatigueScore) / count

      await db.trendData.update(data.date, {
        stressScore: Math.round(newStress),
        fatigueScore: Math.round(newFatigue),
        recordingCount: count,
      })
    } else {
      await db.trendData.put({
        ...fromTrendData(data),
        recordingCount: 1,
      })
    }
  }, [])

  const updateTrendData = useCallback(async (date: string, updates: Partial<TrendData>) => {
    // Convert TrendData (string date) to DBTrendData (Date object) for Dexie
    const dbUpdates: Partial<DBTrendData> = {
      ...updates,
      date: updates.date ? new Date(updates.date) : undefined,
    }
    // Remove undefined date to avoid overwriting with undefined
    if (dbUpdates.date === undefined) {
      delete dbUpdates.date
    }
    await db.trendData.update(date, dbUpdates)
  }, [])

  return { addTrendData, updateTrendData }
}

// ===========================================
// Suggestion operations
// ===========================================

/**
 * Get ALL suggestions regardless of recording.
 * Used for diff-aware generation and memory context building.
 */
export function useAllSuggestions() {
  const suggestions = useLiveQuery(async () => {
    const results = await db.suggestions.orderBy("createdAt").reverse().toArray()
    return results.map(toSuggestion)
  }, [])

  return suggestions ?? []
}

export function useScheduledSuggestions() {
  const suggestions = useLiveQuery(async () => {
    const results = await db.suggestions
      .where("status")
      .equals("scheduled")
      .toArray()
    return results
      .map(toSuggestion)
      .sort((a, b) => {
        if (!a.scheduledFor || !b.scheduledFor) return 0
        return new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
      })
  }, [])

  return suggestions ?? []
}

export function useSuggestionsByRecording(recordingId: string | null) {
  const result = useLiveQuery(async () => {
    if (!recordingId) return { suggestions: [], forRecordingId: null }
    const results = await db.suggestions
      .where("recordingId")
      .equals(recordingId)
      .sortBy("createdAt")
    return { suggestions: results.map(toSuggestion), forRecordingId: recordingId }
  }, [recordingId])

  // Return suggestions, the recordingId they were loaded for, and loading state
  // forRecordingId lets callers verify they have fresh data for the current recording
  return {
    suggestions: result?.suggestions ?? [],
    forRecordingId: result?.forRecordingId ?? null,
    isLoading: result === undefined
  }
}

export function useSuggestionActions() {
  const addSuggestion = useCallback(async (suggestion: Suggestion) => {
    await db.suggestions.add(fromSuggestion(suggestion))
    return suggestion.id
  }, [])

  const addSuggestions = useCallback(async (suggestions: Suggestion[]) => {
    await db.suggestions.bulkAdd(suggestions.map(fromSuggestion))
  }, [])

  const updateSuggestion = useCallback(
    async (id: string, updates: Partial<Suggestion>) => {
      const existing = await db.suggestions.get(id)
      if (!existing) throw new Error(`Suggestion ${id} not found`)

      await db.suggestions.update(id, {
        ...updates,
        createdAt: updates.createdAt
          ? new Date(updates.createdAt)
          : existing.createdAt,
        scheduledFor: updates.scheduledFor
          ? new Date(updates.scheduledFor)
          : existing.scheduledFor,
        lastUpdatedAt: updates.lastUpdatedAt
          ? new Date(updates.lastUpdatedAt)
          : existing.lastUpdatedAt,
      })
    },
    []
  )

  const deleteSuggestion = useCallback(async (id: string) => {
    await db.suggestions.delete(id)
  }, [])

  const deleteSuggestionsByRecording = useCallback(async (recordingId: string) => {
    await db.suggestions.where("recordingId").equals(recordingId).delete()
  }, [])

  return { addSuggestion, addSuggestions, updateSuggestion, deleteSuggestion, deleteSuggestionsByRecording }
}

// ===========================================
// Recovery block operations
// ===========================================

export function useRecoveryBlocks(limit?: number) {
  const recoveryBlocks = useLiveQuery(async () => {
    let query = db.recoveryBlocks.orderBy("scheduledAt").reverse()
    if (limit) {
      query = query.limit(limit)
    }
    const results = await query.toArray()
    return results.map(toRecoveryBlock)
  }, [limit])

  return recoveryBlocks ?? []
}

export function useRecoveryBlocksBySuggestion(suggestionId: string | undefined) {
  const recoveryBlocks = useLiveQuery(async () => {
    if (!suggestionId) return []
    const results = await db.recoveryBlocks.where("suggestionId").equals(suggestionId).toArray()
    return results.map(toRecoveryBlock).sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
  }, [suggestionId])

  return recoveryBlocks ?? []
}

export function useRecoveryBlockActions() {
  const addRecoveryBlock = useCallback(async (block: RecoveryBlock) => {
    // Upsert by id to avoid duplicate sync writes on retries
    await db.recoveryBlocks.put(fromRecoveryBlock(block))
    return block.id
  }, [])

  const updateRecoveryBlock = useCallback(async (id: string, updates: Partial<RecoveryBlock>) => {
    const existing = await db.recoveryBlocks.get(id)
    if (!existing) throw new Error(`RecoveryBlock ${id} not found`)

    await db.recoveryBlocks.update(id, {
      ...updates,
      scheduledAt: updates.scheduledAt ? new Date(updates.scheduledAt) : existing.scheduledAt,
    })
  }, [])

  const deleteRecoveryBlock = useCallback(async (id: string) => {
    await db.recoveryBlocks.delete(id)
  }, [])

  const clearRecoveryBlocks = useCallback(async () => {
    await db.recoveryBlocks.clear()
  }, [])

  return { addRecoveryBlock, updateRecoveryBlock, deleteRecoveryBlock, clearRecoveryBlocks }
}

// ===========================================
// Dashboard stats
// ===========================================

export function useDashboardStats(): DashboardStats {
  const stats = useLiveQuery(async () => {
    const recordings = await db.recordings.toArray()
    const sessions = await db.checkInSessions.toArray()
    const suggestions = await db.suggestions.toArray()
    const recoveryBlocks = await db.recoveryBlocks.toArray()

    const voiceEntries = [
      ...recordings.map((r) => ({
        date: r.createdAt,
        duration: r.duration,
        metrics: r.metrics,
      })),
      ...sessions.map((s) => ({
        date: s.startedAt,
        duration: s.duration ?? 0,
        metrics: s.acousticMetrics
          ? {
              stressScore: s.acousticMetrics.stressScore,
              fatigueScore: s.acousticMetrics.fatigueScore,
            }
          : undefined,
      })),
    ]

    // Calculate total recordings/check-ins and minutes
    const totalRecordings = voiceEntries.length
    const totalMinutesRecorded = voiceEntries.reduce(
      (sum, entry) => sum + entry.duration / 60,
      0
    )

    // Calculate current streak
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let currentStreak = 0
    const checkDate = new Date(today)

    while (true) {
      const dayStart = new Date(checkDate)
      const dayEnd = new Date(checkDate)
      dayEnd.setDate(dayEnd.getDate() + 1)

      const hasRecording = voiceEntries.some((entry) => {
        const entryDate = entry.date
        return entryDate >= dayStart && entryDate < dayEnd
      })

      if (hasRecording) {
        currentStreak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }

    // Calculate average stress/fatigue
    const recordingsWithMetrics = voiceEntries.filter((entry) => entry.metrics)
    const averageStress =
      recordingsWithMetrics.length > 0
        ? recordingsWithMetrics.reduce((sum, entry) => sum + (entry.metrics?.stressScore ?? 0), 0) /
          recordingsWithMetrics.length
        : 0
    const averageFatigue =
      recordingsWithMetrics.length > 0
        ? recordingsWithMetrics.reduce((sum, entry) => sum + (entry.metrics?.fatigueScore ?? 0), 0) /
          recordingsWithMetrics.length
        : 0

    // Count accepted suggestions and scheduled recovery blocks
    const suggestionsAccepted = suggestions.filter(
      (s) => s.status === "accepted" || s.status === "scheduled"
    ).length
    const recoveryBlocksScheduled = recoveryBlocks.length

    // Calculate weekly recordings (Mon-Sun)
    const weekStart = getWeekStart()
    const weekEnd = getWeekEnd()
    const weeklyRecordings = voiceEntries.filter((entry) => {
      const entryDate = entry.date
      return entryDate >= weekStart && entryDate <= weekEnd
    }).length

    return {
      totalRecordings,
      totalMinutesRecorded: Math.round(totalMinutesRecorded),
      currentStreak,
      averageStress: Math.round(averageStress),
      averageFatigue: Math.round(averageFatigue),
      suggestionsAccepted,
      recoveryBlocksScheduled,
      weeklyRecordings,
      weeklyGoal: 3,
    }
  }, [])

  return (
    stats ?? {
      totalRecordings: 0,
      totalMinutesRecorded: 0,
      currentStreak: 0,
      averageStress: 0,
      averageFatigue: 0,
      suggestionsAccepted: 0,
      recoveryBlocksScheduled: 0,
      weeklyRecordings: 0,
      weeklyGoal: 3,
    }
  )
}

// ===========================================
// Check-in session operations
// ===========================================

export function useCheckInSessions(limit?: number) {
  const sessions = useLiveQuery(async () => {
    let query = db.checkInSessions.orderBy("startedAt").reverse()
    if (limit) {
      query = query.limit(limit)
    }
    const results = await query.toArray()
    return results.map(toCheckInSession)
  }, [limit])

  return sessions ?? []
}

export function useCheckInSession(id: string | undefined) {
  return useLiveQuery(async () => {
    if (!id) return undefined
    const record = await db.checkInSessions.get(id)
    return record ? toCheckInSession(record) : undefined
  }, [id])
}

export function useCheckInSessionsByRecording(recordingId: string | undefined) {
  const sessions = useLiveQuery(async () => {
    if (!recordingId) return []
    const results = await db.checkInSessions
      .where("recordingId")
      .equals(recordingId)
      .toArray()
    return results.map(toCheckInSession)
  }, [recordingId])

  return sessions ?? []
}

export function useCheckInSessionActions() {
  const addCheckInSession = useCallback(async (session: CheckInSession) => {
    await db.checkInSessions.add(fromCheckInSession(session))

    if (session.acousticMetrics) {
      const date = session.startedAt.split("T")[0]
      const existing = await db.trendData.get(date)
      if (existing) {
        const count = (existing.recordingCount || 1) + 1
        const newStress =
          ((existing.stressScore * (count - 1)) + session.acousticMetrics.stressScore) / count
        const newFatigue =
          ((existing.fatigueScore * (count - 1)) + session.acousticMetrics.fatigueScore) / count

        await db.trendData.update(date, {
          stressScore: Math.round(newStress),
          fatigueScore: Math.round(newFatigue),
          recordingCount: count,
        })
      } else {
        await db.trendData.put({
          id: date,
          date: new Date(date),
          stressScore: session.acousticMetrics.stressScore,
          fatigueScore: session.acousticMetrics.fatigueScore,
          recordingCount: 1,
        })
      }
    }

    return session.id
  }, [])

  const updateCheckInSession = useCallback(
    async (id: string, updates: Partial<CheckInSession>) => {
      const existing = await db.checkInSessions.get(id)
      if (!existing) throw new Error(`CheckInSession ${id} not found`)

      await db.checkInSessions.update(id, {
        ...updates,
        startedAt: updates.startedAt
          ? new Date(updates.startedAt)
          : existing.startedAt,
        endedAt: updates.endedAt
          ? new Date(updates.endedAt)
          : existing.endedAt,
      })
    },
    []
  )

  const deleteCheckInSession = useCallback(async (id: string) => {
    await db.checkInSessions.delete(id)
  }, [])

  /**
   * Delete all check-in sessions where user never participated.
   * With AI-speaks-first, message count alone is not reliable; preserve sessions with voice metrics.
   * Pattern doc: docs/error-patterns/check-in-results-missing-on-disconnect.md
   * Returns the number of deleted sessions.
   */
  const deleteIncompleteSessions = useCallback(async () => {
    const allSessions = await db.checkInSessions.toArray()
    const incompleteSessionIds = allSessions
      .filter(session => (!session.messages || session.messages.length <= 1) && !session.acousticMetrics)
      .map(session => session.id)

    if (incompleteSessionIds.length > 0) {
      await db.checkInSessions.bulkDelete(incompleteSessionIds)
      logDebug("Storage", `Deleted ${incompleteSessionIds.length} incomplete check-in sessions`)
    }

    return incompleteSessionIds.length
  }, [])

  return { addCheckInSession, updateCheckInSession, deleteCheckInSession, deleteIncompleteSessions }
}

// ===========================================
// Journal entry operations
// ===========================================

export function useJournalEntries(limit?: number) {
  const entries = useLiveQuery(async () => {
    let query = db.journalEntries.orderBy("createdAt").reverse()
    if (limit) {
      query = query.limit(limit)
    }
    const results = await query.toArray()
    return results.map(toJournalEntry)
  }, [limit])

  return entries ?? []
}

export function useJournalEntriesByCheckInSession(checkInSessionId: string | undefined) {
  const entries = useLiveQuery(async () => {
    if (!checkInSessionId) return []
    const results = await db.journalEntries
      .where("checkInSessionId")
      .equals(checkInSessionId)
      .sortBy("createdAt")
    return results.map(toJournalEntry).reverse()
  }, [checkInSessionId])

  return entries ?? []
}

export function useJournalEntryActions() {
  const addJournalEntry = useCallback(async (entry: JournalEntry) => {
    await db.journalEntries.add(fromJournalEntry(entry))
    return entry.id
  }, [])

  const deleteJournalEntry = useCallback(async (id: string) => {
    await db.journalEntries.delete(id)
  }, [])

  const clearJournalEntries = useCallback(async () => {
    await db.journalEntries.clear()
  }, [])

  return { addJournalEntry, deleteJournalEntry, clearJournalEntries }
}

// ===========================================
// Clear all data
// ===========================================

export function useClearAllData() {
  return useCallback(async () => {
    await Promise.all([
      db.recordings.clear(),
      db.suggestions.clear(),
      db.recoveryBlocks.clear(),
      db.trendData.clear(),
      db.checkInSessions.clear(),
      db.achievements.clear(),
      db.journalEntries.clear(),
    ])
  }, [])
}
