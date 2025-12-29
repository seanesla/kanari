"use client"

import Dexie, { type EntityTable } from "dexie"
import type {
  Recording,
  Suggestion,
  RecoveryBlock,
  UserSettings,
  TrendData,
  SuggestionDecision,
} from "@/lib/types"

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

// Database class
class KanariDB extends Dexie {
  recordings!: EntityTable<DBRecording, "id">
  suggestions!: EntityTable<DBSuggestion, "id">
  recoveryBlocks!: EntityTable<DBRecoveryBlock, "id">
  trendData!: EntityTable<DBTrendData & { id: string }, "id">
  settings!: EntityTable<DBSettings, "id">

  constructor() {
    super("kanari")

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
  return {
    ...dbRecord,
    createdAt: dbRecord.createdAt.toISOString(),
    scheduledFor: dbRecord.scheduledFor?.toISOString(),
    lastUpdatedAt: dbRecord.lastUpdatedAt?.toISOString(),
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
