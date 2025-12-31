# Check-In Audio Cleanup Abort Flag Not Reset

## What the Error Looks Like

Resuming a preserved conversational check-in session fails immediately, often with logs like:

```
[useCheckIn] Initialization aborted after getUserMedia (cleanup)
```

And the session ends up stuck in an error/reset path because audio capture initialization aborts.

## Why It Happens

`useCheckInAudio` uses a `cleanupRequestedRef` flag to safely abort **in-flight async initialization**
(e.g. `getUserMedia`, `audioContext.resume`, `audioWorklet.addModule`) when cleanup runs.

This prevents leaked microphone streams and double-close issues, but it introduces a subtle requirement:

- If cleanup was requested for a prior session instance (e.g. during `preserveSession()`),
  the flag stays `true` until explicitly reset.
- A later call to `initializeAudioCapture()` sees the flag and aborts immediately, even though the
  new session is valid and should be able to capture audio.

## How to Detect It

Search for code paths that:

1. Call `cleanupAudioCapture()`
2. Later call `initializeAudioCapture()` on the same hook instance without resetting the flag

Look for the log string in code or console output:

```bash
rg -n \"Initialization aborted\" hooks/use-check-in-audio.ts
```

## The Fix Pattern

Before starting a new session or resuming a preserved session, reset the abort flag:

- Call `resetCleanupRequestedFlag()` before `initializeAudioCapture()`
- Keep the flag-setting behavior in cleanup (it still protects against async races)

## Files Where This Pattern Was Applied

- `hooks/use-check-in-session.ts` (calls `audio.resetCleanupRequestedFlag()` in `startSession` and `resumePreservedSession`)
- `hooks/use-check-in-audio.ts` (documents the flag and exposes `resetCleanupRequestedFlag`)

