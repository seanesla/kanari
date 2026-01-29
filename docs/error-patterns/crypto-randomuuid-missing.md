# Error Pattern: `crypto.randomUUID is not a function` (iOS Safari / older WebKit)

## What it looks like

- Runtime error on some phones (often iOS Safari / embedded WebViews):
  - `crypto.randomUUID is not a function`
  - or `crypto.randomUUID is undefined`
- Commonly triggered when generating new client-side entities (recordings, achievements, suggestions).

## Why it happens

`crypto` can exist while `crypto.randomUUID()` does not.

Older WebKit builds expose `crypto.getRandomValues()` but don’t implement `randomUUID()`. Calling it directly crashes.

## How to detect it automatically

- Unit test a UUID helper under:
  - `crypto.randomUUID` missing
  - `crypto.getRandomValues` present
  - `crypto` missing entirely
  - See: `lib/__tests__/uuid.test.ts`
- Grep for direct `crypto.randomUUID()` usage.

## How we fix it in this repo

- Use `safeRandomUUID()` from `lib/uuid.ts` instead of calling `crypto.randomUUID()` directly.
- `safeRandomUUID()` prefers:
  1) `crypto.randomUUID()`
  2) RFC 4122 v4 via `crypto.getRandomValues()`
  3) last-resort non-crypto fallback string

