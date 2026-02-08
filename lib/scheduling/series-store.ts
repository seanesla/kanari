"use client"

import { Temporal } from "temporal-polyfill"
import { clampDurationMinutes } from "@/lib/scheduling/duration"
import { db, fromRecurringSeries, toRecurringSeries, toSuggestion } from "@/lib/storage/db"
import type {
  RecurringMutationScope,
  RecurringSeries,
  Suggestion,
  SuggestionCategory,
  SuggestionStatus,
} from "@/lib/types"

const MUTABLE_SUGGESTION_STATUSES = new Set<SuggestionStatus>(["pending", "scheduled"])

function parseInstantMs(instantISO: string | undefined): number | null {
  if (!instantISO) return null
  const parsed = new Date(instantISO)
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime()
}

function isMutableSuggestion(suggestion: Suggestion): boolean {
  return MUTABLE_SUGGESTION_STATUSES.has(suggestion.status)
}

function sortSuggestionsBySchedule(suggestions: Suggestion[]): Suggestion[] {
  return [...suggestions].sort((a, b) => {
    const aMs = parseInstantMs(a.scheduledFor) ?? parseInstantMs(a.createdAt) ?? Number.MAX_SAFE_INTEGER
    const bMs = parseInstantMs(b.scheduledFor) ?? parseInstantMs(b.createdAt) ?? Number.MAX_SAFE_INTEGER
    return aMs - bMs
  })
}

export function normalizeSeriesTitle(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

export function getSeriesSuggestionsForScope(params: {
  suggestions: Suggestion[]
  anchor: Suggestion
  scope: RecurringMutationScope
}): Suggestion[] {
  const sorted = sortSuggestionsBySchedule(params.suggestions)
  const mutable = sorted.filter(isMutableSuggestion)

  if (params.scope === "all") {
    return mutable
  }

  if (params.scope === "single") {
    return mutable.filter((s) => s.id === params.anchor.id)
  }

  const anchorMs = parseInstantMs(params.anchor.scheduledFor)
  if (anchorMs == null) return []

  return mutable.filter((suggestion) => {
    const suggestionMs = parseInstantMs(suggestion.scheduledFor)
    return suggestionMs != null && suggestionMs >= anchorMs
  })
}

export function buildShiftedSeriesScheduleMap(params: {
  scopedSuggestions: Suggestion[]
  anchorSuggestionId: string
  anchorScheduledFor: string
  newAnchorScheduledFor: string
}): Map<string, string> {
  const anchorOriginalMs = parseInstantMs(params.anchorScheduledFor)
  const anchorNextMs = parseInstantMs(params.newAnchorScheduledFor)

  if (anchorOriginalMs == null || anchorNextMs == null) {
    throw new Error("Invalid anchor schedule while updating recurring series")
  }

  const deltaMs = anchorNextMs - anchorOriginalMs
  const updates = new Map<string, string>()

  for (const suggestion of params.scopedSuggestions) {
    const originalMs = parseInstantMs(suggestion.scheduledFor)
    if (originalMs == null) continue
    updates.set(suggestion.id, new Date(originalMs + deltaMs).toISOString())
  }

  updates.set(params.anchorSuggestionId, new Date(anchorNextMs).toISOString())
  return updates
}

export function getSuggestionLocalDateInTimeZone(
  suggestion: Suggestion,
  timeZone: string
): string | null {
  if (suggestion.occurrenceDate) return suggestion.occurrenceDate
  if (!suggestion.scheduledFor) return null

  try {
    return Temporal.Instant.from(suggestion.scheduledFor).toZonedDateTimeISO(timeZone).toPlainDate().toString()
  } catch {
    return null
  }
}

export function findSeriesAnchorSuggestion(params: {
  suggestions: Suggestion[]
  scope: RecurringMutationScope
  fromDate?: string
  timeZone: string
  nowISO?: string
}): Suggestion | null {
  const sortedMutable = sortSuggestionsBySchedule(params.suggestions).filter(isMutableSuggestion)
  if (sortedMutable.length === 0) return null

  if (params.scope === "all") {
    return sortedMutable[0] ?? null
  }

  if (params.fromDate) {
    const anchored = sortedMutable.find((suggestion) => {
      return getSuggestionLocalDateInTimeZone(suggestion, params.timeZone) === params.fromDate
    })
    if (anchored) return anchored
  }

  const nowMs = parseInstantMs(params.nowISO ?? new Date().toISOString())
  if (nowMs == null) return sortedMutable[0] ?? null

  return (
    sortedMutable.find((suggestion) => {
      const suggestionMs = parseInstantMs(suggestion.scheduledFor)
      return suggestionMs != null && suggestionMs >= nowMs
    }) ?? sortedMutable[0] ?? null
  )
}

export interface SeriesMutationResult {
  seriesId?: string
  updatedSuggestionIds: string[]
  updatedCount: number
}

export interface RescheduleSuggestionWithScopeInput {
  suggestionId: string
  newScheduledFor: string
  scope?: RecurringMutationScope
  durationOverride?: number
}

export async function rescheduleSuggestionWithScope(
  input: RescheduleSuggestionWithScopeInput
): Promise<SeriesMutationResult> {
  const scope = input.scope ?? "single"
  const targetMs = parseInstantMs(input.newScheduledFor)
  if (targetMs == null) {
    throw new Error("Invalid target schedule")
  }

  const anchorDbSuggestion = await db.suggestions.get(input.suggestionId)
  if (!anchorDbSuggestion) {
    throw new Error(`Suggestion ${input.suggestionId} not found`)
  }

  const anchor = toSuggestion(anchorDbSuggestion)
  const durationOverride =
    typeof input.durationOverride === "number"
      ? clampDurationMinutes(input.durationOverride)
      : null
  const nowDate = new Date()

  const applySingle = async (): Promise<SeriesMutationResult> => {
    await db.transaction("rw", db.suggestions, db.recoveryBlocks, async () => {
      await db.suggestions.update(anchor.id, {
        status: "scheduled",
        scheduledFor: new Date(input.newScheduledFor),
        lastUpdatedAt: nowDate,
        ...(durationOverride != null ? { duration: durationOverride } : {}),
      })

      await db.recoveryBlocks.where("suggestionId").equals(anchor.id).modify((block) => {
        block.scheduledAt = new Date(input.newScheduledFor)
        if (durationOverride != null) {
          block.duration = durationOverride
        }
      })
    })

    if (anchor.seriesId) {
      await db.recurringSeries.update(anchor.seriesId, {
        updatedAt: nowDate,
        ...(durationOverride != null ? { duration: durationOverride } : {}),
      })
    }

    return {
      seriesId: anchor.seriesId,
      updatedSuggestionIds: [anchor.id],
      updatedCount: 1,
    }
  }

  if (scope === "single" || !anchor.seriesId) {
    return applySingle()
  }

  const seriesRows = await db.suggestions.where("seriesId").equals(anchor.seriesId).toArray()
  const seriesSuggestions = seriesRows.map(toSuggestion)
  const scopedSuggestions = getSeriesSuggestionsForScope({
    suggestions: seriesSuggestions,
    anchor,
    scope,
  })

  if (scopedSuggestions.length === 0) {
    return {
      seriesId: anchor.seriesId,
      updatedSuggestionIds: [],
      updatedCount: 0,
    }
  }

  if (!anchor.scheduledFor) {
    throw new Error("Series anchor is missing scheduled time")
  }

  const scheduleMap = buildShiftedSeriesScheduleMap({
    scopedSuggestions,
    anchorSuggestionId: anchor.id,
    anchorScheduledFor: anchor.scheduledFor,
    newAnchorScheduledFor: input.newScheduledFor,
  })

  const updatedSuggestionIds = scopedSuggestions
    .map((suggestion) => suggestion.id)
    .filter((id) => scheduleMap.has(id))

  await db.transaction("rw", db.suggestions, db.recoveryBlocks, db.recurringSeries, async () => {
    for (const suggestionId of updatedSuggestionIds) {
      const nextScheduledFor = scheduleMap.get(suggestionId)
      if (!nextScheduledFor) continue

      await db.suggestions.update(suggestionId, {
        status: "scheduled",
        scheduledFor: new Date(nextScheduledFor),
        lastUpdatedAt: nowDate,
        ...(durationOverride != null ? { duration: durationOverride } : {}),
      })

      await db.recoveryBlocks.where("suggestionId").equals(suggestionId).modify((block) => {
        block.scheduledAt = new Date(nextScheduledFor)
        if (durationOverride != null) {
          block.duration = durationOverride
        }
      })
    }

    await db.recurringSeries.update(anchor.seriesId!, {
      updatedAt: nowDate,
      ...(durationOverride != null ? { duration: durationOverride } : {}),
    })
  })

  return {
    seriesId: anchor.seriesId,
    updatedSuggestionIds,
    updatedCount: updatedSuggestionIds.length,
  }
}

export interface DismissSuggestionWithScopeInput {
  suggestionId: string
  scope?: RecurringMutationScope
}

export async function dismissSuggestionWithScope(
  input: DismissSuggestionWithScopeInput
): Promise<SeriesMutationResult> {
  const scope = input.scope ?? "single"
  const nowDate = new Date()

  const anchorDbSuggestion = await db.suggestions.get(input.suggestionId)
  if (!anchorDbSuggestion) {
    throw new Error(`Suggestion ${input.suggestionId} not found`)
  }

  const anchor = toSuggestion(anchorDbSuggestion)
  const seriesId = anchor.seriesId
  let seriesSuggestions: Suggestion[] = [anchor]

  if (seriesId) {
    const rows = await db.suggestions.where("seriesId").equals(seriesId).toArray()
    seriesSuggestions = rows.map(toSuggestion)
  }

  const scopedSuggestions =
    scope === "single" || !seriesId
      ? getSeriesSuggestionsForScope({ suggestions: [anchor], anchor, scope: "single" })
      : getSeriesSuggestionsForScope({ suggestions: seriesSuggestions, anchor, scope })

  const updatedSuggestionIds = scopedSuggestions.map((suggestion) => suggestion.id)

  if (updatedSuggestionIds.length === 0) {
    return {
      seriesId,
      updatedSuggestionIds: [],
      updatedCount: 0,
    }
  }

  await db.transaction("rw", db.suggestions, db.recoveryBlocks, db.recurringSeries, async () => {
    for (const suggestionId of updatedSuggestionIds) {
      await db.suggestions.update(suggestionId, {
        status: "dismissed",
        lastUpdatedAt: nowDate,
      })
    }

    if (updatedSuggestionIds.length === 1) {
      await db.recoveryBlocks.where("suggestionId").equals(updatedSuggestionIds[0]!).delete()
    } else {
      await db.recoveryBlocks.where("suggestionId").anyOf(updatedSuggestionIds).delete()
    }

    if (!seriesId) return

    const updatedSet = new Set(updatedSuggestionIds)
    const remainingActiveCount = seriesSuggestions.filter((suggestion) => {
      if (!isMutableSuggestion(suggestion)) return false
      return !updatedSet.has(suggestion.id)
    }).length

    const shouldCancelSeries = scope === "all" || remainingActiveCount === 0
    await db.recurringSeries.update(seriesId, {
      status: shouldCancelSeries ? "cancelled" : "active",
      updatedAt: nowDate,
      cancelledAt: shouldCancelSeries ? nowDate : undefined,
    })
  })

  return {
    seriesId,
    updatedSuggestionIds,
    updatedCount: updatedSuggestionIds.length,
  }
}

export async function createRecurringSeriesRecord(series: RecurringSeries): Promise<void> {
  await db.recurringSeries.put(fromRecurringSeries(series))
}

export async function deleteRecurringSeriesRecord(seriesId: string): Promise<void> {
  await db.recurringSeries.delete(seriesId)
}

export async function findActiveRecurringSeriesByTitle(
  title: string,
  category?: SuggestionCategory
): Promise<RecurringSeries | null> {
  const normalizedTitle = normalizeSeriesTitle(title)
  const rows = await db.recurringSeries.where("status").equals("active").toArray()

  const candidates = rows
    .map(toRecurringSeries)
    .filter((series) => {
      if (category && series.category !== category) return false
      return normalizeSeriesTitle(series.title) === normalizedTitle
    })

  if (candidates.length === 0) return null

  const sorted = [...candidates].sort((a, b) => {
    const aMs = parseInstantMs(a.updatedAt ?? a.createdAt) ?? 0
    const bMs = parseInstantMs(b.updatedAt ?? b.createdAt) ?? 0
    return bMs - aMs
  })

  return sorted[0] ?? null
}

export async function getSuggestionsForSeries(seriesId: string): Promise<Suggestion[]> {
  const rows = await db.suggestions.where("seriesId").equals(seriesId).toArray()
  return rows.map(toSuggestion)
}
