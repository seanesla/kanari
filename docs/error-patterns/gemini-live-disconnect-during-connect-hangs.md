# Gemini Live: disconnect during connect can strand future check-ins

## What it looks like

- After finishing a check-in and starting another one, the UI stays stuck at “Connecting…” indefinitely.
- Retrying doesn’t help until a full page refresh.
- Console/network may show a Gemini Live WebSocket that never reaches `OPEN`, or SDK errors like “connection is currently trying to be established”.

## Why it happens

`GeminiLiveClient.connect()` uses a `Promise.race()` between:

- the SDK’s `ai.live.connect()` promise, and
- a timeout promise driven by `setTimeout()`.

If `disconnect()` is called while `connect()` is still in-flight, and `disconnect()` clears the timeout timer, the timeout promise will never reject. If the SDK promise also never settles (common when the browser WebSocket is stuck in `CONNECTING`), the `Promise.race()` can become permanently pending.

That strands:

- the app’s “connecting” UI state, and
- any future `connect()` calls that rely on the in-flight promise or concurrency guards.

## How to detect it automatically

- Add a regression test where `ai.live.connect()` never resolves, call `connect()`, then `disconnect()`, and assert the `connect()` promise settles promptly.
- In the app, watch for a `connecting` state that never transitions and does not time out after the expected window.

## Fix

- Make `disconnect()` actively cancel an in-flight `connect()` by rejecting a dedicated “abort” promise that participates in the `Promise.race()`.
- Treat this cancellation as non-user-visible (don’t show a connection error toast/banner just because the user ended the session).

Related implementation: `lib/gemini/live-client.ts`.

