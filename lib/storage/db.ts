"use client"

import Dexie, { type EntityTable } from "dexie"
import { isDemoWorkspace } from "@/lib/workspace"
import { logWarn } from "@/lib/logger"
import type {
  Commitment,
  Recording,
  Suggestion,
  RecoveryBlock,
  UserSettings,
  TrendData,
  CheckInSession,
  JournalEntry,
  SuggestionCategory,
  SuggestionStatus,
} from "@/lib/types"
import type { DailyAchievement, MilestoneBadge, UserProgress } from "@/lib/achievements/types"

// Database record types with IndexedDB-friendly structure
export interface DBRecording extends Omit<Recording, "createdAt"> {
  createdAt: Date
}

export interface DBSuggestion extends Omit<Suggestion, "createdAt" | "scheduledFor" | "lastUpdatedAt"> {
  createdAt: Date
  scheduledFor?: Date
  lastUpdatedAt?: Date
}

export interface DBRecoveryBlock extends Omit<RecoveryBlock, "scheduledAt"> {
  scheduledAt: Date
}

export interface DBTrendData extends Omit<TrendData, "date"> {
  date: Date
  recordingCount?: number
}

export interface DBSettings extends UserSettings {
  id: string // Always "default"
}

export interface DBCheckInSession extends Omit<CheckInSession, "startedAt" | "endedAt"> {
  startedAt: Date
  endedAt?: Date
}

export interface DBDailyAchievement extends Omit<DailyAchievement, "createdAt" | "completedAt" | "seenAt" | "expiredAt"> {
  createdAt: Date
  completedAt?: Date
  seenAt?: Date
  expiredAt?: Date
}

export interface DBMilestoneBadge extends Omit<MilestoneBadge, "earnedAt" | "seenAt"> {
  earnedAt: Date
  seenAt?: Date
}

export interface DBUserProgress extends UserProgress {
  id: string // Always "default"
}

export interface DBJournalEntry extends Omit<JournalEntry, "createdAt"> {
  createdAt: Date
}

export interface DBCommitment extends Omit<Commitment, "extractedAt" | "followedUpAt"> {
  extractedAt: Date
  followedUpAt?: Date
}

// Database class
class KanariDB extends Dexie {
  recordings!: EntityTable<DBRecording, "id">
  suggestions!: EntityTable<DBSuggestion, "id">
  recoveryBlocks!: EntityTable<DBRecoveryBlock, "id">
  trendData!: EntityTable<DBTrendData & { id: string }, "id">
  settings!: EntityTable<DBSettings, "id">
  checkInSessions!: EntityTable<DBCheckInSession, "id">
  achievements!: EntityTable<DBDailyAchievement, "id">
  milestoneBadges!: EntityTable<DBMilestoneBadge, "id">
  userProgress!: EntityTable<DBUserProgress, "id">
  journalEntries!: EntityTable<DBJournalEntry, "id">
  commitments!: EntityTable<DBCommitment, "id">

  constructor() {
    super(isDemoWorkspace() ? "kanari_demo" : "kanari")

    // Version 1: Initial schema
    this.version(1).stores({
      recordings: "id, createdAt, status",
      suggestions: "id, createdAt, status, category, recordingId",
      recoveryBlocks: "id, suggestionId, scheduledAt, completed",
      trendData: "id, date",
      settings: "id",
    })

    // Version 2: Add version tracking for diff-aware suggestions
    this.version(2).stores({
      recordings: "id, createdAt, status",
      suggestions: "id, createdAt, status, category, recordingId, version",
      recoveryBlocks: "id, suggestionId, scheduledAt, completed",
      trendData: "id, date",
      settings: "id",
    }).upgrade(tx => {
      // Add version field to existing suggestions
      return tx.table("suggestions").toCollection().modify(suggestion => {
        if (suggestion.version === undefined) {
          suggestion.version = 1
        }
      })
    })

    // Version 3: Add check-in sessions for conversational check-in feature
    this.version(3).stores({
      recordings: "id, createdAt, status",
      suggestions: "id, createdAt, status, category, recordingId, version",
      recoveryBlocks: "id, suggestionId, scheduledAt, completed",
      trendData: "id, date",
      settings: "id",
      checkInSessions: "id, startedAt, recordingId",
    })

    // Version 4: Add geminiApiKey to settings (no schema change, just data field)
    // The settings table already stores arbitrary fields, so no stores() change needed
    this.version(4).stores({
      recordings: "id, createdAt, status",
      suggestions: "id, createdAt, status, category, recordingId, version",
      recoveryBlocks: "id, suggestionId, scheduledAt, completed",
      trendData: "id, date",
      settings: "id",
      checkInSessions: "id, startedAt, recordingId",
    })

    // Version 5: Add achievements table for dynamic AI-generated achievements
    this.version(5).stores({
      recordings: "id, createdAt, status",
      suggestions: "id, createdAt, status, category, recordingId, version",
      recoveryBlocks: "id, suggestionId, scheduledAt, completed",
      trendData: "id, date",
      settings: "id",
      checkInSessions: "id, startedAt, recordingId",
      achievements: "id, earnedAt, category, rarity, seen",
    })

    // Version 6: Add journal entries for check-in reflection
    this.version(6).stores({
      recordings: "id, createdAt, status",
      suggestions: "id, createdAt, status, category, recordingId, version",
      recoveryBlocks: "id, suggestionId, scheduledAt, completed",
      trendData: "id, date",
      settings: "id",
      checkInSessions: "id, startedAt, recordingId",
      achievements: "id, earnedAt, category, rarity, seen",
      journalEntries: "id, createdAt, category, checkInSessionId",
    })

    // Version 7: Daily achievements system (challenges + badges), milestone badges, and user progress
    this.version(7).stores({
      recordings: "id, createdAt, status",
      suggestions: "id, createdAt, status, category, recordingId, version",
      recoveryBlocks: "id, suggestionId, scheduledAt, completed",
      trendData: "id, date",
      settings: "id",
      checkInSessions: "id, startedAt, recordingId",
      achievements: "id, dateISO, type, category, completed, createdAt, seen",
      milestoneBadges: "id, earnedAt, type, seen",
      userProgress: "id",
      journalEntries: "id, createdAt, category, checkInSessionId",
    }).upgrade(async (tx) => {
      // Clear the legacy rarity-based achievements (schema changed)
      await tx.table("achievements").clear()
      // userProgress + milestoneBadges are new; created empty on upgrade
    })

    // Version 8: Commitments for accountability follow-up
    this.version(8).stores({
      recordings: "id, createdAt, status",
      suggestions: "id, createdAt, status, category, recordingId, version",
      recoveryBlocks: "id, suggestionId, scheduledAt, completed",
      trendData: "id, date",
      settings: "id",
      checkInSessions: "id, startedAt, recordingId",
      achievements: "id, dateISO, type, category, completed, createdAt, seen",
      milestoneBadges: "id, earnedAt, type, seen",
      userProgress: "id",
      journalEntries: "id, createdAt, category, checkInSessionId",
      commitments: "id, checkInSessionId, extractedAt, outcome",
    })

    // Version 9: Force an upgrade pass to repair any drifted or partially-created DBs.
    // Dexie will create any missing object stores/indexes during the upgrade transaction.
    // See: docs/error-patterns/indexeddb-missing-object-store.md
    this.version(9).stores({
      recordings: "id, createdAt, status",
      suggestions: "id, createdAt, status, category, recordingId, version",
      recoveryBlocks: "id, suggestionId, scheduledAt, completed",
      trendData: "id, date",
      settings: "id",
      checkInSessions: "id, startedAt, recordingId",
      achievements: "id, dateISO, type, category, completed, createdAt, seen",
      milestoneBadges: "id, earnedAt, type, seen",
      userProgress: "id",
      journalEntries: "id, createdAt, category, checkInSessionId",
      commitments: "id, checkInSessionId, extractedAt, outcome",
    })

    // Version 10: Repair malformed suggestion records (legacy/demo writes, partial saves, etc.).
    // Pattern doc: docs/error-patterns/undefined-string-split.md
    this.version(10).stores({
      recordings: "id, createdAt, status",
      suggestions: "id, createdAt, status, category, recordingId, version",
      recoveryBlocks: "id, suggestionId, scheduledAt, completed",
      trendData: "id, date",
      settings: "id",
      checkInSessions: "id, startedAt, recordingId",
      achievements: "id, dateISO, type, category, completed, createdAt, seen",
      milestoneBadges: "id, earnedAt, type, seen",
      userProgress: "id",
      journalEntries: "id, createdAt, category, checkInSessionId",
      commitments: "id, checkInSessionId, extractedAt, outcome",
    }).upgrade((tx) => {
      const validCategories: SuggestionCategory[] = ["break", "exercise", "mindfulness", "social", "rest"]
      const validStatuses: SuggestionStatus[] = ["pending", "accepted", "dismissed", "scheduled", "completed"]

      return tx.table("suggestions").toCollection().modify((suggestion: Record<string, unknown>) => {
        if (typeof suggestion.content !== "string") suggestion.content = ""
        if (typeof suggestion.rationale !== "string") suggestion.rationale = ""

        const duration = suggestion.duration
        if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) {
          suggestion.duration = 15
        }

        const category = suggestion.category
        if (typeof category !== "string" || !validCategories.includes(category as SuggestionCategory)) {
          suggestion.category = "break"
        }

        const status = suggestion.status
        if (typeof status !== "string" || !validStatuses.includes(status as SuggestionStatus)) {
          suggestion.status = "pending"
        }

        const createdAt = suggestion.createdAt
        if (!(createdAt instanceof Date)) {
          const parsed = typeof createdAt === "string" || typeof createdAt === "number"
            ? new Date(createdAt)
            : new Date()
          suggestion.createdAt = Number.isNaN(parsed.getTime()) ? new Date() : parsed
        }

        const scheduledFor = suggestion.scheduledFor
        if (scheduledFor !== undefined && !(scheduledFor instanceof Date)) {
          const parsed = typeof scheduledFor === "string" || typeof scheduledFor === "number"
            ? new Date(scheduledFor)
            : null
          suggestion.scheduledFor = parsed && !Number.isNaN(parsed.getTime()) ? parsed : undefined
        }

        const lastUpdatedAt = suggestion.lastUpdatedAt
        if (lastUpdatedAt !== undefined && !(lastUpdatedAt instanceof Date)) {
          const parsed = typeof lastUpdatedAt === "string" || typeof lastUpdatedAt === "number"
            ? new Date(lastUpdatedAt)
            : null
          suggestion.lastUpdatedAt = parsed && !Number.isNaN(parsed.getTime()) ? parsed : undefined
        }
      })
    })
  }
}

// Singleton instance
export const db = new KanariDB()

// Helper to convert DB records to API types
export function toRecording(dbRecord: DBRecording): Recording {
  return {
    ...dbRecord,
    createdAt: dbRecord.createdAt.toISOString(),
  }
}

export function toSuggestion(dbRecord: DBSuggestion): Suggestion {
  // Defensive normalization: persisted suggestion records can drift from the TypeScript type
  // (e.g. partial writes, old demo seed data, or legacy schema changes). UI code should never
  // crash on malformed persisted data.
  //
  // Pattern doc: docs/error-patterns/undefined-string-split.md
  const raw = dbRecord as unknown as Record<string, unknown>

  const validCategories: SuggestionCategory[] = ["break", "exercise", "mindfulness", "social", "rest"]
  const validStatuses: SuggestionStatus[] = ["pending", "accepted", "dismissed", "scheduled", "completed"]

  const parseDate = (value: unknown): Date | null => {
    if (value instanceof Date) return value
    if (typeof value === "string" || typeof value === "number") {
      const parsed = new Date(value)
      return Number.isNaN(parsed.getTime()) ? null : parsed
    }
    return null
  }

  const ensureString = (value: unknown): string => (typeof value === "string" ? value : "")
  const ensureDuration = (value: unknown): number => {
    if (typeof value !== "number") return 15
    if (!Number.isFinite(value) || value <= 0) return 15
    return value
  }
  const ensureCategory = (value: unknown): SuggestionCategory => {
    if (typeof value !== "string") return "break"
    return validCategories.includes(value as SuggestionCategory) ? (value as SuggestionCategory) : "break"
  }
  const ensureStatus = (value: unknown): SuggestionStatus => {
    if (typeof value !== "string") return "pending"
    return validStatuses.includes(value as SuggestionStatus) ? (value as SuggestionStatus) : "pending"
  }

  const createdAtDate = parseDate(raw.createdAt) ?? new Date()
  const scheduledForDate = parseDate(raw.scheduledFor)
  const lastUpdatedAtDate = parseDate(raw.lastUpdatedAt)

  const normalized = {
    ...dbRecord,
    content: ensureString(raw.content),
    rationale: ensureString(raw.rationale),
    duration: ensureDuration(raw.duration),
    category: ensureCategory(raw.category),
    status: ensureStatus(raw.status),
    createdAt: createdAtDate,
    scheduledFor: scheduledForDate ?? undefined,
    lastUpdatedAt: lastUpdatedAtDate ?? undefined,
  } satisfies DBSuggestion

  const repaired = normalized.content !== (raw.content as unknown)
    || normalized.rationale !== (raw.rationale as unknown)
    || normalized.duration !== (raw.duration as unknown)
    || normalized.category !== (raw.category as unknown)
    || normalized.status !== (raw.status as unknown)
    || createdAtDate !== raw.createdAt

  if (repaired) {
    logWarn("storage", "Repairing malformed suggestion record at read-time", {
      id: raw.id,
      category: raw.category,
      status: raw.status,
    })
  }

  return {
    ...normalized,
    createdAt: normalized.createdAt.toISOString(),
    scheduledFor: normalized.scheduledFor?.toISOString(),
    lastUpdatedAt: normalized.lastUpdatedAt?.toISOString(),
  }
}

export function toRecoveryBlock(dbRecord: DBRecoveryBlock): RecoveryBlock {
  return {
    ...dbRecord,
    scheduledAt: dbRecord.scheduledAt.toISOString(),
  }
}

export function toTrendData(dbRecord: DBTrendData & { id: string }): TrendData {
  return {
    date: dbRecord.date.toISOString().split("T")[0],
    stressScore: dbRecord.stressScore,
    fatigueScore: dbRecord.fatigueScore,
    recordingCount: dbRecord.recordingCount,
  }
}

// Helper to convert API types to DB records
export function fromRecording(record: Recording): DBRecording {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
  }
}

export function fromSuggestion(record: Suggestion): DBSuggestion {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    scheduledFor: record.scheduledFor ? new Date(record.scheduledFor) : undefined,
    lastUpdatedAt: record.lastUpdatedAt ? new Date(record.lastUpdatedAt) : undefined,
  }
}

export function fromRecoveryBlock(record: RecoveryBlock): DBRecoveryBlock {
  return {
    ...record,
    scheduledAt: new Date(record.scheduledAt),
  }
}

export function fromTrendData(record: TrendData): DBTrendData & { id: string } {
  return {
    id: record.date,
    date: new Date(record.date),
    stressScore: record.stressScore,
    fatigueScore: record.fatigueScore,
    recordingCount: record.recordingCount,
  }
}

export function toCheckInSession(dbRecord: DBCheckInSession): CheckInSession {
  return {
    ...dbRecord,
    startedAt: dbRecord.startedAt.toISOString(),
    endedAt: dbRecord.endedAt?.toISOString(),
  }
}

export function fromCheckInSession(record: CheckInSession): DBCheckInSession {
  return {
    ...record,
    startedAt: new Date(record.startedAt),
    endedAt: record.endedAt ? new Date(record.endedAt) : undefined,
  }
}

export function toCommitment(dbRecord: DBCommitment): Commitment {
  return {
    ...dbRecord,
    extractedAt: dbRecord.extractedAt.toISOString(),
    followedUpAt: dbRecord.followedUpAt?.toISOString(),
  }
}

export function fromCommitment(record: Commitment): DBCommitment {
  return {
    ...record,
    extractedAt: new Date(record.extractedAt),
    followedUpAt: record.followedUpAt ? new Date(record.followedUpAt) : undefined,
  }
}

export function toDailyAchievement(dbRecord: DBDailyAchievement): DailyAchievement {
  return {
    ...dbRecord,
    createdAt: dbRecord.createdAt.toISOString(),
    completedAt: dbRecord.completedAt?.toISOString(),
    seenAt: dbRecord.seenAt?.toISOString(),
    expiredAt: dbRecord.expiredAt?.toISOString(),
  }
}

export function fromDailyAchievement(record: DailyAchievement): DBDailyAchievement {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    completedAt: record.completedAt ? new Date(record.completedAt) : undefined,
    seenAt: record.seenAt ? new Date(record.seenAt) : undefined,
    expiredAt: record.expiredAt ? new Date(record.expiredAt) : undefined,
  }
}

export function toMilestoneBadge(dbRecord: DBMilestoneBadge): MilestoneBadge {
  return {
    ...dbRecord,
    earnedAt: dbRecord.earnedAt.toISOString(),
    seenAt: dbRecord.seenAt?.toISOString(),
  }
}

export function fromMilestoneBadge(record: MilestoneBadge): DBMilestoneBadge {
  return {
    ...record,
    earnedAt: new Date(record.earnedAt),
    seenAt: record.seenAt ? new Date(record.seenAt) : undefined,
  }
}

export function toJournalEntry(dbRecord: DBJournalEntry): JournalEntry {
  return {
    ...dbRecord,
    createdAt: dbRecord.createdAt.toISOString(),
  }
}

export function fromJournalEntry(record: JournalEntry): DBJournalEntry {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
  }
}
