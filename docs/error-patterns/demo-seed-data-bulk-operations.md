# Demo seed data: use bulk operations

## What the error looks like

- Clicking `Feature Tour` feels “stuck” on `Loading...` for seconds.
- Demo tour starts late, or appears unreliable on slower devices.

## Why it happens

Seeding demo data into IndexedDB record-by-record (e.g. `for (...) await db.table.put(...)`) forces many separate IndexedDB writes and extra transaction overhead, which is noticeably slow in real browsers.

## How to fix

- Prefer `bulkPut()` for arrays of records.
- Wrap seeding in a single `db.transaction("rw", ...)` so the writes are batched and consistent.

## How to detect automatically

- Search for patterns like:
  - `for (` + `await db.*.put(`
  - many sequential `await db.*.put(` calls in “seed” or “demo” code paths
