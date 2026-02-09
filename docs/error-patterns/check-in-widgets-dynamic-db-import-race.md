# Check-in widget storage import race

## What the error looks like
- Scheduling tests that trigger multiple widget writes in quick succession fail with:
  - `TypeError: indexedDB.open is not a function`
- Only the first schedule write succeeds; later writes fail in the same test run.

## Why it happens
- `use-check-in-widgets` uses dynamic imports for `@/lib/storage/db`.
- Multiple concurrent scheduling paths can call that dynamic import at nearly the same time.
- In test environments with module mocks, repeated dynamic imports may resolve inconsistently if not cached, causing some calls to hit real Dexie instead of the mocked module.
- When a test stubs `globalThis.indexedDB` with a minimal object, real Dexie access throws because `indexedDB.open` is missing.

## How to detect automatically
- Add/keep tests that schedule multiple activities within one hook lifecycle:
  - two `schedule_activity` events in a row with different titles
  - one `schedule_recurring_activity` that expands into multiple occurrences
- Assert `scheduleEvent` call counts match expected occurrences.
- If call counts stop after the first event and you see `indexedDB.open` errors, this pattern is likely present.

## Fix pattern
- Cache the first successful dynamic import promise/module and reuse it for all subsequent storage operations in that hook instance.
- If import fails, clear the cached promise so retries can work.

## Related code
- `hooks/use-check-in-widgets.ts`
- `hooks/__tests__/use-check-in-widgets-calendar-sync.test.ts`
