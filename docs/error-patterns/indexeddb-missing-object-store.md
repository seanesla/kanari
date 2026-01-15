# Error Pattern: IndexedDB Missing Object Store

## What it looks like

- Runtime error in the browser console / Next.js overlay similar to:
  - `NotFoundError: Failed to execute 'objectStore' on 'IDBTransaction': The specified object store was not found.`
- Often points at a Dexie call, e.g. `db.settings.get("default")`.

## Why it happens

This happens when an IndexedDB database exists (same name), but it doesn't contain the object stores our app expects.

Common causes:

1. **A partially-created/empty DB** exists (e.g., created by earlier experimental code or a failed/aborted setup).
2. **Schema drift** across app versions in local dev: switching branches/commits can leave an unexpected DB state behind.
3. **Missing schema repair pass**: if the DB version hasn't changed, IndexedDB won't run an upgrade transaction where missing stores could be created.

## How to detect it automatically

- Add a regression test that creates an empty `kanari` DB at the current native version and asserts that the app can read settings without logging errors.
  - See: `lib/gemini/__tests__/api-utils-indexeddb.test.ts`

## How we fix it in this repo

- Bump the Dexie schema version to force an upgrade transaction.
  - Dexie will create any missing object stores/indexes during the upgrade.
  - See: `lib/storage/db.ts`

