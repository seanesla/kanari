"use client"

import { useMemo } from "react"
import { useRecordings } from "./use-storage"
import type {
  AnalyticsTimeRange,
  AnalyticsInsights,
  Recording,
  AggregatedObservation,
  RecordingReference,
  DetectedPattern,
} from "@/lib/types"

/**
 * Hook to aggregate analytics insights from recordings
 * Filters by time range and computes observations, interpretations, patterns
 */
export function useAnalyticsInsights(timeRange: AnalyticsTimeRange): AnalyticsInsights | null {
  const recordings = useRecordings()

  return useMemo(() => {
    // 1. Filter by time range
    const filtered = filterByTimeRange(recordings, timeRange)

    // 2. Only recordings with semantic analysis
    const withAnalysis = filtered.filter((r) => r.semanticAnalysis)
    if (withAnalysis.length === 0) return null

    // 3. Aggregate observations by type
    const observations = aggregateObservations(withAnalysis)

    // 4. Summarize interpretations
    const interpretations = summarizeInterpretations(withAnalysis)

    // 5. Detect patterns
    const patterns = detectPatterns(withAnalysis)

    return {
      timeRange,
      recordingCount: withAnalysis.length,
      observations,
      interpretations,
      patterns,
    }
  }, [recordings, timeRange])
}

function filterByTimeRange(recordings: Recording[], timeRange: AnalyticsTimeRange): Recording[] {
  const now = new Date()
  let cutoffMs: number

  switch (timeRange) {
    case "7_days":
      cutoffMs = 7 * 24 * 60 * 60 * 1000
      break
    case "30_days":
      cutoffMs = 30 * 24 * 60 * 60 * 1000
      break
    case "all_time":
      return recordings
  }

  const cutoff = new Date(now.getTime() - cutoffMs)
  return recordings.filter((r) => new Date(r.createdAt) >= cutoff)
}

function aggregateObservations(recordings: Recording[]): AnalyticsInsights["observations"] {
  const stress: AggregatedObservation[] = []
  const fatigue: AggregatedObservation[] = []
  const positive: AggregatedObservation[] = []

  recordings.forEach((recording) => {
    recording.semanticAnalysis?.observations.forEach((obs) => {
      const reference: RecordingReference = {
        recordingId: recording.id,
        createdAt: recording.createdAt,
        // timestamp could be added if we track which segment the observation came from
      }

      const targetList =
        obs.type === "stress_cue" ? stress : obs.type === "fatigue_cue" ? fatigue : positive

      // Find existing similar observation (exact match for now)
      const existing = targetList.find(
        (a) => a.observation.toLowerCase() === obs.observation.toLowerCase()
      )

      if (existing) {
        existing.references.push(reference)
        existing.frequency++
        // Keep highest relevance
        if (obs.relevance === "high" || (obs.relevance === "medium" && existing.relevance === "low")) {
          existing.relevance = obs.relevance
        }
      } else {
        targetList.push({
          type: obs.type,
          observation: obs.observation,
          relevance: obs.relevance,
          references: [reference],
          frequency: 1,
        })
      }
    })
  })

  // Sort by frequency descending
  return {
    stress: stress.sort((a, b) => b.frequency - a.frequency),
    fatigue: fatigue.sort((a, b) => b.frequency - a.frequency),
    positive: positive.sort((a, b) => b.frequency - a.frequency),
  }
}

function summarizeInterpretations(recordings: Recording[]): AnalyticsInsights["interpretations"] {
  // Get most recent non-empty interpretations
  const stressInterpretations = recordings
    .filter((r) => r.semanticAnalysis?.stressInterpretation)
    .map((r) => r.semanticAnalysis!.stressInterpretation)

  const fatigueInterpretations = recordings
    .filter((r) => r.semanticAnalysis?.fatigueInterpretation)
    .map((r) => r.semanticAnalysis!.fatigueInterpretation)

  return {
    stressSummary: stressInterpretations[0] || "No stress interpretation available",
    fatigueSummary: fatigueInterpretations[0] || "No fatigue interpretation available",
  }
}

function detectPatterns(recordings: Recording[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = []

  // Pattern 1: Word frequency in observations
  const wordCounts: Map<string, Set<string>> = new Map()
  const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "in", "on", "at", "to", "for", "of", "and", "or", "but", "with"])

  recordings.forEach((recording) => {
    recording.semanticAnalysis?.observations.forEach((obs) => {
      const words = obs.observation.toLowerCase().split(/\s+/)
      words.forEach((word) => {
        const cleaned = word.replace(/[^a-z]/g, "")
        if (cleaned.length > 3 && !stopWords.has(cleaned)) {
          if (!wordCounts.has(cleaned)) {
            wordCounts.set(cleaned, new Set())
          }
          wordCounts.get(cleaned)!.add(recording.id)
        }
      })
    })
  })

  // Find words that appear in 50%+ of recordings
  const threshold = recordings.length * 0.5
  wordCounts.forEach((recordingIds, word) => {
    if (recordingIds.size >= threshold && recordingIds.size >= 2) {
      const rate = Math.round((recordingIds.size / recordings.length) * 100)
      patterns.push({
        description: `"${word}" mentioned in ${rate}% of recordings`,
        occurrenceRate: rate,
        affectedRecordingIds: Array.from(recordingIds),
      })
    }
  })

  // Sort by occurrence rate
  return patterns.sort((a, b) => b.occurrenceRate - a.occurrenceRate).slice(0, 5)
}
