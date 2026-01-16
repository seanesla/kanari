# Error Pattern: Dexie Transaction Async Boundary

## What it looks like

- Runtime error (often while generating/writing data) similar to:
  - `Transaction committed too early. See http://bit.ly/2kdckMn`
- Or a related IndexedDB error while inside a Dexie transaction:
  - `NotFoundError: Failed to execute 'objectStore' on 'IDBTransaction': The specified object store was not found.`
  - Often surfaces when a call like `db.settings.get("default")` happens while another transaction is active.

## Why it happens

Dexie `db.transaction("rw", storeA, storeB, async () => { ... })` wraps a single native `IDBTransaction` limited to the listed stores.

Two common pitfalls:

1. **Awaiting non-IndexedDB async work inside the transaction** (e.g. `await fetch(...)`).
   - Awaiting a network call crosses a task boundary; the browser may auto-commit the `IDBTransaction`.
   - Any subsequent Dexie writes fail with “Transaction committed too early”.

2. **Touching a store that is not part of the transaction store list**.
   - Dexie keeps a “current transaction” context while your callback runs.
   - If you call `db.settings.*` inside a transaction that only includes `db.achievements`, Dexie will attempt `objectStore("settings")` on the same `IDBTransaction`, which throws `NotFoundError`.

This is distinct from a *missing object store in the DB schema* (see: `docs/error-patterns/indexeddb-missing-object-store.md`).

## How to detect it automatically

- Tests: mock `fetch()` to force a task boundary (e.g. `await new Promise(r => setTimeout(r, 0))`) and assert the feature still succeeds.
  - Example: `hooks/__tests__/use-achievements-ensure-today-transactions.test.ts`
- Code search:
  - `db.transaction(` combined with `fetch(` inside the callback.
  - `db.transaction(` combined with reads/writes to stores not included in the store list (e.g. `db.settings`).

## How we fix it in this repo

- Split the work into phases:
  - Transaction A: compute/prepare payload from IndexedDB data.
  - Network: call Gemini (or any API) **outside** the transaction.
  - Transaction B: persist results and award points.
- If you truly must await non-DB work, use `tx.waitFor(...)` / `Dexie.waitFor(...)` (prefer avoiding this).
- If you must touch other stores while a transaction is active, include them in the transaction store list, or force the access to ignore the current transaction.

See: `hooks/use-achievements.ts` (`ensureToday`)
