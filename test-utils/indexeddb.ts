import { indexedDB as fakeIndexedDB, IDBKeyRange } from "fake-indexeddb"

export function installFakeIndexedDb(): void {
  Object.defineProperty(globalThis, "indexedDB", {
    value: fakeIndexedDB,
    configurable: true,
  })
  Object.defineProperty(globalThis, "IDBKeyRange", {
    value: IDBKeyRange,
    configurable: true,
  })
}

export function deleteDatabase(name: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = fakeIndexedDB.deleteDatabase(name)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error("deleteDatabase blocked"))
    request.onsuccess = () => resolve()
  })
}
