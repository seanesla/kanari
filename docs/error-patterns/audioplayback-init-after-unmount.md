# Audio Playback Initialization After Unmount

## What it looks like
- You close the check-in/AI chat, but audio output continues briefly.
- On reopening, the assistant voice sounds duplicated or “stacked”.
- In dev (StrictMode), you sometimes hear the greeting twice or with overlap.

## Why it happens
`useAudioPlayback()` is responsible for creating an `AudioContext`, loading the
playback worklet, and routing audio to the speakers.

If `initialize()` is called from an async flow that continues after the component
unmounts (or after cleanup begins), the hook can:
- create a brand-new `AudioContext` after teardown started
- attach a worklet and connect it to `audioContext.destination`

Even if later cleanup runs, the transient “extra” context can overlap with the
new session and produce multi-voice playback.

## Fix strategy
1. Make initialization **idempotent** for a single hook instance.
2. Add mount/cleanup coordination:
   - Track `mountedRef`
   - Track `cleanupRequestedRef` and an `initializationIdRef`
3. During initialization, re-check abort conditions after each awaited step.
4. On cleanup, mark cleanup requested and invalidate in-flight init via ID bump.

## Implementation
- `hooks/use-audio-playback.ts`
  - Added `mountedRef`, `cleanupRequestedRef`, `initializationIdRef`
  - Made `initialize()` return early if already initialized
  - Added abort checks (`INITIALIZATION_ABORTED`) during init
  - Marked cleanup requested + invalidated in-flight init in `cleanup()`

## How to detect it automatically
- Unit tests cover common failure modes:
  - `hooks/__tests__/use-audio-playback.test.ts` (AudioContext closed mid-init, queue validation, barge-in)
- Regression integration:
  - `hooks/__tests__/use-check-in-session-abort.test.ts` ensures playback init is not triggered after unmount

## Related
- `docs/error-patterns/multiple-audio-playback-voices.md` (runtime overlap and stale callbacks)

