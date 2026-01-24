/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import Dexie from "dexie"
import { installFakeIndexedDb, deleteDatabase } from "@/test-utils/indexeddb"

const DB_NAME = "kanari"

describe("patchSettings", () => {
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

  it("does not wipe existing fields when a create fallback races", async () => {
    const { db } = await import("@/lib/storage/db")
    const { createDefaultSettingsRecord } = await import("@/lib/settings/default-settings")
    const { patchSettings } = await import("@/lib/settings/patch-settings")

    await db.settings.add(createDefaultSettingsRecord({ userName: "Sean" }))

    // Simulate the race condition:
    // - Our first update() says the record is missing (0)
    // - But by the time we try to create, the record already exists
    const originalUpdate = db.settings.update.bind(db.settings)
    let callCount = 0
    vi.spyOn(db.settings, "update").mockImplementation((key, changes) => {
      callCount += 1
      if (callCount === 1) {
        return Dexie.Promise.resolve(0)
      }
      return originalUpdate(key, changes)
    })

    await patchSettings({ accentColor: "#123456" })

    const settings = await db.settings.get("default")
    expect(settings?.userName).toBe("Sean")
    expect(settings?.accentColor).toBe("#123456")
  })
})
