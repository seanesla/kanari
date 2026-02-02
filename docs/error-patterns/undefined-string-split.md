# Error Pattern: `Cannot read properties of undefined (reading 'split')`

## What it looks like

Browser console / Next.js overlay error:

> TypeError: Cannot read properties of undefined (reading 'split')

Common stack traces point at UI helpers that do something like:

```ts
someObject.someStringField.split(...)
```

## Why it happens

TypeScript types often model persisted records (IndexedDB/Dexie, localStorage, demo seed data, server responses) as having required string fields, but **runtime data can drift**:

- legacy records created before a field existed
- partial writes / interrupted transactions
- demo seed data or manual edits missing fields
- schema changes where old records were not migrated

When UI code assumes a field is always a string and calls `.split`, it will crash if the field is `undefined` at runtime.

## How to detect it automatically

- Search for direct string method calls on persisted/JSON-backed objects without a runtime guard:
  - `rg -n "\\.split\\(" app components hooks lib`
  - Focus on objects coming from IndexedDB/Dexie, `JSON.parse`, or external APIs.
- Add unit tests that pass malformed records (missing required strings) through:
  - storage normalization functions (`toXxx` converters)
  - UI mappers (e.g. suggestion → calendar event)
  - critical pages/components that render those objects

## Fix strategy

1. **Normalize at the ingestion boundary** (preferred):
   - When reading from IndexedDB / parsing JSON, coerce required string fields to `""` (or another safe default).
   - Validate enums (category/status), numbers (duration), and dates.
2. **Defensively map in UI**:
   - Treat persisted objects as untrusted and avoid calling string methods without `typeof value === "string"` guards.
3. **Add a migration** if the bad data can be repaired in-place:
   - Dexie `version().upgrade()` pass that fills missing fields for existing records.

