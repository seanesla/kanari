import { indexedDB as fakeIndexedDB, IDBKeyRange } from "fake-indexeddb"
import Dexie from "dexie"

export function installFakeIndexedDb(): void {
  Object.defineProperty(globalThis, "indexedDB", {
    value: fakeIndexedDB,
    configurable: true,
  })
  Object.defineProperty(globalThis, "IDBKeyRange", {
    value: IDBKeyRange,
    configurable: true,
  })

  // Dexie may snapshot IndexedDB availability at import time; ensure it points
  // at the fake IndexedDB implementation for tests.
  Dexie.dependencies.indexedDB = fakeIndexedDB
  Dexie.dependencies.IDBKeyRange = IDBKeyRange
}

export function deleteDatabase(name: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = fakeIndexedDB.deleteDatabase(name)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error("deleteDatabase blocked"))
    request.onsuccess = () => resolve()
  })
}
