# Gemini Live Concurrent Connect Early Resolve

## What it looks like
- AI chat/check-in UI gets stuck on a setup state like “Setting up conversation…” or “Connecting…”.
- Retrying sometimes “fixes it”, especially after a reload, but the initial attempt never transitions to the active conversation.
- No obvious error is surfaced because the caller believes `connect()` completed.

## Why it happens
In `useGeminiLive.connect()`, we guard against concurrent connection attempts using `isConnectingRef`.

If the guard **returns early** from an `async` function, it returns a *resolved* `Promise<void>` immediately.
Callers that `await connect()` will proceed even though the underlying connection is still in-flight (or was initiated by a different component instance in dev/StrictMode).

When the “real” connection attempt finishes, its callbacks may not be wired to the current UI instance, leaving the check-in state machine stranded in an initialization state.

## Fix strategy
1. Keep the concurrent-connect guard, but **return the in-flight connection promise** so callers block correctly.
2. Ensure connect failures **reject** so orchestrators like `useCheckInSession.startSession()` can surface an error and clean up instead of hanging.

## Implementation
- `hooks/use-gemini-live.ts`
  - Added `connectPromiseRef` and returned it when `isConnectingRef.current` is true
  - Re-threw errors from `connect()` (after dispatching reducer state) so callers can handle failures deterministically

## How to detect it automatically
- Unit regression:
  - `hooks/__tests__/use-gemini-live-connect-concurrency.test.ts` asserts a second `connect()` call does not resolve while the first is pending.
- Static scan:
  - Search for `if (is*Ref.current) return` inside `async` functions that act as readiness gates.
  - If such guards exist, prefer returning an in-flight promise (or throwing) instead of returning immediately.

