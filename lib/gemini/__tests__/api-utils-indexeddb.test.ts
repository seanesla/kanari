import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { indexedDB as fakeIndexedDB, IDBKeyRange } from "fake-indexeddb"

const DB_NAME = "kanari"

function installFakeIndexedDb() {
  Object.defineProperty(globalThis, "indexedDB", {
    value: fakeIndexedDB,
    configurable: true,
  })
  Object.defineProperty(globalThis, "IDBKeyRange", {
    value: IDBKeyRange,
    configurable: true,
  })
}

function deleteDatabase(name: string) {
  return new Promise<void>((resolve, reject) => {
    const request = fakeIndexedDB.deleteDatabase(name)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error("deleteDatabase blocked"))
    request.onsuccess = () => resolve()
  })
}

function createEmptyDatabase(name: string, version: number) {
  return new Promise<void>((resolve, reject) => {
    const request = fakeIndexedDB.open(name, version)
    request.onerror = () => reject(request.error)
    request.onupgradeneeded = () => {
      // Intentionally create *no* object stores.
    }
    request.onsuccess = () => {
      request.result.close()
      resolve()
    }
  })
}

describe("getGeminiApiKey (IndexedDB)", () => {
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

  it("does not log errors when the IndexedDB exists but object stores are missing", async () => {
    // Matches a user-reported failure mode where a "kanari" DB exists but doesn't contain our tables.
    await createEmptyDatabase(DB_NAME, 80)

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const { getGeminiApiKey } = await import("@/lib/gemini/api-utils")
    const apiKey = await getGeminiApiKey()

    expect(apiKey).toBeUndefined()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })
})

