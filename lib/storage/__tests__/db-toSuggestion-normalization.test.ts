/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { deleteDatabase, installFakeIndexedDb } from "@/test-utils/indexeddb"
import type { DBSuggestion } from "@/lib/storage/db"

const DB_NAME = "kanari"

describe("toSuggestion normalization", () => {
  beforeEach(async () => {
    vi.resetModules()
    installFakeIndexedDb()
    await deleteDatabase(DB_NAME).catch(() => undefined)
  })

  afterEach(async () => {
    try {
      const { db } = await import("@/lib/storage/db")
      db.close()
    } catch {
      // ignore
    }
    await deleteDatabase(DB_NAME).catch(() => undefined)
  })

  it("fills missing required fields instead of throwing", async () => {
    const { toSuggestion } = await import("@/lib/storage/db")

    const malformed = {
      id: "s1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      scheduledFor: new Date("2026-01-01T10:00:00.000Z"),
      content: undefined,
      rationale: undefined,
      duration: undefined,
      category: "exercise",
      status: "scheduled",
    } as unknown as DBSuggestion

    const suggestion = toSuggestion(malformed)

    expect(suggestion.content).toBe("")
    expect(suggestion.rationale).toBe("")
    expect(suggestion.duration).toBe(15)
    expect(suggestion.category).toBe("exercise")
    expect(suggestion.status).toBe("scheduled")
    expect(suggestion.scheduledFor).toBe("2026-01-01T10:00:00.000Z")
    expect(suggestion.createdAt).toBe("2026-01-01T00:00:00.000Z")
  })

  it("defaults invalid category/status/duration to safe values", async () => {
    const { toSuggestion } = await import("@/lib/storage/db")

    const malformed = {
      id: "s2",
      createdAt: "not-a-date",
      content: "Do something",
      rationale: "because",
      duration: Number.NaN,
      category: "invalid",
      status: "invalid",
    } as unknown as DBSuggestion

    const suggestion = toSuggestion(malformed)

    expect(suggestion.duration).toBe(15)
    expect(suggestion.category).toBe("break")
    expect(suggestion.status).toBe("pending")
    expect(typeof suggestion.createdAt).toBe("string")
  })
})
