"use client"

import { useCallback } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import {
  db,
  toRecording,
  toTrendData,
  fromRecording,
  fromTrendData,
} from "@/lib/storage/db"
import type {
  Recording,
  TrendData,
  DashboardStats,
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
  const addTrendData = useCallback(async (data: TrendData) => {
    await db.trendData.put(fromTrendData(data))
  }, [])

  const updateTrendData = useCallback(async (date: string, updates: Partial<TrendData>) => {
    await db.trendData.update(date, updates)
  }, [])

  return { addTrendData, updateTrendData }
}

// ===========================================
// Dashboard stats
// ===========================================

export function useDashboardStats(): DashboardStats {
  const stats = useLiveQuery(async () => {
    const recordings = await db.recordings.toArray()
    const suggestions = await db.suggestions.toArray()
    const recoveryBlocks = await db.recoveryBlocks.toArray()

    // Calculate total recordings and minutes
    const totalRecordings = recordings.length
    const totalMinutesRecorded = recordings.reduce(
      (sum, r) => sum + r.duration / 60,
      0
    )

    // Calculate current streak
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let currentStreak = 0
    let checkDate = new Date(today)

    while (true) {
      const dayStart = new Date(checkDate)
      const dayEnd = new Date(checkDate)
      dayEnd.setDate(dayEnd.getDate() + 1)

      const hasRecording = recordings.some((r) => {
        const recordingDate = r.createdAt
        return recordingDate >= dayStart && recordingDate < dayEnd
      })

      if (hasRecording) {
        currentStreak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }

    // Calculate average stress/fatigue
    const recordingsWithMetrics = recordings.filter((r) => r.metrics)
    const averageStress =
      recordingsWithMetrics.length > 0
        ? recordingsWithMetrics.reduce(
            (sum, r) => sum + (r.metrics?.stressScore ?? 0),
            0
          ) / recordingsWithMetrics.length
        : 0
    const averageFatigue =
      recordingsWithMetrics.length > 0
        ? recordingsWithMetrics.reduce(
            (sum, r) => sum + (r.metrics?.fatigueScore ?? 0),
            0
          ) / recordingsWithMetrics.length
        : 0

    // Count accepted suggestions and scheduled recovery blocks
    const suggestionsAccepted = suggestions.filter(
      (s) => s.status === "accepted" || s.status === "scheduled"
    ).length
    const recoveryBlocksScheduled = recoveryBlocks.length

    return {
      totalRecordings,
      totalMinutesRecorded: Math.round(totalMinutesRecorded),
      currentStreak,
      averageStress: Math.round(averageStress),
      averageFatigue: Math.round(averageFatigue),
      suggestionsAccepted,
      recoveryBlocksScheduled,
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
    }
  )
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
    ])
  }, [])
}
