# Error Pattern: `useLiveQuery` Default Overwrite

## What it looks like

- User progression data (e.g., XP/level/streak) resets to defaults after refresh or navigation.
- Example symptom:
  - You earned points yesterday, but today your level shows `0` points / level 1.

## Why it happens

`dexie-react-hooks` `useLiveQuery()` returns `undefined` while the query is still loading.

For `db.table.get(key)`, the resolved value is also `undefined` when the record does not exist.

If code does something like:

- `const record = useLiveQuery(() => db.table.get("default"), [])`
- `useEffect(() => { if (!record) db.table.put(DEFAULT_RECORD) }, [record])`

…then the effect can run during the initial render (when `record` is still loading) and **overwrite an existing record** with defaults.

## How to detect it automatically

- Tests: seed a real Dexie DB with non-default values, mount the hook/component, and assert the record is still intact after the first render.
  - Example: `hooks/__tests__/use-achievements-progress-persistence.test.ts`
- Code search: look for `useLiveQuery(...get("default")...)` combined with `put(DEFAULT_...)` in an effect that is gated by the live query value.

## How we fix it in this repo

- Never `put()` defaults based on a `useLiveQuery()` value.
- Prefer an insert-only operation:
  - `db.table.add(DEFAULT).catch(() => undefined)` (ignore "already exists")
- Or explicitly check storage (not the reactive value) before writing.

See: `hooks/use-achievements.ts`

